// 账号类错误的统一提示。
// 朗读、跟读评分等功能在云端要求先用微信登记，未登记会返回「请先在『我的』页完成微信登录」。
// 之前各处把这类错误吞成一句「语音暂时不可用」，用户完全看不出该做什么，这里统一说清并给出入口。
// 提示只在用户主动使用功能时出现，不在启动或首页弹，符合微信审核「先体验后授权」的要求。

const LOGIN_URL = '/pages/login/login';
const PROFILE_KEY = 'profile_v1';

function profile() {
  try { return (typeof wx !== 'undefined' && wx.getStorageSync(PROFILE_KEY)) || {}; } catch (e) { return {}; }
}

/** 本地记录的登记状态。只用于提前提示，真正的判断以云端返回为准。 */
function isRegistered() { return !!profile().registered; }

/** 本人 openid。跟读录音要上传到 stt/<openid>/ 下，云端据此确认是本人刚传的文件。 */
function openid() { return String(profile().openid || ''); }

function remember(patch) {
  try { wx.setStorageSync(PROFILE_KEY, { ...profile(), ...patch }); } catch (e) { /* ignore */ }
}

/** 把云函数返回的错误归类。返回 '' 表示不是账号问题。 */
function classify(err) {
  const msg = String((err && err.message) || '');
  if (/登录/.test(msg)) return 'login';
  if (/批准/.test(msg)) return 'pending';
  if (/暂停|停用/.test(msg)) return 'blocked';
  if (/已用完|额度/.test(msg)) return 'quota';
  return '';
}

function goLogin() {
  try { wx.navigateTo({ url: LOGIN_URL }); } catch (e) { /* ignore */ }
}

/**
 * 账号问题就弹对应提示并返回 true；不是账号问题返回 false，由调用方自己处理。
 * feature 用于文案，例如 '朗读'、'跟读评分'。
 */
function prompt(err, feature) {
  const kind = classify(err);
  if (!kind) return false;
  const what = feature || '这个功能';
  if (kind === 'login') {
    wx.showModal({
      title: '需要先登录微信',
      content: `登录后即可使用${what}，学习进度也会同步到云端。不登录也能继续离线学习。`,
      confirmText: '去登录',
      cancelText: '以后再说',
      success: (r) => { if (r && r.confirm) goLogin(); }
    });
    return true;
  }
  if (kind === 'pending') {
    wx.showModal({ title: '账号等待管理员批准', content: `批准后即可使用${what}。`, showCancel: false });
    return true;
  }
  if (kind === 'blocked') {
    wx.showModal({ title: '账号已被管理员暂停', content: '请联系管理员恢复。', showCancel: false });
    return true;
  }
  // 额度类：不打断，toast 说明即可
  try { wx.showToast({ title: String(err.message), icon: 'none' }); } catch (e) { /* ignore */ }
  return true;
}

module.exports = { classify, prompt, goLogin, isRegistered, openid, remember, LOGIN_URL };
