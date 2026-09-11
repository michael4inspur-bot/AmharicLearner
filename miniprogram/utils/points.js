// 星星积分与徽章。只依赖 progress.js，不被它依赖。
const progress = require('./progress.js');

const STAR_RULES = {
  review_clear: 10, // 清空当日到期卡
  learn_unit: 30,   // 首次学完单元
  quiz: 20,         // 完成小测
  quiz_bonus: 10,   // 小测 ≥ 80%
  mission: 40,      // 实战任务
  score: 8,         // 跟读评分一次
  fidel: 15         // Fidel 批次通过
};

function ensure(p) {
  if (typeof p.stars !== 'number') p.stars = 0;
  if (!p.starLog) p.starLog = {};
  if (!p.badges) p.badges = {};
  return p;
}

/** 加星并保存；返回本次加的星数 */
function award(kind, times) {
  const n = (STAR_RULES[kind] || 0) * (times || 1);
  if (!n) return 0;
  const p = ensure(progress.load());
  p.stars += n;
  const k = progress.todayStr();
  p.starLog[k] = (p.starLog[k] || 0) + n;
  progress.save(p);
  return n;
}

function bestQuiz(p, unit) {
  return p.quizScores.filter((q) => q.unit === unit).reduce((m, q) => Math.max(m, Math.round((q.score / q.total) * 100)), 0);
}

const BADGES = [
  { id: 'first-words', name: '开口者', desc: '完成第 1 周实战任务',
    progress: (p) => ({ done: !!p.missions.w1, text: '完成第 1 周实战任务' }) },
  { id: 'streak-7', name: '七日连续', desc: '连续学习 7 天',
    progress: (p) => { const s = progress.streak(p); return { done: s >= 7, text: `再坚持 ${Math.max(0, 7 - s)} 天` }; } },
  { id: 'streak-14', name: '两周不断', desc: '连续学习 14 天',
    progress: (p) => { const s = progress.streak(p); return { done: s >= 14, text: `再坚持 ${Math.max(0, 14 - s)} 天` }; } },
  { id: 'phone-pro', name: '电话达人', desc: '学完「电话与沟通」且小测 ≥ 80%',
    progress: (p) => { const b = bestQuiz(p, 'u15'); return { done: !!p.unitsLearned.u15 && b >= 80, text: p.unitsLearned.u15 ? `小测最好 ${b}%，目标 80%` : '学完「电话与沟通」' }; } },
  { id: 'site-lead', name: '现场指挥', desc: '学完「现场与班组」并完成第 4 周实战',
    progress: (p) => ({ done: !!p.unitsLearned.u14 && !!p.missions.w4, text: p.unitsLearned.u14 ? '完成第 4 周实战任务' : '学完「现场与班组」' }) },
  { id: 'formal-master', name: '敬语大师', desc: '学完「正式场合与敬语」且小测 ≥ 80%',
    progress: (p) => { const b = bestQuiz(p, 'u16'); return { done: !!p.unitsLearned.u16 && b >= 80, text: p.unitsLearned.u16 ? `小测最好 ${b}%，目标 80%` : '学完「正式场合与敬语」' }; } },
  { id: 'hundred-words', name: '百词斩', desc: '闪卡累计 100 张',
    progress: (p) => { const n = Object.keys(p.srs).length; return { done: n >= 100, text: `已 ${n} / 100 张` }; } },
  { id: 'star-collector', name: '星星收藏家', desc: '累计 500 颗星',
    progress: (p) => ({ done: (p.stars || 0) >= 500, text: `已 ${p.stars || 0} / 500 颗` }) }
];

/** 检查并记录新获得的徽章，返回新徽章数组 */
function checkBadges() {
  const p = ensure(progress.load());
  const fresh = [];
  BADGES.forEach((b) => {
    if (p.badges[b.id]) return;
    if (b.progress(p).done) { p.badges[b.id] = progress.todayStr(); fresh.push(b); }
  });
  if (fresh.length) progress.save(p);
  return fresh;
}

/** 最接近的未获得徽章及进度文案 */
function nextBadge(p) {
  p = ensure(p || progress.load());
  const order = ['first-words', 'streak-7', 'phone-pro', 'site-lead', 'hundred-words', 'formal-master', 'streak-14', 'star-collector'];
  for (const id of order) {
    if (p.badges[id]) continue;
    const b = BADGES.find((x) => x.id === id);
    const pr = b.progress(p);
    if (!pr.done) return { id, name: b.name, hint: `${pr.text}解锁「${b.name}」` };
  }
  return null;
}

function allBadges(p) {
  p = ensure(p || progress.load());
  return BADGES.map((b) => ({ id: b.id, name: b.name, desc: b.desc, earned: p.badges[b.id] || null, hint: b.progress(p).text }));
}

/** 统一的“完成后弹徽章”提示 */
function celebrate() {
  const fresh = checkBadges();
  if (fresh.length && typeof wx !== 'undefined' && wx.showModal) {
    wx.showModal({ title: `获得徽章「${fresh[0].name}」`, content: fresh[0].desc, showCancel: false, confirmText: 'ጥሩ ስራ!' });
  }
  return fresh;
}

module.exports = { STAR_RULES, BADGES, award, checkBadges, nextBadge, allBadges, celebrate };
