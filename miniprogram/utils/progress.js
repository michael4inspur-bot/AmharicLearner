// 学习进度：本地存储（wx.storage）为主，后台同步为辅。
const langs = require('../langs/index.js');
const srs = require('./srs.js');

const DAY = srs.DAY;

/** 本地存储键：阿姆哈拉语沿用 progress_v1（老数据零迁移），其他语言 progress_<code>_v1 */
function keyOf(code) {
  return code === 'am' ? 'progress_v1' : `progress_${code}_v1`;
}

// 每种语言一份内存缓存
const caches = {};

function todayStr(d) {
  const t = d ? new Date(d) : new Date();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${t.getFullYear()}-${m}-${day}`;
}

function defaultProgress() {
  return {
    version: 1,
    startDate: todayStr(),
    dailyMinutesGoal: 35,
    newCardsPerDay: 15,
    unitsLearned: {},   // unitId -> date
    quizScores: [],     // {unit, score, total, date}
    srs: {},            // itemId -> card
    logs: {},           // date -> {minutes, reviews, correct, wrong, newCards}
    missions: {},       // missionKey -> date
    reflections: {},    // 复盘 key（如 w3）-> date
    fidelGroupsDone: {},// group -> date
  };
}

const OBJECT_FIELDS = ['unitsLearned', 'srs', 'logs', 'missions', 'reflections', 'fidelGroupsDone', 'starLog', 'badges'];
const ARRAY_FIELDS = ['quizScores'];

/**
 * 把外来进度（本地旧数据、云端快照、别的版本写的）整理成本模块能安全使用的形状。
 * 浅合并挡不住 `logs: null` 这类脏值：null 会覆盖默认的 {}，之后 todayLog / streak /
 * dueCards / srsStats 全部抛错，首页、复习页、我的页一起崩，重启也不恢复。
 * 星星、徽章、星星日志是 points.js 懒创建的，不在默认结构里，浅合并会把它们直接丢掉。
 */
function sanitize(raw) {
  const p = { ...defaultProgress(), ...(raw && typeof raw === 'object' ? raw : {}) };
  OBJECT_FIELDS.forEach((k) => {
    if (!p[k] || typeof p[k] !== 'object' || Array.isArray(p[k])) p[k] = {};
  });
  ARRAY_FIELDS.forEach((k) => {
    if (!Array.isArray(p[k])) p[k] = [];
  });
  if (typeof p.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)) p.startDate = todayStr();
  if (typeof p.dailyMinutesGoal !== 'number' || !(p.dailyMinutesGoal > 0)) p.dailyMinutesGoal = 35;
  if (typeof p.newCardsPerDay !== 'number' || !(p.newCardsPerDay > 0)) p.newCardsPerDay = 15;
  if (typeof p.stars !== 'number' || !Number.isFinite(p.stars) || p.stars < 0) p.stars = 0;
  // 每日日志缺 minutes 会让 streak 把没学的天算成连续（undefined <= 0 为 false）
  Object.keys(p.logs).forEach((k) => {
    const l = p.logs[k];
    if (!l || typeof l !== 'object') { delete p.logs[k]; return; }
    ['minutes', 'reviews', 'correct', 'wrong', 'newCards', 'newSeen'].forEach((f) => {
      if (typeof l[f] !== 'number' || !Number.isFinite(l[f])) l[f] = 0;
    });
  });
  // 缺 ef 的卡片评分后 ef/interval/due 会全变 NaN，该卡永久不再到期却仍计入总数
  Object.keys(p.srs).forEach((id) => {
    const c = p.srs[id];
    if (!c || typeof c !== 'object') { delete p.srs[id]; return; }
    if (typeof c.ef !== 'number' || !Number.isFinite(c.ef)) c.ef = 2.5;
    if (typeof c.interval !== 'number' || !Number.isFinite(c.interval)) c.interval = 0;
    if (typeof c.reps !== 'number' || !Number.isFinite(c.reps)) c.reps = 0;
    if (typeof c.due !== 'number' || !Number.isFinite(c.due)) c.due = Date.now();
  });
  return p;
}

/** 本地进度是否还是全新的（没学过任何东西）。空进度不该覆盖云端。 */
function isEmpty(p) {
  p = p || load();
  return Object.keys(p.unitsLearned).length === 0
    && Object.keys(p.srs).length === 0
    && Object.keys(p.logs).length === 0
    && p.quizScores.length === 0;
}

function load(code) {
  code = code || langs.current();
  if (caches[code]) return caches[code];
  try {
    caches[code] = sanitize(wx.getStorageSync(keyOf(code)));
  } catch (e) {
    caches[code] = defaultProgress();
  }
  return caches[code];
}

let onSaved = null;
/** fn(p, code)：每次保存后回调，code 是这份进度所属的语言 */
function setOnSaved(fn) { onSaved = fn; }

/** 保存进度。code 是这份进度所属的语言；页面拿着进度对象跨过语言切换时必须传 */
function save(p, code) {
  code = code || langs.current();
  caches[code] = p;
  try { wx.setStorageSync(keyOf(code), p); } catch (e) { /* ignore */ }
  if (onSaved) onSaved(p, code);
  return p;
}

function reset() {
  const code = langs.current();
  delete caches[code];
  try { wx.removeStorageSync(keyOf(code)); } catch (e) { /* ignore */ }
  return load();
}

function replace(p, code) {
  code = code || langs.current();
  const local = load(code);
  const next = sanitize(p);
  // 云端快照可能早于积分功能，缺这三个字段。浅合并会把本机已得的星星和徽章清零且不可逆，
  // 所以云端没有时保留本机的。
  if (!p || typeof p !== 'object' || p.stars == null) next.stars = local.stars || 0;
  if (!p || !p.starLog) next.starLog = local.starLog || {};
  if (!p || !p.badges) next.badges = local.badges || {};
  delete caches[code];
  return save(next, code);
}

// ---------- 当前周 / 天 ----------
function currentPosition(p) {
  p = p || load();
  const start = new Date(p.startDate + 'T00:00:00');
  const diff = Math.max(0, Math.floor((Date.now() - start.getTime()) / DAY));
  const week = Math.min(langs.pack().plan.weeks.length, Math.floor(diff / 7) + 1);
  const day = diff >= langs.pack().plan.weeks.length * 7 ? 7 : (diff % 7) + 1;
  return { week, day, dayIndex: diff };
}

// ---------- 日志 ----------
const ZERO_LOG = { minutes: 0, reviews: 0, correct: 0, wrong: 0, newCards: 0, newSeen: 0 };

/** 只读地看今天的日志，不会在 logs 里留下空条目 */
function peekLog(p) {
  p = p || load();
  return p.logs[todayStr()] || ZERO_LOG;
}

function todayLog(p) {
  p = p || load();
  const k = todayStr();
  if (!p.logs[k]) p.logs[k] = { ...ZERO_LOG };
  return p.logs[k];
}

function addMinutes(min) {
  const p = load();
  todayLog(p).minutes += min;
  save(p);
}

function streak(p) {
  p = p || load();
  let n = 0;
  const t = new Date();
  // 今天没学不打断连续
  if (!p.logs[todayStr(t)] || p.logs[todayStr(t)].minutes === 0) t.setDate(t.getDate() - 1);
  for (;;) {
    const k = todayStr(t);
    const l = p.logs[k];
    if (!l || l.minutes <= 0) break;
    n += 1;
    t.setDate(t.getDate() - 1);
  }
  return n;
}

// ---------- 单元与 SRS ----------
function learnUnit(unitId) {
  const p = load();
  const u = langs.pack().getUnit(unitId);
  if (!u) return p;
  const now = Date.now();
  let added = 0;
  u.items.forEach((it, i) => {
    if (!p.srs[it.id]) {
      // 全部立即到期，但按单元内顺序错开 1 秒，保证复习顺序稳定
      p.srs[it.id] = srs.newCard(now - (u.items.length - i) * 1000);
      added += 1;
    }
  });
  if (!p.unitsLearned[unitId]) p.unitsLearned[unitId] = todayStr();
  todayLog(p).newCards += added;
  return save(p);
}

function dueCards(p, limit) {
  p = p || load();
  const now = Date.now();
  const log = peekLog(p);
  // 新卡（从未复习过）每天只放出 newCardsPerDay 张，避免成人学习者一次堆太多
  let newBudget = Math.max(0, (p.newCardsPerDay || 10) - (log.newSeen || 0));
  const due = Object.keys(p.srs)
    .filter((id) => srs.isDue(p.srs[id], now))
    .sort((a, b) => p.srs[a].due - p.srs[b].due)
    .filter((id) => {
      if (p.srs[id].last !== null) return true;
      if (newBudget > 0) { newBudget -= 1; return true; }
      return false;
    })
    .map((id) => ({ ...langs.pack().getItem(id), card: p.srs[id] }))
    .filter((x) => x.text);
  return limit ? due.slice(0, limit) : due;
}

function gradeCard(itemId, grade) {
  const p = load();
  const l = todayLog(p);
  if (p.srs[itemId] && p.srs[itemId].last === null) l.newSeen = (l.newSeen || 0) + 1;
  p.srs[itemId] = srs.review(p.srs[itemId], grade);
  l.reviews += 1;
  if (grade >= 3) l.correct += 1; else l.wrong += 1;
  return save(p);
}

function srsStats(p) {
  p = p || load();
  const ids = Object.keys(p.srs);
  const now = Date.now();
  let mature = 0; let newWaiting = 0;
  ids.forEach((id) => {
    if (srs.isMature(p.srs[id])) mature += 1;
    if (p.srs[id].last === null && srs.isDue(p.srs[id], now)) newWaiting += 1;
  });
  // newWaiting 是"还没学过且已到期"的卡；due 里既有新卡也有复习卡，
  // 直接相减会把复习卡也扣掉，排队数被严重低估甚至压成 0。只减今天已放出的新卡。
  const dueList = dueCards(p);
  const releasedNew = dueList.filter((x) => x.card && x.card.last === null).length;
  return { total: ids.length, due: dueList.length, mature, newWaiting: Math.max(0, newWaiting - releasedNew) };
}

function recordQuiz(unit, score, total) {
  const p = load();
  p.quizScores.push({ unit, score, total, date: todayStr() });
  return save(p);
}

function completeReflection(key) {
  const p = load();
  p.reflections[key] = todayStr();
  return save(p);
}

function completeMission(key) {
  const p = load();
  p.missions[key] = todayStr();
  return save(p);
}

// 字母批次完成记录。字段名 fidelGroupsDone 沿用老名字，本地和云端老数据才能直接读
function completeAlphabetGroup(group) {
  const p = load();
  p.fidelGroupsDone[group] = todayStr();
  return save(p);
}

module.exports = {
  todayStr, keyOf, load, save, reset, replace, sanitize, isEmpty, setOnSaved, currentPosition, todayLog, addMinutes, streak,
  learnUnit, dueCards, gradeCard, srsStats, recordQuiz, completeMission, completeReflection, completeAlphabetGroup
};
