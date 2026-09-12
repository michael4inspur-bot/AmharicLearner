const progress = require('../../utils/progress.js');
const api = require('../../utils/api.js');
const audio = require('../../utils/audio.js');
const points = require('../../utils/points.js');
const sync = require('../../utils/sync.js');

const PROFILE_KEY = 'profile_v1';

function loadNickname() {
  try { return String((wx.getStorageSync(PROFILE_KEY) || {}).nickname || ''); } catch (e) { return ''; }
}

function readProfile() {
  try { return wx.getStorageSync(PROFILE_KEY) || {}; } catch (e) { return {}; }
}

function saveNickname(nickname) {
  try { wx.setStorageSync(PROFILE_KEY, { ...(wx.getStorageSync(PROFILE_KEY) || {}), nickname }); } catch (e) { /* 忽略 */ }
}

Page({
  data: { cloudReady: false, goal: 20, newCards: 10, startDate: '', voice: 'female', rate: 'normal', stats: {}, streak: 0, totalMinutes: 0, days: 0, quizzes: 0, stars: 0, badges: [], earnedCount: 0, usage: null, isAdmin: false, nickname: '', openid: '', registered: false, status: 'active' },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 4 });
    const p = progress.load();
    const totalMinutes = Object.values(p.logs).reduce((a, l) => a + (l.minutes || 0), 0);
    const { voice, rate } = audio.getSettings();
    const badges = points.allBadges(p);
    this.setData({
      cloudReady: api.configured(), goal: p.dailyMinutesGoal, newCards: p.newCardsPerDay, startDate: p.startDate, voice, rate,
      stats: progress.srsStats(p), streak: progress.streak(p), totalMinutes,
      days: Object.keys(p.logs).filter((k) => p.logs[k].minutes > 0).length,
      quizzes: p.quizScores.length,
      stars: p.stars || 0,
      badges,
      earnedCount: badges.filter((b) => b.earned).length,
      nickname: loadNickname(),
      registered: !!readProfile().registered,
      isAdmin: !!readProfile().isAdmin,
      status: readProfile().status || 'active'
    });
    if (api.configured()) { this.loadUsage(); this.loadMe(); }
  },
  async loadUsage() {
    let usage;
    try { usage = await api.usageGet(); } catch (e) { return; }
    if (!usage) return;
    this.setData({ usage, isAdmin: !!usage.isAdmin });
  },
  async loadMe() {
    try {
      const me = await api.me();
      if (!me) return;
      const d = { openid: me.openid || '', registered: !!me.registered, isAdmin: !!me.isAdmin, status: me.status || 'active' };
      if (me.nickname && !this.data.nickname) { saveNickname(me.nickname); d.nickname = me.nickname; }
      try { wx.setStorageSync(PROFILE_KEY, { ...readProfile(), registered: !!me.registered, isAdmin: !!me.isAdmin, status: me.status || 'active' }); } catch (e) { /* ignore */ }
      this.setData(d);
    } catch (e) { this.setData({ openid: '' }); }
  },
  onNickname(e) {
    const nickname = String((e.detail && e.detail.value) || '').trim().slice(0, 20);
    if (nickname === this.data.nickname) return;
    saveNickname(nickname);
    this.setData({ nickname });
    if (!nickname || !api.configured()) return;
    api.setProfile(nickname).catch(() => { /* 静默，下次进入再试 */ });
  },
  copyOpenid() {
    if (!this.data.openid) return;
    wx.setClipboardData({ data: this.data.openid });
    wx.showToast({ title: '已复制', icon: 'none' });
  },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }); },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); },
  onVoice(e) { const { voice } = audio.setSettings({ voice: e.detail.value }); this.setData({ voice }); },
  onRate(e) { const { rate } = audio.setSettings({ rate: e.detail.value }); this.setData({ rate }); },
  onGoalMoving(e) { this.setData({ goal: e.detail.value }); },
  onGoal(e) { const p = progress.load(); p.dailyMinutesGoal = e.detail.value; progress.save(p); this.setData({ goal: e.detail.value }); },
  onNewCardsMoving(e) { this.setData({ newCards: e.detail.value }); },
  onNewCards(e) { const p = progress.load(); p.newCardsPerDay = e.detail.value; progress.save(p); this.setData({ newCards: e.detail.value }); },
  onStartDate(e) { const p = progress.load(); p.startDate = e.detail.value; progress.save(p); this.setData({ startDate: e.detail.value }); },
  async upload() {
    const p = progress.load();
    try { await api.syncProgress(p, sync.buildMeta(p)); wx.showToast({ title: '已上传到云端', icon: 'success' }); }
    catch (e) { wx.showModal({ title: '上传失败', content: e.message, showCancel: false }); }
  },
  async download() {
    try {
      const { progress: remote } = await api.fetchProgress();
      if (!remote) { wx.showToast({ title: '云端没有数据', icon: 'none' }); return; }
      wx.showModal({
        title: '覆盖本地进度？', content: '将用云端的进度替换本机数据。',
        success: (r) => { if (r.confirm) { progress.replace(remote); this.onShow(); wx.showToast({ title: '已恢复', icon: 'success' }); } }
      });
    } catch (e) { wx.showModal({ title: '恢复失败', content: e.message, showCancel: false }); }
  },
  resetAll() {
    wx.showModal({
      title: '清空全部进度', content: '闪卡、小测、AI 记录都会删除，无法恢复。', confirmColor: '#c0392b',
      success: (r) => { if (r.confirm) { progress.reset(); this.onShow(); } }
    });
  }
});
