const progress = require('../../utils/progress.js');
const plan = require('../../data/plan.js');
const api = require('../../utils/api.js');
const account = require('../../utils/account.js');

/** 诊断分数 → conic-gradient 角度（0-360） */
function scoreToDeg(diagnosis) {
  const n = diagnosis && typeof diagnosis.score === 'number' ? diagnosis.score : 0;
  return Math.round(Math.max(0, Math.min(100, n)) * 3.6);
}

Page({
  data: { tab: 'diagnose', diagnosis: null, adjustment: null, scoreDeg: 0, selfReport: '', request: '', loading: '', history: [] },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().select('/pages/coach/coach');
    const p = progress.load();
    const latestDiag = p.aiHistory.find((h) => h.type === 'diagnosis');
    const latestAdj = p.aiHistory.find((h) => h.type === 'plan');
    const diagnosis = this.data.diagnosis || (latestDiag ? latestDiag.result : null);
    this.setData({
      selfReport: p.selfReport || '',
      diagnosis,
      scoreDeg: scoreToDeg(diagnosis),
      adjustment: this.data.adjustment || (latestAdj ? latestAdj.result : null),
      history: p.aiHistory.slice(0, 10).map((h) => ({ ...h, dateShort: (h.date || '').slice(0, 10), label: h.type === 'diagnosis' ? '诊断' : '计划调整' })),
      overridesApplied: !!p.planOverrides
    });
  },
  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); },
  onSelfReport(e) { this.setData({ selfReport: e.detail.value }); },
  onRequest(e) { this.setData({ request: e.detail.value }); },

  fail(err) {
    this.setData({ loading: '' });
    if (account.prompt(err, 'AI 教练')) return;
    const msg = err.message || '请求失败';
    const hint = err.code === 'NO_ENV' ? '\n\n请管理员在 miniprogram/config.js 填写云开发环境 id。' : '';
    wx.showModal({ title: 'AI 请求失败', content: msg + hint, showCancel: false });
  },

  async diagnose() {
    progress.setSelfReport(this.data.selfReport);
    this.setData({ loading: 'diagnose' });
    try {
      const summary = progress.summary();
      const diagnosis = await api.diagnose(summary, plan.planOutline());
      progress.pushAi({ type: 'diagnosis', date: new Date().toISOString(), result: diagnosis });
      progress.addMinutes(3);
      this.setData({ diagnosis, scoreDeg: scoreToDeg(diagnosis), loading: '' });
      this.onShow();
    } catch (err) { this.fail(err); }
  },

  async adjust() {
    progress.setSelfReport(this.data.selfReport);
    this.setData({ loading: 'adjust' });
    try {
      const summary = progress.summary();
      const adjustment = await api.adjustPlan(summary, plan.planOutline(), this.data.diagnosis, this.data.request);
      progress.pushAi({ type: 'plan', date: new Date().toISOString(), request: this.data.request, result: adjustment });
      this.setData({ adjustment, loading: '', tab: 'adjust' });
      this.onShow();
    } catch (err) { this.fail(err); }
  },

  applyAdjustment() {
    if (!this.data.adjustment) return;
    progress.applyPlanOverrides(this.data.adjustment);
    wx.showToast({ title: '已采纳，计划已更新', icon: 'none' });
    this.setData({ overridesApplied: true });
  }
});
