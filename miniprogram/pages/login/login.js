// 微信登录 = 在云端登记本人 openid。登记后才能用 AI 教练与语音；本地学习不受影响。
const api = require('../../utils/api.js');

const PROFILE_KEY = 'profile_v1';

function readProfile() {
  try { return wx.getStorageSync(PROFILE_KEY) || {}; } catch (e) { return {}; }
}
function writeProfile(patch) {
  try { wx.setStorageSync(PROFILE_KEY, { ...readProfile(), ...patch }); } catch (e) { /* ignore */ }
}

Page({
  data: { nickname: '', loading: false, configured: false, error: '' },
  onLoad() {
    const p = readProfile();
    this.setData({ nickname: p.nickname || '', configured: api.configured() });
  },
  onNickname(e) { this.setData({ nickname: String((e.detail && e.detail.value) || '').trim().slice(0, 20) }); },
  async login() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      const me = await api.register(this.data.nickname);
      writeProfile({ registered: true, nickname: me.nickname || this.data.nickname, isAdmin: !!me.isAdmin, status: me.status || 'active' });
      wx.showToast({ title: me.isAdmin ? '已登录（管理员）' : '已登录', icon: 'none' });
      setTimeout(() => this.back(), 400);
    } catch (err) {
      this.setData({ loading: false, error: (err && err.message) || '登录失败' });
    }
  },
  skip() {
    writeProfile({ skipped: true });
    this.back();
  },
  back() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/index/index' });
  }
});
