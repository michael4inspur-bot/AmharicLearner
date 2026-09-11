// 进度自动同步：小程序切后台或关键操作后静默上传；未配置后台或失败时不打扰用户。
const api = require('./api.js');
const progress = require('./progress.js');

let timer = null;
let lastPayload = '';

function configured() {
  return api.configured();
}

/** 上传时附带的账号摘要，云端用来更新用户列表；计算失败不影响同步 */
function buildMeta(p) {
  try {
    return { week: progress.currentPosition(p).week, streak: progress.streak(p), stars: p.stars || 0 };
  } catch (e) {
    return { week: 0, streak: 0, stars: 0 };
  }
}

function syncNow() {
  if (!configured()) return Promise.resolve(false);
  const p = progress.load();
  const payload = JSON.stringify(p);
  if (payload === lastPayload) return Promise.resolve(false);
  return api.syncProgress(p, buildMeta(p))
    .then(() => { lastPayload = payload; return true; })
    .catch(() => false);
}

/** 延迟合并多次调用，避免频繁请求 */
function scheduleSync(delayMs) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; syncNow(); }, delayMs == null ? 3000 : delayMs);
}

module.exports = { syncNow, scheduleSync, configured, buildMeta };
