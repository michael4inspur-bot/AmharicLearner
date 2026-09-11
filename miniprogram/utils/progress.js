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
    dailyMinutesGoal: 20,
    newCardsPerDay: 10,
    unitsLearned: {},   // unitId -> date
    quizScores: [],     // {unit, score, total, date}
    srs: {},            // itemId -> card
    logs: {},           // date -> {minutes, reviews, correct, wrong, newCards}
    missions: {},       // missionKey -> date
    fidelGroupsDone: {},// group -> date
    aiHistory: [],      // {type, date, result, request}
    planOverrides: null,// AI 调整结果（用户点"采纳"后）
    selfReport: ''      // 用户自述困难
  };
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = wx.getStorageSync(KEY);
    cache = raw ? { ...defaultProgress(), ...raw } : defaultProgress();
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
  cache = null;
  return save({ ...defaultProgress(), ...p });
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
function todayLog(p) {
  p = p || load();
  const k = todayStr();
  if (!p.logs[k]) p.logs[k] = { minutes: 0, reviews: 0, correct: 0, wrong: 0, newCards: 0, newSeen: 0 };
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
  const log = todayLog(p);
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
  const due = dueCards(p).length;
  return { total: ids.length, due, mature, newWaiting: Math.max(0, newWaiting - due) };
}

function recordQuiz(unit, score, total) {
  const p = load();
  p.quizScores.push({ unit, score, total, date: todayStr() });
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

function setSelfReport(text) {
  const p = load();
  p.selfReport = text;
  return save(p);
}

function pushAi(entry) {
  const p = load();
  p.aiHistory.unshift(entry);
  p.aiHistory = p.aiHistory.slice(0, 20);
  return save(p);
}

function applyPlanOverrides(adjustment) {
  const p = load();
  p.planOverrides = { ...adjustment, appliedAt: todayStr() };
  if (adjustment.daily_minutes) p.dailyMinutesGoal = adjustment.daily_minutes;
  if (adjustment.new_words_per_day) p.newCardsPerDay = adjustment.new_words_per_day;
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
    selfReport: p.selfReport || '',
    planOverrides: p.planOverrides ? { summary: p.planOverrides.summary, appliedAt: p.planOverrides.appliedAt } : null
  };
}

module.exports = {
  todayStr, load, save, reset, replace, setOnSaved, currentPosition, todayLog, addMinutes, streak,
  learnUnit, dueCards, gradeCard, srsStats, recordQuiz, completeMission, completeFidelGroup,
  setSelfReport, pushAi, applyPlanOverrides, summary
};
