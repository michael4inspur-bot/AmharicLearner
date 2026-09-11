// SM-2 间隔重复算法（Anki 同源）。评分：1 忘了、3 模糊、5 记得。
const DAY = 24 * 60 * 60 * 1000;

function newCard(now) {
  return { ef: 2.5, interval: 0, reps: 0, lapses: 0, due: now || Date.now(), last: null };
}

/**
 * @param {object} card SRS 卡片状态
 * @param {number} grade 0–5
 * @param {number} [now]
 */
function review(card, grade, now) {
  now = now || Date.now();
  const c = { ...(card || newCard(now)) };
  if (grade < 3) {
    c.reps = 0;
    c.interval = 0;
    c.lapses = (c.lapses || 0) + 1;
    // 忘了：10 分钟后再出现（同一次学习内可再复习）
    c.due = now + 10 * 60 * 1000;
  } else {
    if (c.reps === 0) c.interval = 1;
    else if (c.reps === 1) c.interval = grade >= 5 ? 4 : 3;
    else c.interval = Math.round(c.interval * c.ef);
    c.reps += 1;
    c.due = now + c.interval * DAY;
  }
  c.ef = Math.max(1.3, c.ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  c.last = now;
  return c;
}

function isDue(card, now) {
  return !card || card.due <= (now || Date.now());
}

function isMature(card) {
  return !!card && card.interval >= 21;
}

module.exports = { newCard, review, isDue, isMature, DAY };
