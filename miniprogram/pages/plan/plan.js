const plan = require('../../data/plan.js');
const progress = require('../../utils/progress.js');
const vocab = require('../../data/vocab.js');
const config = require('../../config.js');

Page({
  data: { aiEnabled: !!config.aiCoachEnabled, weeks: [], principles: plan.principles, showPrinciples: false, overrides: null, daily: plan.DAILY_TEMPLATE },
  onShow() {
    const p = progress.load();
    const pos = progress.currentPosition(p);
    const adj = p.planOverrides && p.planOverrides.week_adjustments ? p.planOverrides.week_adjustments : [];
    const weeks = plan.weeks.map((w) => ({
      ...w,
      status: w.week < pos.week ? 'past' : w.week === pos.week ? 'current' : 'future',
      unitTitles: w.units.map((id) => vocab.getUnit(id).title).join(' · ') || '不加新词',
      extraTitle: w.extra ? vocab.getUnit(w.extra).title : '',
      unitsDone: w.units.filter((id) => p.unitsLearned[id]).length,
      missionDone: !!p.missions[`w${w.week}`],
      adjustment: adj.find((a) => Number(a.week) === w.week) || null
    }));
    this.setData({ weeks, pos, overrides: p.planOverrides, goal: p.dailyMinutesGoal, newCards: p.newCardsPerDay });
  },
  togglePrinciples() { this.setData({ showPrinciples: !this.data.showPrinciples }); },
  goCoach() { wx.switchTab({ url: '/pages/coach/coach' }); },
  clearOverrides() {
    wx.showModal({
      title: '恢复默认计划',
      content: '将移除 AI 的调整，恢复每日 35 分钟 / 15 新词。',
      success: (r) => {
        if (!r.confirm) return;
        const p = progress.load();
        p.planOverrides = null; p.dailyMinutesGoal = 35; p.newCardsPerDay = 15;
        progress.save(p);
        this.onShow();
      }
    });
  }
});
