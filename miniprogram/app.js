const progress = require('./utils/progress.js');

App({
  globalData: { version: '0.1.0' },
  onLaunch() {
    progress.load();
  }
});
