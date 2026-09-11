const progress = require('../../utils/progress.js');
const api = require('../../utils/api.js');

Page({
  data: { cloudReady: false, goal: 20, newCards: 10, startDate: '', stats: {}, streak: 0, totalMinutes: 0, days: 0, quizzes: 0 },
  onShow() {
    const p = progress.load();
    const totalMinutes = Object.values(p.logs).reduce((a, l) => a + (l.minutes || 0), 0);
    this.setData({
      cloudReady: api.configured(), goal: p.dailyMinutesGoal, newCards: p.newCardsPerDay, startDate: p.startDate,
      stats: progress.srsStats(p), streak: progress.streak(p), totalMinutes,
      days: Object.keys(p.logs).filter((k) => p.logs[k].minutes > 0).length,
      quizzes: p.quizScores.length
    });
  },
  onGoal(e) { const p = progress.load(); p.dailyMinutesGoal = e.detail.value; progress.save(p); this.setData({ goal: e.detail.value }); },
  onNewCards(e) { const p = progress.load(); p.newCardsPerDay = e.detail.value; progress.save(p); this.setData({ newCards: e.detail.value }); },
  onStartDate(e) { const p = progress.load(); p.startDate = e.detail.value; progress.save(p); this.setData({ startDate: e.detail.value }); },
  async upload() {
    try { await api.syncProgress(progress.load()); wx.showToast({ title: '已上传到云端', icon: 'success' }); }
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
