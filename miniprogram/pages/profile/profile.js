const progress = require('../../utils/progress.js');
const api = require('../../utils/api.js');

Page({
  data: { baseUrl: '', goal: 20, newCards: 10, startDate: '', stats: {}, streak: 0, totalMinutes: 0, days: 0, serverOk: null, userId: '' },
  onShow() {
    const p = progress.load();
    const s = api.getSettings();
    const totalMinutes = Object.values(p.logs).reduce((a, l) => a + (l.minutes || 0), 0);
    this.setData({
      baseUrl: s.baseUrl, userId: s.userId || '', goal: p.dailyMinutesGoal, newCards: p.newCardsPerDay, startDate: p.startDate,
      stats: progress.srsStats(p), streak: progress.streak(p), totalMinutes,
      days: Object.keys(p.logs).filter((k) => p.logs[k].minutes > 0).length,
      quizzes: p.quizScores.length
    });
  },
  onBaseUrl(e) { this.setData({ baseUrl: e.detail.value }); },
  saveBaseUrl() {
    api.saveSettings({ baseUrl: this.data.baseUrl.trim(), token: '' });
    wx.showToast({ title: '已保存', icon: 'none' });
  },
  async testServer() {
    api.saveSettings({ baseUrl: this.data.baseUrl.trim() });
    try { await api.health(); this.setData({ serverOk: true }); wx.showToast({ title: '连接成功', icon: 'success' }); }
    catch (e) { this.setData({ serverOk: false }); wx.showModal({ title: '连接失败', content: e.message + '\n\n提示：正式环境需在微信公众平台配置 request 合法域名（HTTPS）。', showCancel: false }); }
  },
  onGoal(e) { const p = progress.load(); p.dailyMinutesGoal = e.detail.value; progress.save(p); this.setData({ goal: e.detail.value }); },
  onNewCards(e) { const p = progress.load(); p.newCardsPerDay = e.detail.value; progress.save(p); this.setData({ newCards: e.detail.value }); },
  onStartDate(e) { const p = progress.load(); p.startDate = e.detail.value; progress.save(p); this.setData({ startDate: e.detail.value }); },
  async upload() {
    try { await api.syncProgress(progress.load()); wx.showToast({ title: '已上传到服务器', icon: 'success' }); }
    catch (e) { wx.showModal({ title: '上传失败', content: e.message, showCancel: false }); }
  },
  async download() {
    try {
      const { progress: remote } = await api.fetchProgress();
      if (!remote) { wx.showToast({ title: '服务器上没有数据', icon: 'none' }); return; }
      wx.showModal({
        title: '覆盖本地进度？', content: '将用服务器上的进度替换本机数据。',
        success: (r) => { if (r.confirm) { progress.replace(remote); this.onShow(); wx.showToast({ title: '已恢复', icon: 'success' }); } }
      });
    } catch (e) { wx.showModal({ title: '下载失败', content: e.message, showCancel: false }); }
  },
  resetAll() {
    wx.showModal({
      title: '清空全部进度', content: '闪卡、小测、AI 记录都会删除，无法恢复。', confirmColor: '#c0392b',
      success: (r) => { if (r.confirm) { progress.reset(); this.onShow(); } }
    });
  }
});
