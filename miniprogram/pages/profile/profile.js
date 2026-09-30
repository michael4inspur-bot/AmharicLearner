const progress = require('../../utils/progress.js');
const api = require('../../utils/api.js');
const audio = require('../../utils/audio.js');
const points = require('../../utils/points.js');
const sync = require('../../utils/sync.js');
const account = require('../../utils/account.js');
const update = require('../../utils/update.js');
const langs = require('../../langs/index.js');

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
  data: { version: '0.3.0', buildTag: require('../../config.js').buildTag, updateText: '', cloudReady: false, goal: 20, newCards: 10, startDate: '', voice: 'female', rate: 'normal', stats: {}, streak: 0, totalMinutes: 0, days: 0, quizzes: 0, stars: 0, badges: [], earnedCount: 0, usage: null, isAdmin: false, nickname: '', openid: '', registered: false, status: 'active' },
  onShow() {
    this.setData(langs.view());
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().select('/pages/profile/profile');
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
    this.setData({ updateText: update.describe() });
    if (api.configured()) { this.loadUsage(); this.loadMe(); }
  },
  /** 微信只在冷启动时检查新版本，这里汇报本次检查结果；新版已就绪则直接问要不要重启 */
  checkUpdate() {
    const text = update.checkNow();
    this.setData({ updateText: text });
    if (update.status() !== 'ready') wx.showToast({ title: text, icon: 'none' });
  },
  async loadUsage() {
    let usage;
    try { usage = await api.usageGet(); } catch (e) { return; }
    if (!usage) return;
    this.setData({ usage, isAdmin: this.data.registered && !!usage.isAdmin });
  },
  async loadMe() {
    try {
      const me = await api.me();
      if (!me) return;
      const d = { openid: me.openid || '', registered: !!me.registered, isAdmin: !!me.isAdmin, status: me.status || 'active' };
      account.remember(d);
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
    // 没登记的用户只存本地：昵称同步会在云端建账号，绕过登录时的隐私同意
    if (!nickname || !api.configured() || !this.data.registered) return;
    api.setProfile(nickname).catch(() => { /* 静默，下次进入再试 */ });
  },
  copyOpenid() {
    if (!this.data.openid) return;
    wx.setClipboardData({ data: this.data.openid });
    wx.showToast({ title: '已复制', icon: 'none' });
  },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }); },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); },
  /** 退出登录：云端打标记（不删数据），本地清掉登录态。之后朗读、评分、云同步都停，重新登录即恢复。 */
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后朗读、跟读评分和云端同步会停用。学习进度保留在本机和云端，重新登录即可恢复。',
      confirmText: '退出',
      confirmColor: '#c0392b',
      success: async (r) => {
        if (!r || !r.confirm) return;
        try {
          await api.logout();
        } catch (e) {
          // 云端没记下退出的话，语音在服务端仍然可用，本地单方面"退出"会前后不一致，所以不继续
          wx.showModal({ title: '退出失败', content: (e && e.message) || '请检查网络后重试', showCancel: false });
          return;
        }
        account.forget();
        this.setData({ registered: false, isAdmin: false, openid: '', status: 'active', usage: null });
        wx.showToast({ title: '已退出登录', icon: 'none' });
      }
    });
  },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },
  onVoice(e) { const { voice } = audio.setSettings({ voice: e.detail.value }); this.setData({ voice }); },
  onRate(e) { const { rate } = audio.setSettings({ rate: e.detail.value }); this.setData({ rate }); },
  onGoalMoving(e) { this.setData({ goal: e.detail.value }); },
  onGoal(e) { const p = progress.load(); p.dailyMinutesGoal = e.detail.value; progress.save(p); this.setData({ goal: e.detail.value }); },
  onNewCardsMoving(e) { this.setData({ newCards: e.detail.value }); },
  onNewCards(e) { const p = progress.load(); p.newCardsPerDay = e.detail.value; progress.save(p); this.setData({ newCards: e.detail.value }); },
  onStartDate(e) { const p = progress.load(); p.startDate = e.detail.value; progress.save(p); this.setData({ startDate: e.detail.value }); },
  async upload() {
    const code = langs.current();
    const p = progress.load();
    try {
      if (!(await sync.cloudSupports(code, { force: true }))) throw new Error('云函数版本过旧，不支持这种语言的进度。请重新部署云函数 api。');
      await api.syncProgress(p, sync.buildMeta(p), undefined, code);
      wx.showToast({ title: '已上传到云端', icon: 'success' });
    } catch (e) { wx.showModal({ title: '上传失败', content: e.message, showCancel: false }); }
  },
  async download() {
    const code = langs.current();
    try {
      const r = await api.fetchProgress(code);
      if (code !== 'am' && (!r || r.lang !== code)) throw new Error('云函数版本过旧，不支持这种语言的进度。请重新部署云函数 api。');
      const { progress: remote, updatedAt } = r;
      if (!remote) { wx.showToast({ title: '云端没有数据', icon: 'none' }); return; }
      wx.showModal({
        title: '覆盖本地进度？', content: '将用云端的进度替换本机数据。',
        success: (res) => {
          if (!res.confirm) return;
          progress.replace(remote, code);
          sync.noteRemoteVersion(updatedAt, code); // 记下云端版本，之后上传不会被判成旧快照
          this.onShow();
          wx.showToast({ title: '已恢复', icon: 'success' });
        }
      });
    } catch (e) { wx.showModal({ title: '恢复失败', content: e.message, showCancel: false }); }
  },
  resetAll() {
    wx.showModal({
      title: '清空全部进度', content: '闪卡、小测、学习记录都会删除，无法恢复。', confirmColor: '#c0392b',
      success: (r) => { if (r.confirm) { progress.reset(); this.onShow(); } }
    });
  }
});
