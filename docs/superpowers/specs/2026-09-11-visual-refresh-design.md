# 子项目 5：视觉重构（方案 C · 柔和游戏化）—— 设计说明

日期：2026-09-11
视觉稿：https://claude.ai/code/artifact/1f713f6d-9eab-498e-bc0a-39a0f8d7cf60（第一页，负责人已确认）

## 1. 视觉系统（`miniprogram/app.wxss`）

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--bg` | #FFF7EE | 页面底色 |
| `--ink` | #3B2F2A | 正文 |
| `--muted` | #B08A78 | 次要文字、未选中图标 |
| `--muted-2` | #7C5A4C | 卡片内说明 |
| `--accent` | #C2410C | Fidel 文字、主按钮、当前 Tab、星星数字 |
| `--peach` | #FFE1C7 | 问候卡、待办方块、次按钮、"忘了" |
| `--mint` / `--mint-ink` / `--mint-deep` | #DDF3EA / #2F7A5E / #1E5C45 | 完成、正确、复习、"记得" |
| `--lav` / `--lav-ink` / `--lav-muted` | #E9E4FB / #4C3D8F / #6B58B5 | 实战任务、跟读、"模糊" |
| `--gold` | #F59E0B | 星星图标 |
| `--card` | #FFFFFF | 卡片 |
| `--shadow` | 0 20rpx 60rpx rgba(194,65,12,0.08) | 卡片阴影 |
| `--danger` | #B23A2E | 破坏性操作 |

- 圆角：卡片 44–64rpx，行 44rpx，按钮与标签 999rpx，方块 24rpx。
- 字号阶梯（rpx）：22 / 24 / 26 / 28 / 30 / 32 / 36 / 44 / 56 / 92。
- Fidel：class `.am` 使用 `font-family: "NotoSansEthiopic", system-ui`，700 字重，颜色 `--accent`；字体通过 `utils/fonts.js` 从云存储加载（`config.fidelFontFileID`），失败回退系统字体（iOS Kefa / Android Noto 均能显示埃塞文字）。
- 动效：闪卡翻面 `rotateY` 360ms；答题对错 `pulse` 300ms；任务打钩 `pop` 240ms；页面卡片进入 `rise` 280ms（transform + opacity）。
- 图标：自定义组件 `components/icon`（`<x-icon name size color>`），内部把 SVG 路径转成 data URI 的 `<image>`，线性 2.2 描边；禁止 emoji。图标集：home、book、cards、spark、speaker、mic、check、chevron-right、chevron-left、search、flame、star、play、swap、plus、trash、cloud、user、clock。
- Tab 栏：`app.json` `tabBar.custom: true`，组件 `custom-tab-bar/`，悬浮胶囊（白底、阴影、四项），当前项为橙色胶囊带文字；四个 Tab 页 `onShow` 调 `this.getTabBar().setData({ selected })`。

## 2. 积分与徽章（`miniprogram/utils/points.js`）

- 进度对象新增 `stars`（总数）、`starLog`（date → 当日星数）、`badges`（id → date）。
- 奖励：清空当日到期卡 10（一次学习会话内到期归零时一次）、首次学完单元 30、小测 20（≥80% 再 +10）、实战任务 40、跟读评分每次 8、Fidel 批次通过 15。
- 徽章（判定函数在 points.js，`checkBadges(progress)` 返回新获得的列表）：
  - `first-words` 开口者：完成第 1 周实战
  - `streak-7` 七日连续：连续 ≥ 7 天
  - `streak-14` 两周不断：连续 ≥ 14 天
  - `phone-pro` 电话达人：u15 已学且小测最好 ≥ 80
  - `site-lead` 现场指挥：u14 已学且第 4 周实战完成
  - `formal-master` 敬语大师：u16 已学且小测最好 ≥ 80
  - `hundred-words` 百词斩：闪卡总数 ≥ 100
  - `star-collector` 星星收藏家：stars ≥ 500
- `nextBadge(progress)` 返回最接近的未获得徽章与进度文案（如"再坚持 5 天解锁「七日连续」"）。
- 首页展示：连续天数胶囊 + 下一徽章提示；任务行右侧显示可得星数；新徽章弹 `wx.showModal` 祝贺。

## 3. 页面

全部 11 个页面按视觉稿重写 wxss，wxml 只做结构与图标替换，js 只加积分调用与 Tab 选中，不改学习逻辑。要点：

- 今日：桃色问候卡（Fidel 问候 + 连续天数 + 徽章提示）、薄荷 / 薰衣草状态块（分钟环、到期卡）、任务白卡（方块勾选 + 星数）、薰衣草实战卡（7 天点进度）、搜索胶囊。
- 课程：每周一张白卡，主题行用桃色标签，单元行图标方块，自选单元灰标签。
- 单元详情：桃色头部（标题、场景、"为什么学"白色气泡、词数 / 对话 / 分钟 / +30 星标签）、胶囊 Tab、词句行（薄荷播放方块、薰衣草跟读方块）、底部橙色胶囊主按钮 + 薄荷次按钮。
- 闪卡：分段进度条、白色大卡（薄荷 / 薰衣草装饰圆、单元标签、播放圆钮、Fidel、转写、中文）、桃 / 薰衣草 / 薄荷三色评分胶囊、翻面动画。
- 小测：选项白色胶囊，正确薄荷、错误桃色；听力题大播放圆钮。
- 跟读：按视觉稿；分数环薄荷；逐词薄荷 / 桃色标签。
- 教练：用户气泡橙色，助手白色；Fidel 片段薄荷标签；三个子 Tab 胶囊。
- Fidel：表格单元白底圆角，基础字橙色。
- 计划：周卡片桃色序号方块，当前周描边橙色。
- 我的：六宫格彩色状态块（分钟薄荷、词数薰衣草、星星桃色…），徽章墙（已获得彩色、未获得灰）。
- 搜索：结果行同单元详情词句行。

## 4. 验证

- `node --check` 全部 js，WXML 标签配对，`grep` 确认 wxml 内无 emoji 字符。
- 模拟脚本：`points.award` 累加、`checkBadges` 在满足条件时返回徽章、`nextBadge` 文案非空；学单元后 `stars === 30`。
- 视觉只能在开发者工具确认。
