const progress = require('./utils/progress.js');
const sync = require('./utils/sync.js');

App({
  globalData: { version: '0.2.0' },
  onLaunch() {
    progress.load();
    // 每次进度保存后 3 秒内合并上传一次
    progress.setOnSaved(() => sync.scheduleSync(3000));
  },
  onHide() {
    // 切到后台时把进度静默上传到服务器（未配置后台时跳过）
    sync.syncNow();
  }
});
