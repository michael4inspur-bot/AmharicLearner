// 进度自动同步：小程序切后台或关键操作后静默上传；未配置后台或失败时不打扰用户。
// 每种语言各自一份同步状态，上传到云端各自的文档。
const api = require('./api.js');
const progress = require('./progress.js');
const account = require('./account.js');
const langs = require('../langs/index.js');

const states = {};
function state(code) {
  if (!states[code]) states[code] = { lastPayload: '', baseUpdatedAt: '', inFlight: null, checkedAt: 0, supported: code === 'am' };
  return states[code];
}

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

const PROBE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * 云函数是否已支持这种语言的进度。旧版云函数不认识 lang，会把奥罗莫语进度
 * 整份写进阿姆哈拉语文档，所以非阿姆哈拉语上传前先确认云端会回显同一个 lang。
 * 支持就一直缓存；不支持时 10 分钟内不再探测（每次探测都要拉一整份进度），
 * opts.force 用于用户手动上传 / 恢复时立即重新探测。
 */
function cloudSupports(code, opts) {
  const s = state(code);
  if (s.supported) return Promise.resolve(true);
  if (!(opts && opts.force) && s.checkedAt && Date.now() - s.checkedAt < PROBE_INTERVAL_MS) return Promise.resolve(false);
  return api.fetchProgress(code)
    // 只有拿到答复才进入退避；网络失败不算，下次还要再探测
    .then((r) => { s.checkedAt = Date.now(); s.supported = !!r && r.lang === code; return s.supported; })
    .catch(() => false);
}

function syncNow(code) {
  code = code || langs.current();
  if (!configured()) return Promise.resolve(false);
  // 没登记就不上传：用户还没勾选隐私同意，学习数据不该按 openid 存到云端
  if (!account.isRegistered()) return Promise.resolve(false);
  const s = state(code);
  const p = progress.load(code);
  // 全新的空进度绝不能上传：换手机或重装后只要打开一次再切后台，
  // 空进度就会整份覆盖云端，之前的学习记录永久丢失
  if (progress.isEmpty(p)) return Promise.resolve(false);
  const payload = JSON.stringify(p);
  if (payload === s.lastPayload) return Promise.resolve(false);
  // 同一份数据并发上传没有意义，只会重复写库
  if (s.inFlight) return s.inFlight;
  s.inFlight = cloudSupports(code)
    .then((ok) => {
      if (!ok) return false;
      return api.syncProgress(p, buildMeta(p), s.baseUpdatedAt, code)
        .then((r) => { s.lastPayload = payload; if (r && r.updatedAt) s.baseUpdatedAt = r.updatedAt; return true; });
    })
    .catch(() => false)
    .then((r) => {
      s.inFlight = null;
      // 上传期间又有改动：再传一次，否则切后台时最后的改动会漏掉
      if (r && JSON.stringify(progress.load(code)) !== s.lastPayload) return syncNow(code);
      return r;
    });
  return s.inFlight;
}

let timer = null;
const pending = new Set();
/** 延迟合并多次调用，避免频繁请求；期间改过进度的语言都会同步 */
function scheduleSync(delayMs, code) {
  pending.add(code || langs.current());
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const codes = [...pending];
    pending.clear();
    codes.forEach((c) => syncNow(c));
  }, delayMs == null ? 3000 : delayMs);
}

/** 立即同步所有待同步的语言和当前语言（切后台时用：后台计时器可能被冻结） */
function flushPending() {
  if (timer) { clearTimeout(timer); timer = null; }
  const codes = new Set([...pending, langs.current()]);
  pending.clear();
  return Promise.all([...codes].map((c) => syncNow(c)));
}

/** 从云端恢复后调用，记下这份数据对应的云端版本，之后上传才不会被判成旧快照 */
function noteRemoteVersion(updatedAt, code) {
  const s = state(code || langs.current());
  s.baseUpdatedAt = String(updatedAt || '');
  s.lastPayload = '';
}

module.exports = { syncNow, scheduleSync, configured, buildMeta, noteRemoteVersion, cloudSupports, flushPending };
