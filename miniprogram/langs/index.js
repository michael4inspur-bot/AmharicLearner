// 语言包注册表。页面和工具模块只通过这里取词库、计划、字母表和界面文案。
// 当前语言存本地 lang_v1，缺省阿姆哈拉语。
const KEY = 'lang_v1';
const DEFAULT = 'am';

const config = require('../config.js');

const packs = { am: require('./am/index.js'), om: require('./om/index.js') };
const order = ['am', 'om'];
let cur = '';
const listeners = [];

function readStored() {
  try {
    const v = typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function' ? wx.getStorageSync(KEY) : '';
    return typeof v === 'string' ? v : '';
  } catch (e) { return ''; }
}

/** 语言是否对用户可见：config.showBetaLangs === false 时隐藏试用版（meta.beta）语言 */
function visible(code) {
  if (!packs[code]) return false;
  return !(config.showBetaLangs === false && packs[code].meta.beta);
}

/** 当前语言码；存储里的值无效或已隐藏时回退到缺省语言（不改存储，重新显示后回到原语言） */
function current() {
  if (!cur || !packs[cur]) {
    const v = readStored();
    cur = packs[v] ? v : DEFAULT;
  }
  return visible(cur) ? cur : DEFAULT;
}

/** 切换语言并持久化；未注册或已隐藏的语言返回 false。语言真的变化才通知订阅者 */
function set(code) {
  if (!visible(code)) return false;
  const changed = code !== current();
  cur = code;
  try { if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') wx.setStorageSync(KEY, code); } catch (e) { /* ignore */ }
  if (changed) listeners.slice().forEach((fn) => { try { fn(code); } catch (e) { /* 一个订阅者出错不影响其他 */ } });
  return true;
}

/** 语言包。不传参数取当前语言；传了未注册的语言码直接报错，避免静默拿到别的语言的数据 */
function pack(code) {
  if (code == null) return packs[current()];
  if (!packs[code]) throw new Error(`未注册的语言：${code}`);
  return packs[code];
}
function meta(code) { return pack(code).meta; }
/** 页面模板用的语言视图：界面文案 L、原文字体类 tc（埃塞文字 'am'，拉丁文字 'latin'）、是否有转写 hasRom、是否有语音 audio、是否显示男声/女声选项 voiceChoice、是否有发音评分 scoring、合成音标注 voiceNote（为空则不显示） */
function view(code) {
  const m = meta(code);
  return { L: m.strings, tc: m.script === 'ethiopic' ? 'am' : 'latin', hasRom: m.hasRom, audio: m.audio, voiceChoice: m.voices.length > 1, scoring: m.scoring, voiceNote: m.voiceNote };
}
/** 语言入口列表（按 order），不含已隐藏的试用版语言 */
function list() { return order.filter(visible).map((c) => packs[c].meta); }

/** 订阅语言切换，返回取消订阅函数 */
function onChange(fn) {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
}

/** 只给测试使用：注册一个语言包 */
function register(code, p) {
  packs[code] = p;
  if (!order.includes(code)) order.push(code);
}

/** 只给测试使用：注销 register 注册的语言（内置语言不可注销） */
function unregister(code) {
  if (code === DEFAULT || code === 'om') return;
  delete packs[code];
  const i = order.indexOf(code);
  if (i >= 0) order.splice(i, 1);
  if (cur === code) cur = '';
}

module.exports = { current, set, pack, meta, view, list, onChange, register, unregister, DEFAULT };
