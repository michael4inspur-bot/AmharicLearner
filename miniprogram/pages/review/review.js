const progress = require('../../utils/progress.js');

Page({
  data: { queue: [], current: null, flipped: false, stats: { total: 0, due: 0, mature: 0 }, done: 0, sessionCorrect: 0, sessionWrong: 0, mode: 'am' },
  onShow() { this.loadQueue(); this.enterAt = Date.now(); },
  onHide() { this.flushMinutes(); },
  onUnload() { this.flushMinutes(); },
  flushMinutes() {
    if (!this.enterAt) return;
    const min = Math.round((Date.now() - this.enterAt) / 60000);
    if (min > 0) progress.addMinutes(Math.min(min, 30));
    this.enterAt = Date.now();
  },
  loadQueue() {
    const p = progress.load();
    const queue = progress.dueCards(p, 30);
    this.setData({ queue, current: queue[0] || null, flipped: false, stats: progress.srsStats(p) });
  },
  flip() { this.setData({ flipped: true }); },
  toggleMode() { this.setData({ mode: this.data.mode === 'am' ? 'zh' : 'am', flipped: false }); },
  grade(e) {
    const g = Number(e.currentTarget.dataset.g);
    const cur = this.data.current;
    if (!cur) return;
    progress.gradeCard(cur.id, g);
    const queue = this.data.queue.slice(1);
    // 忘了的卡放回队尾，本次学习内再见一次
    if (g < 3) queue.push({ ...cur, again: true });
    this.setData({
      queue,
      current: queue[0] || null,
      flipped: false,
      done: this.data.done + (cur.again ? 0 : 1),
      sessionCorrect: this.data.sessionCorrect + (g >= 3 ? 1 : 0),
      sessionWrong: this.data.sessionWrong + (g < 3 ? 1 : 0),
      stats: progress.srsStats()
    });
  },
  goLessons() { wx.switchTab({ url: '/pages/lessons/lessons' }); },
  goQuiz() { wx.navigateTo({ url: '/pages/quiz/quiz?scope=all' }); }
});
