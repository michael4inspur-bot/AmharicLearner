const progress = require('../../utils/progress.js');
const points = require('../../utils/points.js');
const vocab = require('../../data/vocab.js');
const audio = require('../../utils/audio.js');

const SEG_COUNT = 15;

/** 分段进度条：已答薄荷、当前橙、未到桃 */
function buildSegs(done, total) {
  const t = Math.max(total || 0, 1);
  const filled = Math.min(SEG_COUNT, Math.floor((Math.min(done, t) / t) * SEG_COUNT));
  const segs = [];
  for (let i = 0; i < SEG_COUNT; i += 1) {
    segs.push({ k: i, s: i < filled ? 'done' : i === filled ? 'now' : '' });
  }
  return segs;
}

function todayStars() {
  const p = progress.load();
  return (p.starLog && p.starLog[progress.todayStr()]) || 0;
}

function withUnit(c) {
  const u = vocab.getUnit(c.unit);
  return { ...c, unitTitle: u ? u.title : '闪卡复习' };
}

Page({
  data: {
    queue: [], current: null, flipped: false,
    stats: { total: 0, due: 0, mature: 0, newWaiting: 0 },
    done: 0, sessionTotal: 0, pos: 0, sessionCorrect: 0, sessionWrong: 0,
    mode: 'am', segs: buildSegs(0, 0), todayStars: 0
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().select('/pages/review/review');
    this.loadQueue();
    this.enterAt = Date.now();
  },
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
    const queue = progress.dueCards(p, 30).map(withUnit);
    const done = this.data.done;
    const sessionTotal = Math.max(this.data.sessionTotal, done + queue.length);
    this.setData({
      queue,
      current: queue[0] || null,
      flipped: false,
      stats: progress.srsStats(p),
      done,
      sessionTotal,
      pos: Math.min(done + (queue.length ? 1 : 0), sessionTotal),
      segs: buildSegs(done, sessionTotal),
      todayStars: todayStars()
    });
    this.autoPlay();
  },
  /** "先听再看"模式：显示新卡时自动播一次 */
  autoPlay() {
    const cur = this.data.current;
    if (this.data.mode === 'listen' && cur && cur.am) audio.speak(cur.am);
  },
  /** 播当前卡的阿姆哈拉语（catchtap，不触发翻面） */
  play() {
    const cur = this.data.current;
    if (cur && cur.am) audio.speak(cur.am);
  },
  /** 去跟读评分页 */
  goSpeak() {
    const cur = this.data.current;
    if (cur) wx.navigateTo({ url: '/pages/speak/speak?id=' + cur.id });
  },
  flip() { if (!this.data.flipped) this.setData({ flipped: true }); },
  setMode(e) {
    const mode = e.currentTarget.dataset.m;
    if (mode === this.data.mode) return;
    this.setData({ mode, flipped: false });
    this.autoPlay();
  },
  grade(e) {
    const g = Number(e.currentTarget.dataset.g);
    const cur = this.data.current;
    if (!cur) return;
    progress.gradeCard(cur.id, g);
    const had = this.data.queue.length;
    const queue = this.data.queue.slice(1);
    // 忘了的卡放回队尾，本次学习内再见一次
    if (g < 3) queue.push({ ...cur, again: true });
    const done = this.data.done + (cur.again ? 0 : 1);
    const sessionTotal = Math.max(this.data.sessionTotal, done + queue.length);
    // 一次学习会话内到期归零时加一次星
    if (had > 0 && queue.length === 0 && !this.cleared) {
      this.cleared = true;
      points.award('review_clear');
      points.celebrate();
    }
    this.setData({
      queue,
      current: queue[0] || null,
      flipped: false,
      done,
      sessionTotal,
      pos: Math.min(done + (queue.length ? 1 : 0), sessionTotal),
      segs: buildSegs(done, sessionTotal),
      sessionCorrect: this.data.sessionCorrect + (g >= 3 ? 1 : 0),
      sessionWrong: this.data.sessionWrong + (g < 3 ? 1 : 0),
      stats: progress.srsStats(),
      todayStars: todayStars()
    });
    this.autoPlay();
  },
  goLessons() { wx.switchTab({ url: '/pages/lessons/lessons' }); },
  goQuiz() { wx.navigateTo({ url: '/pages/quiz/quiz?scope=all' }); }
});
