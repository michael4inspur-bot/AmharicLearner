// 隐私指引与 AI 生成内容声明。正文与 mp.weixin.qq.com 后台「用户隐私保护指引」「服务内容声明」保持一致（见 README 第 5 节）。
const privacy = require('../../utils/privacy.js');

Page({
  data: { items: privacy.ITEMS, thirdParties: privacy.THIRD_PARTIES, aigc: privacy.AIGC, updated: privacy.UPDATED },
  openContract() {
    // 打开微信后台配置的正式《用户隐私保护指引》；开发者工具或旧基础库没有此接口时静默
    if (wx.openPrivacyContract) wx.openPrivacyContract({ fail() {} });
  }
});
