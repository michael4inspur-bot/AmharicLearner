// Fidel 专用字体：从云存储加载 Noto Sans Ethiopic（config.fidelFontFileID），失败静默回退系统字体。
const config = require('../config.js');

let loaded = false;

function loadFidelFont() {
  if (loaded || !config.fidelFontFileID) return;
  if (typeof wx === 'undefined' || !wx.cloud || !wx.loadFontFace || !wx.cloud.getTempFileURL) return;
  loaded = true;
  try {
    wx.cloud.getTempFileURL({
      fileList: [config.fidelFontFileID],
      success: (res) => {
        const f = res.fileList && res.fileList[0];
        if (!f || !f.tempFileURL) return;
        wx.loadFontFace({
          family: 'NotoSansEthiopic',
          source: `url("${f.tempFileURL}")`,
          global: true,
          scopes: ['webview', 'native'],
          fail: () => { /* 回退系统字体 */ }
        });
      },
      fail: () => { /* ignore */ }
    });
  } catch (e) { /* ignore */ }
}

module.exports = { loadFidelFont };
