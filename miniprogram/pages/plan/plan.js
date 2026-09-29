const plan = require('../../data/plan.js');
const progress = require('../../utils/progress.js');
const vocab = require('../../data/vocab.js');

Page({
  data: { weeks: [], principles: plan.principles, showPrinciples: false, daily: plan.DAILY_TEMPLATE },
  onShow() {
    const p = progress.load();
    const pos = progress.currentPosition(p);
    const weeks = plan.weeks.map((w) => ({
      ...w,
      status: w.week < pos.week ? 'past' : w.week === pos.week ? 'current' : 'future',
      unitTitles: w.units.map((id) => vocab.getUnit(id).title).join(' · ') || '不加新词',
      extraTitle: w.extra ? vocab.getUnit(w.extra).title : '',
      unitsDone: w.units.filter((id) => p.unitsLearned[id]).length,
      missionDone: !!p.missions[`w${w.week}`]
    }));
    this.setData({ weeks, pos, goal: p.dailyMinutesGoal, newCards: p.newCardsPerDay });
  },
  togglePrinciples() { this.setData({ showPrinciples: !this.data.showPrinciples }); }
});
