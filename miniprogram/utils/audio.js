// 语音播放与本地缓存：所有页面只调用这里。
// 云端合成（api.ttsGet / ttsBatch）→ 优先 wx.cloud.downloadFile（免域名白名单）落到 USER_DATA_PATH/tts/ → 单例 InnerAudioContext 播放。
// 注意：Node 模拟脚本也会加载本模块，wx 上可能缺少 env / createInnerAudioContext / getFileSystemManager / downloadFile，
// 所以每个 wx.* 调用都做存在性判断或 try/catch，模块加载本身不能抛错。
const api = require('./api.js');

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

/** djb2 → 16 进制，仅用于本地文件名 */
function hashKey(key) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return h.toString(16);
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
function downloadViaCloud(fileID, key) {
  return new Promise((resolve) => {
    if (!fileID || !w() || !wx.cloud || typeof wx.cloud.downloadFile !== 'function' || !ensureDir()) { resolve(''); return; }
    const filePath = localPath(key);
    try {
      wx.cloud.downloadFile({
        fileID,
        success: (res) => {
          const temp = res && res.tempFilePath;
          if (!temp) { resolve(''); return; }
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
        fail: () => resolve('')
      });
    } catch (e) { resolve(''); }
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

function toast() {
  try { if (w() && typeof wx.showToast === 'function') wx.showToast({ title: TOAST_TEXT, icon: 'none' }); } catch (e) { /* ignore */ }
}

function player() {
  if (ctx) return ctx;
  try {
    if (w() && typeof wx.createInnerAudioContext === 'function') {
      ctx = wx.createInnerAudioContext() || null;
      if (ctx && typeof ctx.onError === 'function') ctx.onError(() => toast());
    }
  } catch (e) { ctx = null; }
  return ctx;
}

function play(src) {
  const c = player();
  if (!c || !src) { toast(); return false; }
  try {
    if (typeof c.stop === 'function') c.stop();
    c.src = src;
    if (typeof c.play === 'function') c.play();
    return true;
  } catch (e) { toast(); return false; }
}

/** 停止当前播放 */
function stop() {
  if (!ctx) return;
  try { if (typeof ctx.stop === 'function') ctx.stop(); } catch (e) { /* ignore */ }
}

/**
 * 朗读文本。opts 可覆盖 voice / rate。
 * 本地缓存命中直接播放；否则取云端 url 立即播放，同时后台下载到本地。
 * 失败 toast "语音暂时不可用" 并 resolve，不阻塞学习。
 */
function speak(text, opts) {
  text = String(text == null ? '' : text).trim();
  if (!text) return Promise.resolve();
  const s = normalizeSettings(Object.assign(getSettings(), opts || {}));
  const key = cacheKey(text, s.voice, s.rate);
  const local = cachedPath(key);
  if (local) { play(local); return Promise.resolve(); }
  return api.ttsGet(text, s.voice, s.rate)
    .then((res) => {
      const url = res && res.url;
      if (!url) { toast(); return; }
      play(url);
      download(url, key, res && res.fileID);
    })
    .catch(() => { toast(); });
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
