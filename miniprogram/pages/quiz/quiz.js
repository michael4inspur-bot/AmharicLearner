const progress = require('../../utils/progress.js');
const quiz = require('../../utils/quiz.js');
const vocab = require('../../data/vocab.js');

Page({
  data: { questions: [], idx: 0, picked: null, score: 0, finished: false, scope: 'all', title: '' },
  onLoad(q) {
    const scope = q.scope || 'all';
    const p = progress.load();
    const questions = quiz.buildQuiz(scope, 10, p);
    const u = vocab.getUnit(scope);
    const title = u ? u.title : scope.startsWith('week:') ? `第 ${scope.slice(5)} 周综合` : '综合';
    wx.setNavigationBarTitle({ title: `小测 · ${title}` });
    this.enterAt = Date.now();
    this.setData({ questions, scope, title, current: questions[0] });
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
      this.setData({ finished: true, pct: Math.round((this.data.score / total) * 100) });
      return;
    }
    this.setData({ idx, current: this.data.questions[idx], picked: null, correct: null });
  },
  again() { wx.redirectTo({ url: `/pages/quiz/quiz?scope=${this.data.scope}` }); },
  back() { wx.navigateBack(); }
});
