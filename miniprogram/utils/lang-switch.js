// 学习语言切换：首页标签和「我的」页共用。
const langs = require('../langs/index.js');
const audio = require('./audio.js');

/** 显示用的语言名：本族名 + 中文名，试用版加标注 */
function label(meta) {
  const m = meta || langs.meta();
  return `${m.native} ${m.name}${m.beta ? '（试用版）' : ''}`;
}

/** 弹出语言列表；选了不同的语言就切换，并回调 onChanged(code) 让页面刷新 */
function choose(onChanged) {
  const list = langs.list();
  wx.showActionSheet({
    itemList: list.map((m) => label(m)),
    success: (res) => {
      const m = list[res.tapIndex];
      if (!m || m.code === langs.current()) return;
      audio.stop();
      langs.set(m.code);
      if (typeof onChanged === 'function') onChanged(m.code);
    }
  });
}

/** 可选语言多于一种时才显示切换入口（试用版语言被隐藏后只剩一种） */
function available() { return langs.list().length > 1; }

module.exports = { label, choose, available };
