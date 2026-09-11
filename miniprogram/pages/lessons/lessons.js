const progress = require('../../utils/progress.js');
const plan = require('../../data/plan.js');
const vocab = require('../../data/vocab.js');

Page({
  data: { weeks: [] },
  onShow() {
    const p = progress.load();
    const pos = progress.currentPosition(p);
    const best = {};
    p.quizScores.forEach((q) => {
      const pct = Math.round((q.score / q.total) * 100);
      best[q.unit] = Math.max(best[q.unit] || 0, pct);
    });
    const unitRow = (id) => {
      const u = vocab.getUnit(id);
      return { id, title: u.title, scene: u.scene, count: u.items.length, learned: !!p.unitsLearned[id], best: best[id] };
    };
    const weeks = plan.weeks.map((w) => ({
      ...w,
      current: w.week === pos.week,
      unitList: w.units.map(unitRow),
      extraUnit: w.extra ? unitRow(w.extra) : null
    }));
    this.setData({ weeks, pos });
  },
  open(e) { wx.navigateTo({ url: `/pages/lesson/lesson?id=${e.currentTarget.dataset.id}` }); },
  goFidel(e) { wx.navigateTo({ url: `/pages/fidel/fidel?group=${e.currentTarget.dataset.group}` }); },
  goPlan() { wx.navigateTo({ url: '/pages/plan/plan' }); },
  goSearch() { wx.navigateTo({ url: '/pages/search/search' }); }
});
