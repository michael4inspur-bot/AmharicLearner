const progress = require('../../utils/progress.js');
const plan = require('../../data/plan.js');
const api = require('../../utils/api.js');

const CHAT_KEY = 'coach_chat_v1';
const QUICK = [
  '"这个多少钱，便宜点"怎么说？',
  '帮我练一段打车对话',
  '我总记不住数字，怎么办？',
  '对女性说"谢谢，再见"怎么说？',
  '埃塞时间 8 点是国际几点？'
];

Page({
  data: { tab: 'diagnose', diagnosis: null, adjustment: null, selfReport: '', request: '', loading: '', messages: [], input: '', quick: QUICK, history: [], scrollTo: '' },
  onLoad() {
    let messages = [];
    try { messages = wx.getStorageSync(CHAT_KEY) || []; } catch (e) { /* ignore */ }
    this.setData({ messages });
  },
  onShow() {
    const p = progress.load();
    const latestDiag = p.aiHistory.find((h) => h.type === 'diagnosis');
    const latestAdj = p.aiHistory.find((h) => h.type === 'plan');
    this.setData({
      selfReport: p.selfReport || '',
      diagnosis: this.data.diagnosis || (latestDiag ? latestDiag.result : null),
      adjustment: this.data.adjustment || (latestAdj ? latestAdj.result : null),
      history: p.aiHistory.slice(0, 10).map((h) => ({ ...h, dateShort: (h.date || '').slice(0, 10), label: h.type === 'diagnosis' ? '诊断' : '计划调整' })),
      overridesApplied: !!p.planOverrides
    });
  },
  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); },
  onSelfReport(e) { this.setData({ selfReport: e.detail.value }); },
  onRequest(e) { this.setData({ request: e.detail.value }); },
  onInput(e) { this.setData({ input: e.detail.value }); },

  fail(err) {
    this.setData({ loading: '' });
    const msg = err.message || '请求失败';
    wx.showModal({ title: 'AI 请求失败', content: msg.includes('example.com') || msg.includes('网络') || msg.includes('url') ? `${msg}\n\n请先到"我的"页面设置后台地址。` : msg, showCancel: false });
  },

  async diagnose() {
    progress.setSelfReport(this.data.selfReport);
    this.setData({ loading: 'diagnose' });
    try {
      const summary = progress.summary();
      const { diagnosis } = await api.diagnose(summary, plan.planOutline());
      progress.pushAi({ type: 'diagnosis', date: new Date().toISOString(), result: diagnosis });
      progress.addMinutes(3);
      this.setData({ diagnosis, loading: '' });
      this.onShow();
    } catch (err) { this.fail(err); }
  },

  async adjust() {
    progress.setSelfReport(this.data.selfReport);
    this.setData({ loading: 'adjust' });
    try {
      const summary = progress.summary();
      const { adjustment } = await api.adjustPlan(summary, plan.planOutline(), this.data.diagnosis, this.data.request);
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
  },

  quickAsk(e) { this.setData({ input: e.currentTarget.dataset.q }); this.send(); },

  async send() {
    const text = (this.data.input || '').trim();
    if (!text || this.data.loading) return;
    const messages = [...this.data.messages, { role: 'user', content: text }];
    this.setData({ messages, input: '', loading: 'chat', scrollTo: `m${messages.length - 1}` });
    try {
      const { reply } = await api.chat(messages.slice(-12), progress.summary());
      const next = [...messages, { role: 'assistant', content: reply }].slice(-40);
      try { wx.setStorageSync(CHAT_KEY, next); } catch (e) { /* ignore */ }
      progress.addMinutes(1);
      this.setData({ messages: next, loading: '', scrollTo: `m${next.length - 1}` });
    } catch (err) {
      this.setData({ messages: this.data.messages.slice(0, -1), input: text });
      this.fail(err);
    }
  },

  clearChat() {
    try { wx.removeStorageSync(CHAT_KEY); } catch (e) { /* ignore */ }
    this.setData({ messages: [] });
  },

  copy(e) { wx.setClipboardData({ data: e.currentTarget.dataset.text }); }
});
