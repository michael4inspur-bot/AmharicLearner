const progress = require('../../utils/progress.js');
const quiz = require('../../utils/quiz.js');
const points = require('../../utils/points.js');
const vocab = require('../../data/vocab.js');
const audio = require('../../utils/audio.js');

Page({
  data: { questions: [], idx: 0, picked: null, score: 0, finished: false, scope: 'all', title: '', pct: 0, earned: 0 },
  onLoad(q) {
    const scope = q.scope || 'all';
    const p = progress.load();
    const questions = quiz.buildQuiz(scope, 10, p);
    const u = vocab.getUnit(scope);
    const title = u ? u.title : scope.startsWith('week:') ? `第 ${scope.slice(5)} 周综合` : '综合';
    wx.setNavigationBarTitle({ title: `小测 · ${title}` });
    this.enterAt = Date.now();
    this.setData({ questions, scope, title, current: questions[0] });
    this.autoPlay();
  },
  onUnload() { audio.stop(); },
  /** 听力题：切到该题时自动播一次 */
  autoPlay() {
    const cur = this.data.current;
    if (cur && cur.listen && cur.audioText) audio.speak(cur.audioText);
  },
  /** 听力题大圆钮与题面小喇叭共用：播当前题的阿姆哈拉语 */
  playCurrent() {
    const cur = this.data.current;
    if (!cur) return;
    audio.speak(cur.listen ? cur.audioText : cur.promptAm);
  },
  pick(e) {
    if (this.data.picked) return;
    const id = e.currentTarget.dataset.id;
    const cur = this.data.current;
    const correct = id === cur.answer;
    // 小测也反馈给 SRS：答对 4，答错 1（只对已加入复习的卡）
    const p = progress.load();
    if (p.srs[cur.id]) progress.gradeCard(cur.id, correct ? 4 : 1);
    this.setData({ picked: id, score: this.data.score + (correct ? 1 : 0), correct });
  },
  next() {
    const idx = this.data.idx + 1;
    if (idx >= this.data.questions.length) {
      const total = this.data.questions.length;
      progress.recordQuiz(this.data.scope, this.data.score, total);
      const min = Math.max(1, Math.round((Date.now() - this.enterAt) / 60000));
      progress.addMinutes(Math.min(min, 15));
      const pct = Math.round((this.data.score / total) * 100);
      let earned = points.award('quiz');
      if (pct >= 80) earned += points.award('quiz_bonus');
      points.celebrate();
      this.setData({ finished: true, pct, earned });
      return;
    }
    this.setData({ idx, current: this.data.questions[idx], picked: null, correct: null });
    this.autoPlay();
  },
  again() { wx.redirectTo({ url: `/pages/quiz/quiz?scope=${this.data.scope}` }); },
  back() { wx.navigateBack(); }
});
