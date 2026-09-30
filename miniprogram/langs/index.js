// 语言包注册表。页面和工具模块只通过这里取词库、计划、字母表和界面文案。
// 当前语言存本地 lang_v1，缺省阿姆哈拉语。
const KEY = 'lang_v1';
const DEFAULT = 'am';

const packs = { am: require('./am/index.js') };
const order = ['am'];
let cur = '';
const listeners = [];

function readStored() {
  try {
    const v = typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function' ? wx.getStorageSync(KEY) : '';
    return typeof v === 'string' ? v : '';
  } catch (e) { return ''; }
}

/** 当前语言码；存储里的值无效时回退到缺省语言 */
function current() {
  if (cur && packs[cur]) return cur;
  const v = readStored();
  cur = packs[v] ? v : DEFAULT;
  return cur;
}

/** 切换语言并持久化；未注册的语言返回 false */
function set(code) {
  if (!packs[code]) return false;
  if (code === current()) return true;
  cur = code;
  try { if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') wx.setStorageSync(KEY, code); } catch (e) { /* ignore */ }
  listeners.slice().forEach((fn) => { try { fn(code); } catch (e) { /* 一个订阅者出错不影响其他 */ } });
  return true;
}

function pack(code) { return packs[code] || packs[current()]; }
function meta(code) { return pack(code).meta; }
function list() { return order.map((c) => packs[c].meta); }

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

module.exports = { current, set, pack, meta, list, onChange, register, DEFAULT };
