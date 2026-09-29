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
// 每次播放的编号。换了新的播放 / 调了 stop 之后，旧播放器迟到的 onError 一律忽略
let seq = 0;

/** 对还没加载过音频的播放器调 stop/pause 时基础库报的错（跟读页的回放播放器用） */
function isBenignError(res) {
  return /audioInstance is not set/i.test(String((res && res.errMsg) || ''));
}

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

let optionSet = false;
/**
 * iPhone 打开静音开关时，InnerAudioContext 默认跟随静音：不出声也不报错，
 * 用户只会觉得「点了没反应」。朗读是用户主动点的，不应被静音开关挡住。
 */
function setAudioOption() {
  if (optionSet) return;
  optionSet = true;
  try {
    if (w() && typeof wx.setInnerAudioOption === 'function') wx.setInnerAudioOption({ obeyMuteSwitch: false });
  } catch (e) { /* ignore */ }
}

/** 销毁上一个播放器，建一个新的。复用同一个实例时，src 加载失败后实例会卡在「audioInstance is not set」 */
function freshPlayer() {
  if (ctx) {
    const old = ctx;
    ctx = null;
    try { if (typeof old.destroy === 'function') old.destroy(); else if (typeof old.stop === 'function') old.stop(); } catch (e) { /* ignore */ }
  }
  try {
    if (w() && typeof wx.createInnerAudioContext === 'function') ctx = wx.createInnerAudioContext() || null;
  } catch (e) { ctx = null; }
  return ctx;
}

/**
 * 依次尝试 sources：[{kind: '本地文件' | '在线链接' ..., src, onFail}]，前一个报错就换下一个。
 * 全部失败时调 opts.onAllFail(errors)，没给就弹框列出每一步的原因。
 * opts.errors 是播放之前已经发生的错误（例如云存储下载失败），会一起列出来。
 */
function playSources(sources, opts) {
  opts = opts || {};
  const list = (sources || []).filter((s) => s && s.src);
  const errors = (opts.errors || []).slice();
  const giveUp = (raw) => {
    if (opts.onAllFail) { opts.onAllFail(errors); return; }
    if (!opts.silent) fail(errors.join('\n') || '没有可播放的音频', raw);
  };
  if (!list.length) { if (!errors.length) errors.push('没有可播放的音频'); giveUp(); return false; }
  setAudioOption();

  function attempt(i) {
    const s = list[i];
    const id = ++seq;
    let handled = false;
    const onError = (res) => {
      if (handled || id !== seq) return;
      handled = true;
      errors.push(`${s.kind}播放出错：${(res && (res.errMsg || res.errCode || res.message)) || '未知原因'}`);
      try { console.warn('[audio] 播放失败', s.kind, s.src, res); } catch (e) { /* ignore */ }
      if (typeof s.onFail === 'function') s.onFail();
      if (i + 1 < list.length) attempt(i + 1);
      else giveUp(res);
    };
    const c = freshPlayer();
    if (!c) { errors.push('当前环境无法创建音频播放器'); handled = true; giveUp(); return; }
    if (typeof c.onError === 'function') c.onError(onError);
    try { console.info('[audio] 播放', s.kind, s.src); } catch (e) { /* ignore */ }
    try {
      c.src = s.src;
      if (typeof c.play === 'function') c.play();
    } catch (e) { onError(e); }
  }
  attempt(0);
  return true;
}

/** 停止当前播放 */
function stop() {
  seq++;
  if (!ctx) return;
  try { if (typeof ctx.stop === 'function') ctx.stop(); } catch (e) { /* ignore */ }
}

function forget(key) {
  const map = loadMap();
  if (map[key]) { delete map[key]; saveMap(); }
}

/**
 * 从云端取音频并播放：先用 wx.cloud.downloadFile 下载到本地再播。
 * 不直接播临时链接：InnerAudioContext 播网络地址要求该域名在「downloadFile 合法域名」里，
 * 开发者工具（不校验合法域名）和打开了「开发调试」的手机会跳过这项检查，
 * 于是出现「只有自己手机能播、同事手机都不能播」。云存储下载不受合法域名限制。
 * 本地文件播不了再换在线链接；每一步失败的原因都会列在弹框里。
 */
function fetchAndPlay(text, s, key, opts, prevErrors) {
  return api.ttsGet(text, s.voice, s.rate)
    .then((res) => {
      const url = res && res.url;
      const fileID = res && res.fileID;
      if (!url && !fileID) {
        if (!opts.silent) fail(prevErrors.concat('云端没有返回音频地址，请查看云函数 api 的日志').join('\n'), res);
        return;
      }
      lastDownloadErr = '';
      return downloadViaCloud(fileID, key).then((p) => {
        const errors = prevErrors.slice();
        if (!p && lastDownloadErr) errors.push(lastDownloadErr);
        const sources = [];
        if (p) sources.push({ kind: '本地文件', src: p, onFail: () => forget(key) });
        if (url) sources.push({ kind: '在线链接', src: url });
        playSources(sources, { errors, silent: opts.silent });
        if (!p && url) downloadViaUrl(url, key);
      });
    })
    .catch((err) => {
      if (opts.silent) return;
      if (account.prompt(err, '朗读')) return;
      // api.js 已经把断网 / 超时 / 未部署 / 云端具体原因归一成中文，原样给用户看
      fail(prevErrors.concat((err && err.message) || TOAST_TEXT).join('\n'), err);
    });
}

/**
 * 朗读文本。opts 可覆盖 voice / rate。
 * 本地缓存命中直接播放，缓存文件播不了就删掉缓存、重新从云端取；否则走 fetchAndPlay。
 * opts.silent 为 true 时失败不弹任何提示（自动播放场景用：
 * 小测切题、复习先听再看都是页面自动触发的，弹登录框等于没点按钮就被要求授权）。
 */
function speak(text, opts) {
  text = String(text == null ? '' : text).trim();
  if (!text) return Promise.resolve();
  opts = opts || {};
  const s = normalizeSettings(Object.assign(getSettings(), opts));
  const key = cacheKey(text, s.voice, s.rate);
  const local = cachedPath(key);
  if (local) {
    playSources([{ kind: '本地缓存', src: local }], {
      onAllFail: (errors) => { forget(key); fetchAndPlay(text, s, key, opts, errors); }
    });
    return Promise.resolve();
  }
  if (opts.silent && !account.isRegistered()) return Promise.resolve();
  return fetchAndPlay(text, s, key, opts, []);
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

module.exports = { getSettings, setSettings, speak, prefetch, stop, cacheKey, isBenignError };
