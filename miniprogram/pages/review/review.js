const progress = require('../../utils/progress.js');
const audio = require('../../utils/audio.js');

const MODES = ['am', 'zh', 'listen'];

Page({
  data: { queue: [], current: null, flipped: false, stats: { total: 0, due: 0, mature: 0 }, done: 0, sessionCorrect: 0, sessionWrong: 0, mode: 'am' },
  onShow() { this.loadQueue(); this.enterAt = Date.now(); },
  onHide() { this.flushMinutes(); audio.stop(); },
  onUnload() { this.flushMinutes(); audio.stop(); },
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
    this.autoPlay();
  },
  /** "先听再看"模式：显示新卡时自动播一次 */
  autoPlay() {
    const cur = this.data.current;
    if (this.data.mode === 'listen' && cur && cur.am) audio.speak(cur.am);
  },
  /** 🔊：播当前卡的阿姆哈拉语（catchtap，不触发翻面） */
  play() {
    const cur = this.data.current;
    if (cur && cur.am) audio.speak(cur.am);
  },
  /** 🎤：去跟读评分页 */
  goSpeak() {
    const cur = this.data.current;
    if (cur) wx.navigateTo({ url: '/pages/speak/speak?id=' + cur.id });
  },
  flip() { this.setData({ flipped: true }); },
  toggleMode() {
    const mode = MODES[(MODES.indexOf(this.data.mode) + 1) % MODES.length];
    this.setData({ mode, flipped: false });
    this.autoPlay();
  },
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
    this.autoPlay();
  },
  goLessons() { wx.switchTab({ url: '/pages/lessons/lessons' }); },
  goQuiz() { wx.navigateTo({ url: '/pages/quiz/quiz?scope=all' }); }
});
