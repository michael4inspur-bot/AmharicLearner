// 学习进度：本地存储（wx.storage）为主，后台同步为辅。
const vocab = require('../data/vocab.js');
const plan = require('../data/plan.js');
const srs = require('./srs.js');

const KEY = 'progress_v1';
const DAY = srs.DAY;

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

let cache = null;

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

function load() {
  if (cache) return cache;
  try {
    cache = sanitize(wx.getStorageSync(KEY));
  } catch (e) {
    cache = defaultProgress();
  }
  return cache;
}

let onSaved = null;
function setOnSaved(fn) { onSaved = fn; }

function save(p) {
  cache = p;
  try { wx.setStorageSync(KEY, p); } catch (e) { /* ignore */ }
  if (onSaved) onSaved(p);
  return p;
}

function reset() {
  cache = null;
  try { wx.removeStorageSync(KEY); } catch (e) { /* ignore */ }
  return load();
}

function replace(p) {
  const local = load();
  const next = sanitize(p);
  // 云端快照可能早于积分功能，缺这三个字段。浅合并会把本机已得的星星和徽章清零且不可逆，
  // 所以云端没有时保留本机的。
  if (!p || typeof p !== 'object' || p.stars == null) next.stars = local.stars || 0;
  if (!p || !p.starLog) next.starLog = local.starLog || {};
  if (!p || !p.badges) next.badges = local.badges || {};
  cache = null;
  return save(next);
}

// ---------- 当前周 / 天 ----------
function currentPosition(p) {
  p = p || load();
  const start = new Date(p.startDate + 'T00:00:00');
  const diff = Math.max(0, Math.floor((Date.now() - start.getTime()) / DAY));
  const week = Math.min(plan.weeks.length, Math.floor(diff / 7) + 1);
  const day = diff >= plan.weeks.length * 7 ? 7 : (diff % 7) + 1;
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
  const u = vocab.getUnit(unitId);
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
    .map((id) => ({ ...vocab.getItem(id), card: p.srs[id] }))
    .filter((x) => x.am);
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

function completeFidelGroup(group) {
  const p = load();
  p.fidelGroupsDone[group] = todayStr();
  return save(p);
}

// ---------- 给 AI 的摘要 ----------
function summary(p) {
  p = p || load();
  const pos = currentPosition(p);
  const plannedUnits = plan.weeks.slice(0, pos.week).flatMap((w) => w.units);
  const learned = Object.keys(p.unitsLearned);
  const titles = (ids) => ids.map((id) => { const u = vocab.getUnit(id); return u ? `${id} ${u.title}` : id; });

  const quizByUnit = {};
  p.quizScores.forEach((q) => {
    const k = q.unit;
    if (!quizByUnit[k]) quizByUnit[k] = { unit: k, attempts: 0, best: 0, last: 0 };
    const pct = Math.round((q.score / q.total) * 100);
    quizByUnit[k].attempts += 1;
    quizByUnit[k].best = Math.max(quizByUnit[k].best, pct);
    quizByUnit[k].last = pct;
  });

  const days14 = [];
  let correct7 = 0; let wrong7 = 0;
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = todayStr(d);
    const l = p.logs[k] || { minutes: 0, correct: 0, wrong: 0 };
    days14.push({ date: k.slice(5), minutes: l.minutes });
    if (i < 7) { correct7 += l.correct; wrong7 += l.wrong; }
  }
  const retention7d = correct7 + wrong7 ? Math.round((correct7 / (correct7 + wrong7)) * 100) : null;

  const weakItems = Object.keys(p.srs)
    .map((id) => ({ id, lapses: p.srs[id].lapses || 0 }))
    .filter((x) => x.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses)
    .slice(0, 10)
    .map((x) => { const it = vocab.getItem(x.id); return it ? { am: it.am, zh: it.zh, lapses: x.lapses } : null; })
    .filter(Boolean);

  const stats = srsStats(p);
  return {
    today: todayStr(),
    startDate: p.startDate,
    currentWeek: pos.week,
    currentDay: pos.day,
    dailyMinutesGoal: p.dailyMinutesGoal,
    newCardsPerDay: p.newCardsPerDay,
    streak: streak(p),
    unitsPlannedSoFar: titles(plannedUnits),
    unitsLearned: titles(learned),
    unitsBehind: titles(plannedUnits.filter((id) => !p.unitsLearned[id])),
    quiz: Object.values(quizByUnit),
    srs: { total: stats.total, due: stats.due, mature: stats.mature, retention7d, wrong7d: wrong7, reviews7d: correct7 + wrong7 },
    minutesLast14: days14,
    missionsDone: Object.keys(p.missions),
    fidelGroupsDone: Object.keys(p.fidelGroupsDone).map(Number),
    weakItems,
  };
}

module.exports = {
  todayStr, load, save, reset, replace, sanitize, isEmpty, setOnSaved, currentPosition, todayLog, addMinutes, streak,
  learnUnit, dueCards, gradeCard, srsStats, recordQuiz, completeMission, completeReflection, completeFidelGroup,
  completeReflection, summary
};
