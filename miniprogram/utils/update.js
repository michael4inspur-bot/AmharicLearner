// 小程序版本更新。
// 微信只在冷启动时自动检查新版本，即使检查到了，本次打开仍然跑旧版，要再冷启动一次才生效。
// 这里用 UpdateManager 在新版下载完成后弹框，用户确认即重启应用切到新版，省掉第二次冷启动。
// 注意：微信没有"重新检查"的接口，关于页的按钮只能汇报本次启动的检查结果。

const TEXT = {
  unsupported: '当前微信版本不支持自动更新，请手动重开小程序',
  checking: '正在检查新版本…',
  latest: '已是最新版本',
  downloading: '发现新版本，正在下载…',
  ready: '新版本已下载，重启即可使用',
  failed: '新版本下载失败，请检查网络后重开小程序'
};

const state = { status: 'unsupported' };
let manager = null;
let autoPrompted = false;

function describe() { return TEXT[state.status] || TEXT.unsupported; }
function status() { return state.status; }

/** 弹框确认后重启到新版。manual=true 表示用户点「检查更新」主动触发 */
function restart(manual) {
  if (!manager || state.status !== 'ready') return false;
  wx.showModal({
    title: '有新版本',
    content: '新版本已经下载好，重启小程序即可使用。你的学习进度不会丢。',
    confirmText: '立即重启',
    cancelText: manual ? '稍后' : '下次再说',
    success: (res) => { if (res && res.confirm) manager.applyUpdate(); }
  });
  return true;
}

/** 启动时调用：挂上三个监听，新版就绪时自动弹一次 */
function init() {
  if (typeof wx === 'undefined' || typeof wx.getUpdateManager !== 'function') {
    state.status = 'unsupported';
    return state.status;
  }
  manager = wx.getUpdateManager();
  if (!manager) { state.status = 'unsupported'; return state.status; }
  state.status = 'checking';
  manager.onCheckForUpdate((res) => {
    state.status = res && res.hasUpdate ? 'downloading' : 'latest';
  });
  manager.onUpdateReady(() => {
    state.status = 'ready';
    if (autoPrompted) return;
    autoPrompted = true;
    restart(false);
  });
  manager.onUpdateFailed(() => { state.status = 'failed'; });
  return state.status;
}

/** 下拉刷新时的提示：已是最新版时补一句说明，避免误以为刚刚重新检查过 */
function refreshHint() {
  if (state.status === 'latest') return '已是最新版本（重开小程序可重新检查）';
  return describe();
}

/** 关于页「检查更新」：新版已就绪就直接问要不要重启，否则汇报本次启动的检查结果 */
function checkNow() {
  restart(true);
  return describe();
}

module.exports = { init, checkNow, describe, refreshHint, status, TEXT };
