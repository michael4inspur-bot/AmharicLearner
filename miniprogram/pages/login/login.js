// 微信登录 = 在云端登记本人 openid。登记后才能用 AI 教练与语音；本地学习不受影响。
const api = require('../../utils/api.js');

const PROFILE_KEY = 'profile_v1';

function readProfile() {
  try { return wx.getStorageSync(PROFILE_KEY) || {}; } catch (e) { return {}; }
}
function writeProfile(patch) {
  try { wx.setStorageSync(PROFILE_KEY, { ...readProfile(), ...patch }); } catch (e) { /* ignore */ }
}

// 登记前先弹微信官方隐私授权框（后台「用户隐私保护指引」）。用户拒绝则不登记；旧基础库或开发者工具没有此接口时直接放行。
function requirePrivacy() {
  if (!wx.requirePrivacyAuthorize) return Promise.resolve();
  return new Promise((resolve, reject) => {
    wx.requirePrivacyAuthorize({
      success: resolve,
      fail: (res) => {
        const msg = (res && res.errMsg) || '';
        const refused = /user reject|refuse|deny/i.test(msg);
        // 用户主动拒绝才拦；接口不存在、后台还没配指引、scope 未声明等一律放行，避免登录卡死
        if (!refused) return resolve();
        reject(new Error('需要同意隐私指引才能登录'));
      }
    });
  });
}

Page({
  data: { nickname: '', loading: false, configured: false, error: '', agreed: false },
  onLoad() {
    const p = readProfile();
    this.setData({ nickname: p.nickname || '', configured: api.configured() });
  },
  /** 隐私同意：默认不勾选，必须用户自己勾上才能登录 */
  onAgree(e) {
    const vals = (e && e.detail && e.detail.value) || [];
    this.setData({ agreed: vals.length > 0, error: '' });
  },
  onNickname(e) { this.setData({ nickname: String((e.detail && e.detail.value) || '').trim().slice(0, 20) }); },
  async login() {
    if (this.data.loading) return;
    if (!this.data.agreed) { this.setData({ error: '请先阅读并勾选同意《隐私政策与 AI 内容声明》' }); return; }
    this.setData({ loading: true, error: '' });
    try {
      await requirePrivacy();
      const me = await api.register(this.data.nickname);
      writeProfile({ registered: true, nickname: me.nickname || this.data.nickname, isAdmin: !!me.isAdmin, status: me.status || 'active' });
      wx.showToast({ title: me.isAdmin ? '已登录（管理员）' : '已登录', icon: 'none' });
      setTimeout(() => this.back(), 400);
    } catch (err) {
      this.setData({ loading: false, error: (err && err.message) || '登录失败' });
    }
  },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },
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
