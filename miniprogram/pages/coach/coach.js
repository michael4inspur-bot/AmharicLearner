const progress = require('../../utils/progress.js');
const plan = require('../../data/plan.js');
const api = require('../../utils/api.js');

/** 诊断分数 → conic-gradient 角度（0-360） */
function scoreToDeg(diagnosis) {
  const n = diagnosis && typeof diagnosis.score === 'number' ? diagnosis.score : 0;
  return Math.round(Math.max(0, Math.min(100, n)) * 3.6);
}

Page({
  data: { tab: 'diagnose', diagnosis: null, adjustment: null, scoreDeg: 0, selfReport: '', request: '', loading: '', history: [] },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 3 });
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
    const msg = err.message || '请求失败';
    if (/登录/.test(msg)) {
      wx.showModal({ title: '请先登录', content: '到「我的」页点“微信登录”，登录后即可使用 AI 教练。', showCancel: false });
      return;
    }
    if (/批准/.test(msg)) {
      wx.showModal({ title: '等待管理员批准', content: '你的账号已登记，管理员批准后即可使用 AI 与语音。', showCancel: false });
      return;
    }
    if (/暂停|停用/.test(msg)) {
      wx.showModal({ title: '账号已被管理员暂停', content: '请联系管理员', showCancel: false });
      return;
    }
    const hint = err.code === 'NO_ENV' ? '\n\n请管理员在 miniprogram/config.js 填写云开发环境 id。' : '';
    const quota = /已用完/.test(String(err.message || '') + String(err.raw || ''));
    wx.showModal({ title: quota ? '今日额度已用完' : 'AI 请求失败', content: msg + hint, showCancel: false });
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
