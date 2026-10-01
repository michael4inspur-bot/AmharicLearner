const progress = require('../../utils/progress.js');
const langs = require('../../langs/index.js');

Page({
  data: { weeks: [] },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().select('/pages/lessons/lessons');
    this.setData(langs.view());
    const pk = langs.pack();
    const p = progress.load();
    const pos = progress.currentPosition(p);
    const best = {};
    p.quizScores.forEach((q) => {
      const pct = Math.round((q.score / q.total) * 100);
      best[q.unit] = Math.max(best[q.unit] || 0, pct);
    });
    const unitRow = (id) => {
      const u = pk.getUnit(id);
      return { id, title: u.title, scene: u.scene, count: u.items.length, learned: !!p.unitsLearned[id], best: best[id] };
    };
    const weeks = pk.plan.weeks.map((w) => ({
      ...w,
      current: w.week === pos.week,
      unitList: w.units.map(unitRow),
      extraUnit: w.extra ? unitRow(w.extra) : null
    }));
    this.setData({ weeks, pos, alphabetName: pk.alphabet.name });
  },
  open(e) { wx.navigateTo({ url: `/pages/lesson/lesson?id=${e.currentTarget.dataset.id}` }); },
  goAlphabet(e) { wx.navigateTo({ url: `${langs.pack().alphabet.page}?group=${e.currentTarget.dataset.group}` }); },
  goPlan() { wx.navigateTo({ url: '/pages/plan/plan' }); },
  goSearch() { wx.navigateTo({ url: '/pages/search/search' }); }
});
