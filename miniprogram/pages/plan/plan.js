const progress = require('../../utils/progress.js');
const langs = require('../../langs/index.js');

Page({
  data: { weeks: [], principles: [], showPrinciples: false, daily: {} },
  onLoad() {
    const pk = langs.pack();
    this.setData({ principles: pk.plan.principles, daily: pk.plan.DAILY_TEMPLATE });
  },
  onShow() {
    const pk = langs.pack();
    const p = progress.load();
    const pos = progress.currentPosition(p);
    const weeks = pk.plan.weeks.map((w) => ({
      ...w,
      status: w.week < pos.week ? 'past' : w.week === pos.week ? 'current' : 'future',
      unitTitles: w.units.map((id) => pk.getUnit(id).title).join(' · ') || '不加新词',
      extraTitle: w.extra ? pk.getUnit(w.extra).title : '',
      unitsDone: w.units.filter((id) => p.unitsLearned[id]).length,
      missionDone: !!p.missions[`w${w.week}`]
    }));
    this.setData({ weeks, pos, goal: p.dailyMinutesGoal, newCards: p.newCardsPerDay });
  },
  togglePrinciples() { this.setData({ showPrinciples: !this.data.showPrinciples }); }
});
