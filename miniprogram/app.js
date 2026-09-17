const config = require('./config.js');
const progress = require('./utils/progress.js');
const sync = require('./utils/sync.js');
const fonts = require('./utils/fonts.js');

App({
  globalData: { version: '0.3.0', buildTag: config.buildTag },
  onLaunch() {
    // 这一行用来确认工具编译的是哪一版代码，排查缓存/目录不一致时最先看它
    console.log('[build]', config.buildTag, '| cloudEnv:', config.cloudEnv || '(未配置)');
    if (wx.cloud && config.cloudEnv) {
      wx.cloud.init({ env: config.cloudEnv, traceUser: true });
    }
    progress.load();
    fonts.loadFidelFont();
    // 每次进度保存后 3 秒内合并上传一次
    progress.setOnSaved(() => sync.scheduleSync(3000));
  },
  onHide() {
    // 切到后台时把进度静默上传到云端（未配置云环境时跳过）
    sync.syncNow();
  }
});
