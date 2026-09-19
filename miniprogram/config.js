// 云开发环境 id。在微信开发者工具「云开发」控制台创建环境后填入，例如 'amharic-1a2b3c'。
module.exports = {
  cloudEnv: 'cloud1-d4g658z1x5264f151',
  // 可选：云存储里的 Noto Sans Ethiopic 字体文件 fileID（cloud://...），留空用系统字体
  fidelFontFileID: '',
  // AI 教练总开关。微信个人主体未开放深度合成类目（AI 问答、AI 生成内容），
  // 故整个「AI 教练」Tab 默认下线。换成企业主体后要恢复，改这里为 true，
  // 并把 app.json 的 tabBar.list 里那条 pages/coach/coach 加回去（README 合规说明有原文）。
  aiCoachEnabled: false,
  // 构建标记：启动时打印到 Console，也显示在「我的 → 关于」。
  // 排查"改了代码但工具还跑旧版"时，先看这个值对不对。每次改动请手动更新。
  buildTag: '2026-09-19 审核整改：隐私同意 + 首页不索要授权 + AI 教练整体下线'
};
