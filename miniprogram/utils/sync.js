// 进度自动同步：小程序切后台或关键操作后静默上传；未配置后台或失败时不打扰用户。
const api = require('./api.js');
const progress = require('./progress.js');
const account = require('./account.js');

let timer = null;
let lastPayload = '';
let inFlight = null;
let baseUpdatedAt = '';   // 最近一次成功上传 / 拉取时云端的 updatedAt

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
  // 没登记就不上传：用户还没勾选隐私同意，学习数据不该按 openid 存到云端
  if (!account.isRegistered()) return Promise.resolve(false);
  const p = progress.load();
  // 全新的空进度绝不能上传：换手机或重装后只要打开一次再切后台，
  // 空进度就会整份覆盖云端，之前的学习记录永久丢失
  if (progress.isEmpty(p)) return Promise.resolve(false);
  const payload = JSON.stringify(p);
  if (payload === lastPayload) return Promise.resolve(false);
  // 同一份数据并发上传没有意义，只会重复写库
  if (inFlight) return inFlight;
  inFlight = api.syncProgress(p, buildMeta(p), baseUpdatedAt)
    .then((r) => { lastPayload = payload; if (r && r.updatedAt) baseUpdatedAt = r.updatedAt; return true; })
    .catch(() => false)
    .then((r) => { inFlight = null; return r; });
  return inFlight;
}

/** 延迟合并多次调用，避免频繁请求 */
function scheduleSync(delayMs) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; syncNow(); }, delayMs == null ? 3000 : delayMs);
}

/** 从云端恢复后调用，记下这份数据对应的云端版本，之后上传才不会被判成旧快照 */
function noteRemoteVersion(updatedAt) { baseUpdatedAt = String(updatedAt || ''); lastPayload = ''; }

module.exports = { syncNow, scheduleSync, configured, buildMeta, noteRemoteVersion };
