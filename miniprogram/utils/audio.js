// 语音播放与本地缓存：所有页面只调用这里。
// 云端合成（api.ttsGet / ttsBatch）→ 优先 wx.cloud.downloadFile（免域名白名单）落到 USER_DATA_PATH/tts/ → 单例 InnerAudioContext 播放。
// 注意：Node 模拟脚本也会加载本模块，wx 上可能缺少 env / createInnerAudioContext / getFileSystemManager / downloadFile，
// 所以每个 wx.* 调用都做存在性判断或 try/catch，模块加载本身不能抛错。
const api = require('./api.js');
const account = require('./account.js');

const SETTINGS_KEY = 'audio_settings_v1';
const CACHE_KEY = 'audio_cache_v1';
const DEFAULTS = { voice: 'female', rate: 'normal' };
const VOICES = ['female', 'male'];
const RATES = ['normal', 'slow'];
const BATCH_MAX = 40;
const DOWNLOAD_CONCURRENCY = 3;
const TOAST_TEXT = '语音暂时不可用';

function w() {
  return typeof wx !== 'undefined' && wx ? wx : null;
}

function readStorage(key) {
  try { const v = w() && wx.getStorageSync(key); return v && typeof v === 'object' ? v : null; }
  catch (e) { return null; }
}

function writeStorage(key, value) {
  try { if (w() && typeof wx.setStorageSync === 'function') wx.setStorageSync(key, value); } catch (e) { /* ignore */ }
}

function normalizeSettings(s) {
  s = s || {};
  return {
    voice: VOICES.includes(s.voice) ? s.voice : DEFAULTS.voice,
    rate: RATES.includes(s.rate) ? s.rate : DEFAULTS.rate
  };
}

/** 读取声音 / 语速设置，缺省 {voice: 'female', rate: 'normal'} */
function getSettings() {
  return normalizeSettings(readStorage(SETTINGS_KEY));
}

/** 局部更新设置，返回更新后的完整设置 */
function setSettings(partial) {
  const next = normalizeSettings(Object.assign(getSettings(), partial || {}));
  writeStorage(SETTINGS_KEY, next);
  return next;
}

/** 本地映射键，与云端 key 的原文一致（云端再做 sha1） */
function cacheKey(text, voice, rate) {
  return `${voice}|${rate}|${text}`;
}

/**
 * 本地音频文件名。单个 32 位 djb2 在现有词库里已经真实撞过
 * （慢速女声的「和」与「先生」映射到同一个文件名），两个词会共用一个缓存文件。
 * 这里用 djb2 + sdbm 两套哈希再拼上长度，碰撞概率降到可忽略。
 */
function hashKey(key) {
  let a = 5381;
  let b = 0;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    a = ((a * 33) ^ c) >>> 0;
    b = (c + (b << 6) + (b << 16) - b) >>> 0;
  }
  return `${a.toString(16)}${b.toString(16)}${key.length.toString(16)}`;
}

// ---------- 本地文件缓存 ----------
let cacheMap = null;
let fsInst = null;
let dirReady = false;

function loadMap() {
  if (!cacheMap) cacheMap = readStorage(CACHE_KEY) || {};
  return cacheMap;
}

function saveMap() {
  writeStorage(CACHE_KEY, loadMap());
}

function fs() {
  if (fsInst) return fsInst;
  try { if (w() && typeof wx.getFileSystemManager === 'function') fsInst = wx.getFileSystemManager() || null; }
  catch (e) { fsInst = null; }
  return fsInst;
}

function ttsDir() {
  const base = w() && wx.env && wx.env.USER_DATA_PATH;
  return base ? `${base}/tts` : '';
}

function ensureDir() {
  if (dirReady) return true;
  const dir = ttsDir();
  const f = fs();
  if (!dir || !f || typeof f.mkdirSync !== 'function') return false;
  try { f.mkdirSync(dir, true); } catch (e) { /* 已存在 */ }
  dirReady = true;
  return true;
}

function localPath(key) {
  const dir = ttsDir();
  return dir ? `${dir}/${hashKey(key)}.mp3` : '';
}

function fileExists(p) {
  const f = fs();
  if (!p || !f || typeof f.accessSync !== 'function') return false;
  try { f.accessSync(p); return true; } catch (e) { return false; }
}

/** 命中映射且文件仍在 → 本地路径；文件丢失则清掉映射 */
function cachedPath(key) {
  const map = loadMap();
  const p = map[key];
  if (!p) return '';
  if (fileExists(p)) return p;
  delete map[key];
  saveMap();
  return '';
}

/** 记录映射并 resolve 路径 */
function remember(key, saved, resolve) {
  if (!saved) { resolve(''); return; }
  loadMap()[key] = saved;
  saveMap();
  resolve(saved);
}

/**
 * 优先用云存储专用下载（wx.cloud.downloadFile）：它不受 downloadFile 合法域名限制，
 * 省掉在公众平台配置云存储域名这一步。拿到临时文件后再落到 USER_DATA_PATH 持久化。
 * 不可用时回退到普通 wx.downloadFile。任何失败都 resolve('')，不抛错。
 */
let lastDownloadErr = '';
function downloadViaCloud(fileID, key) {
  return new Promise((resolve) => {
    if (!fileID || !w() || !wx.cloud || typeof wx.cloud.downloadFile !== 'function' || !ensureDir()) { resolve(''); return; }
    const filePath = localPath(key);
    try {
      wx.cloud.downloadFile({
        fileID,
        success: (res) => {
          const temp = res && res.tempFilePath;
          if (!temp) { lastDownloadErr = `云存储下载没有返回文件（statusCode ${res && res.statusCode}）`; resolve(''); return; }
          lastDownloadErr = '';
          try {
            const fs = wx.getFileSystemManager();
            fs.saveFile({
              tempFilePath: temp,
              filePath,
              success: (r) => remember(key, (r && r.savedFilePath) || filePath, resolve),
              // 存不下就直接用临时路径，本次会话内仍能秒播
              fail: () => remember(key, temp, resolve)
            });
          } catch (e) { remember(key, temp, resolve); }
        },
        // 记下原因：云存储权限设成「仅创建者可读写」时，别人手机上会在这里失败
        fail: (err) => { lastDownloadErr = `云存储下载失败：${(err && (err.errMsg || err.message)) || '未知原因'}`; resolve(''); }
      });
    } catch (e) { lastDownloadErr = `云存储下载失败：${(e && e.message) || e}`; resolve(''); }
  });
}

/** 下载到本地并记录映射；任何失败都 resolve('')，不抛错 */
function downloadViaUrl(url, key) {
  return new Promise((resolve) => {
    if (!url || !w() || typeof wx.downloadFile !== 'function' || !ensureDir()) { resolve(''); return; }
    const filePath = localPath(key);
    try {
      wx.downloadFile({
        url,
        filePath,
        success: (res) => {
          const saved = (res && (res.filePath || res.tempFilePath)) || filePath;
          if (res && res.statusCode === 200 && saved) {
            loadMap()[key] = saved;
            saveMap();
            resolve(saved);
          } else {
            resolve('');
          }
        },
        fail: () => resolve('')
      });
    } catch (e) { resolve(''); }
  });
}

/** 先试云存储下载，失败再试临时链接 */
function download(url, key, fileID) {
  return downloadViaCloud(fileID, key).then((p) => (p ? p : downloadViaUrl(url, key)));
}

// ---------- 播放 ----------
let ctx = null;

function toast(text) {
  try { if (w() && typeof wx.showToast === 'function') wx.showToast({ title: text || TOAST_TEXT, icon: 'none' }); } catch (e) { /* ignore */ }
}

let lastFailAt = 0;
let lastFailMsg = '';
/**
 * 朗读失败时把真实原因告诉用户。以前一律显示「语音暂时不可用」，
 * 云端返回的 Azure 密钥错误、上游失败、播放器错误全被这一句吞掉，没法排查。
 * 用弹框放完整文案（toast 只能显示很短的字），同一原因 3 秒内不重复弹，连点喇叭不会叠框。
 */
function fail(reason, raw) {
  try { console.error('[audio] 朗读失败：', reason, raw || ''); } catch (e) { /* ignore */ }
  const now = Date.now();
  const msg = String(reason || TOAST_TEXT);
  if (msg === lastFailMsg && now - lastFailAt < 3000) return;
  lastFailAt = now;
  lastFailMsg = msg;
  try {
    if (w() && typeof wx.showModal === 'function') {
      wx.showModal({ title: '朗读失败', content: msg, showCancel: false });
      return;
    }
  } catch (e) { /* ignore */ }
  toast();
}

function player() {
  if (ctx) return ctx;
  try {
    if (w() && typeof wx.createInnerAudioContext === 'function') {
      ctx = wx.createInnerAudioContext() || null;
      if (ctx && typeof ctx.onError === 'function') {
        ctx.onError((res) => {
          const why = `音频播放出错：${(res && (res.errMsg || res.errCode)) || '未知原因'}`;
          // 在线链接播不了时，把先前云存储下载失败的原因一起给出来，才看得出是权限还是域名问题
          fail(lastDownloadErr ? `${why}\n${lastDownloadErr}` : why, res);
        });
      }
    }
  } catch (e) { ctx = null; }
  return ctx;
}

function play(src) {
  const c = player();
  if (!c || !src) { fail(!c ? '当前环境无法创建音频播放器' : '没有可播放的音频'); return false; }
  try {
    if (typeof c.stop === 'function') c.stop();
    c.src = src;
    if (typeof c.play === 'function') c.play();
    return true;
  } catch (e) { fail(`音频播放出错：${(e && e.message) || e}`, e); return false; }
}

/** 停止当前播放 */
function stop() {
  if (!ctx) return;
  try { if (typeof ctx.stop === 'function') ctx.stop(); } catch (e) { /* ignore */ }
}

/**
 * 朗读文本。opts 可覆盖 voice / rate。
 * 本地缓存命中直接播放；否则先用 wx.cloud.downloadFile 把云端音频下载到本地再播。
 * 不能直接播临时链接：InnerAudioContext 播网络地址要求该域名在「downloadFile 合法域名」里，
 * 开发者工具（不校验合法域名）和打开了「开发调试」的手机会跳过这项检查，
 * 于是出现「只有自己手机能播、同事手机都不能播」。云存储下载不受合法域名限制。
 * 云存储下载失败时才退回直接播临时链接，失败原因会一起显示在弹框里。
 * opts.silent 为 true 时失败不弹任何提示（自动播放场景用：
 * 小测切题、复习先听再看都是页面自动触发的，弹登录框等于没点按钮就被要求授权）。
 */
function speak(text, opts) {
  text = String(text == null ? '' : text).trim();
  if (!text) return Promise.resolve();
  const s = normalizeSettings(Object.assign(getSettings(), opts || {}));
  const key = cacheKey(text, s.voice, s.rate);
  const local = cachedPath(key);
  if (local) { play(local); return Promise.resolve(); }
  if (opts && opts.silent && !account.isRegistered()) return Promise.resolve();
  return api.ttsGet(text, s.voice, s.rate)
    .then((res) => {
      const url = res && res.url;
      const fileID = res && res.fileID;
      if (!url && !fileID) { fail('云端没有返回音频地址，请查看云函数 api 的日志', res); return; }
      lastDownloadErr = '';
      return downloadViaCloud(fileID, key).then((p) => {
        if (p) { play(p); return; }
        if (!url) { fail(lastDownloadErr || '音频下载失败', res); return; }
        play(url);
        downloadViaUrl(url, key);
      });
    })
    .catch((err) => {
      if (opts && opts.silent) return;
      if (account.prompt(err, '朗读')) return;
      // api.js 已经把断网 / 超时 / 未部署 / 云端具体原因归一成中文，原样给用户看
      fail((err && err.message) || TOAST_TEXT, err);
    });
}

// ---------- 预取 ----------
/** 逐个下载，同时最多 DOWNLOAD_CONCURRENCY 个，失败静默 */
function downloadQueue(jobs) {
  let i = 0;
  function next() {
    if (i >= jobs.length) return Promise.resolve();
    const job = jobs[i++];
    return download(job.url, job.key, job.fileID).then(next, next);
  }
  const workers = [];
  for (let n = 0; n < Math.min(DOWNLOAD_CONCURRENCY, jobs.length); n++) workers.push(next());
  return Promise.all(workers);
}

/**
 * 预取一组词句的语音到本地。items: [{id, text}]（也接受课程 item 的 am 字段）。
 * 已缓存的跳过；每批最多 40 条调 api.ttsBatch；不返回 Promise，不抛错。
 */
function prefetch(items) {
  try {
    if (!Array.isArray(items) || !items.length || !api.configured()) return;
    const s = getSettings();
    const seen = {};
    const pending = [];
    items.forEach((it, idx) => {
      if (!it) return;
      const text = String(it.text || it.am || '').trim();
      if (!text) return;
      const key = cacheKey(text, s.voice, s.rate);
      if (seen[key] || cachedPath(key)) return;
      seen[key] = true;
      pending.push({ id: String(it.id != null ? it.id : idx), text, key });
    });
    if (!pending.length) return;
    let chain = Promise.resolve();
    for (let i = 0; i < pending.length; i += BATCH_MAX) {
      const batch = pending.slice(i, i + BATCH_MAX);
      chain = chain
        .then(() => api.ttsBatch(batch.map(({ id, text }) => ({ id, text })), s.voice, s.rate))
        .then((res) => {
          const urls = (res && res.urls) || {};
          const files = (res && res.files) || {};
          const jobs = batch
            .filter((b) => urls[b.id] || files[b.id])
            .map((b) => ({ url: urls[b.id], key: b.key, fileID: files[b.id] }));
          return downloadQueue(jobs);
        })
        .catch(() => { /* 静默 */ });
    }
  } catch (e) { /* 静默 */ }
}

module.exports = { getSettings, setSettings, speak, prefetch, stop, cacheKey };
