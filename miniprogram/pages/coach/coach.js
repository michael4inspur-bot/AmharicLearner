const progress = require('../../utils/progress.js');
const plan = require('../../data/plan.js');
const api = require('../../utils/api.js');
const audio = require('../../utils/audio.js');

const CHAT_KEY = 'coach_chat_v1';
const AM_RE = /[ሀ-፿][ሀ-፿\s፡።፣?!,.]*/g;

/** 从教练回复中提取埃塞文字片段：去首尾空白、去重、长度 ≥ 2 */
function extractAmharic(text) {
  const out = [];
  const seen = {};
  const matches = String(text == null ? '' : text).match(AM_RE) || [];
  matches.forEach((m) => {
    const t = m.trim();
    if (t.length < 2 || seen[t]) return;
    seen[t] = true;
    out.push(t);
  });
  return out;
}

/** assistant 消息补 am 字段（可朗读片段） */
function withAm(msg) {
  if (!msg || msg.role !== 'assistant') return msg;
  return { ...msg, am: extractAmharic(msg.content) };
}

/** 诊断分数 → conic-gradient 角度（0-360） */
function scoreToDeg(diagnosis) {
  const n = diagnosis && typeof diagnosis.score === 'number' ? diagnosis.score : 0;
  return Math.round(Math.max(0, Math.min(100, n)) * 3.6);
}

const QUICK = [
  '"这个多少钱，便宜点"怎么说？',
  '帮我练一段打车对话',
  '我总记不住数字，怎么办？',
  '对女性说"谢谢，再见"怎么说？',
  '埃塞时间 8 点是国际几点？'
];

Page({
  data: { tab: 'diagnose', diagnosis: null, adjustment: null, scoreDeg: 0, selfReport: '', request: '', loading: '', messages: [], input: '', quick: QUICK, history: [], scrollTo: '' },
  onLoad() {
    let messages = [];
    try { messages = wx.getStorageSync(CHAT_KEY) || []; } catch (e) { /* ignore */ }
    if (!Array.isArray(messages)) messages = [];
    this.setData({ messages: messages.map(withAm) });
  },
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
  onInput(e) { this.setData({ input: e.detail.value }); },

  fail(err) {
    this.setData({ loading: '' });
    const msg = err.message || '请求失败';
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
  },

  quickAsk(e) { this.setData({ input: e.currentTarget.dataset.q }); this.send(); },

  async send() {
    const text = (this.data.input || '').trim();
    if (!text || this.data.loading) return;
    const messages = [...this.data.messages, { role: 'user', content: text }];
    this.setData({ messages, input: '', loading: 'chat', scrollTo: `m${messages.length - 1}` });
    try {
      const { reply } = await api.chat(messages.slice(-12), progress.summary());
      const next = [...messages, withAm({ role: 'assistant', content: reply })].slice(-40);
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

  copy(e) { wx.setClipboardData({ data: e.currentTarget.dataset.text }); },
  playAm(e) { audio.speak(e.currentTarget.dataset.text); }
});
