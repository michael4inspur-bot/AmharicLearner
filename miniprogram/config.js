// 云开发环境 id。在微信开发者工具「云开发」控制台创建环境后填入，例如 'amharic-1a2b3c'。
module.exports = {
  cloudEnv: 'cloud1-d4g658z1x5264f151',
  // 可选：云存储里的 Noto Sans Ethiopic 字体文件 fileID（cloud://...），留空用系统字体
  fidelFontFileID: '',
  // 是否显示试用版语言（meta.beta = true，目前是奥罗莫语）。
  // 提审前母语者校对未完成时改为 false：语言入口整体隐藏，已选试用版语言的用户回到阿姆哈拉语。
  showBetaLangs: true,
  // 构建标记：启动时打印到 Console，也显示在「我的 → 关于」。
  // 排查"改了代码但工具还跑旧版"时，先看这个值对不对。每次改动请手动更新。
  buildTag: '2026-09-30 第二版开发（奥罗莫语试用版）'
};
