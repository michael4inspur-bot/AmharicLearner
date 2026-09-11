# AmharicLeander

面向在埃塞俄比亚工作/生活的中文使用者的阿姆哈拉语速成微信小程序。
8 周生存级学习计划按成人学习特性设计，后台对接 DeepSeek 做学习进度诊断和计划修改建议。

## 功能

| 模块 | 说明 |
| --- | --- |
| 今日 | 按计划自动生成当天任务（复习 / 新单元 / 小测 / Fidel / 实战任务），记录时长和连续天数 |
| 课程 | 13 个场景单元、289 条词句：问候、数字、市场砍价、打车指路、埃塞时间、餐馆、代词句型、工作、动词、健康紧急、住宿日常。每条含 Fidel 原文、拉丁转写、中文、对男/对女形式 |
| 复习 | SM-2 间隔重复闪卡，每日新卡上限可调，忘了的卡 10 分钟后重现 |
| 小测 | 10 题选择题，阿→中 / 中→阿 交替，错得多的词优先出现，结果回写 SRS |
| Fidel | 33 个基础辅音 × 7 序全表，分 5 批渐进学习，认读自测 |
| 计划 | 8 周计划、每周"为什么学"、实战任务、里程碑；展示 AI 调整 |
| AI 教练 | DeepSeek 进度诊断（优势/薄弱/风险/建议/未来 7 天）、计划调整（按周改动 + 依据，可一键采纳）、随时问教练 |
| 查词句 | 现场急用：中文 / 转写 / 阿姆哈拉语模糊搜索全部词句，长按复制，可直接加入闪卡 |
| 我的 | 每日目标、新词上限、开始日期、云端同步状态、立即上传 / 从云端恢复 |

## 目录

```
miniprogram/            微信小程序（原生 WXML/WXSS/JS，无第三方依赖）
  config.js             云开发环境 id
  data/vocab.js         词汇与对话
  data/plan.js          8 周计划与每日任务生成
  data/fidel.js         Fidel 字母表
  utils/srs.js          SM-2 算法
  utils/progress.js     进度存储、统计、给 AI 的摘要
  utils/api.js          云函数调用封装
  utils/sync.js         进度自动同步
  pages/                10 个页面
cloudfunctions/api/     微信云函数：进度存储 + DeepSeek 诊断 / 计划调整 / 教练对话
  handler.js            纯逻辑（可本地测试）
  prompts.js            提示词（含成人学习原则）
  deepseek.js           DeepSeek Chat Completions 调用
  db.js                 云数据库适配器
scripts/sim-miniprogram.js  小程序端到端模拟
docs/learning-plan.md   学习计划设计说明
docs/superpowers/       设计 spec 与实施计划
```

## 快速开始

后台运行在微信云开发上，不需要服务器、域名和备案。

### 1. 本地测试

```bash
npm test     # 云函数单元测试 + 小程序端到端模拟
```

### 2. 注册与开通（只需一次）

1. 在 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册个人主体小程序（需大陆身份证、手机号、本人微信），把 AppID 填进 `project.config.json` 的 `appid`。
2. 用微信开发者工具打开仓库根目录，点工具栏「云开发」，创建环境，把环境 id 填进 `miniprogram/config.js` 的 `cloudEnv`。云开发为付费套餐，个人最低档约每月 20 元，以控制台为准。
3. 云开发控制台 → 数据库 → 新建集合 `progress` 和 `ai_logs`，权限选「仅创建者可读写」。
4. 云开发控制台 → 云函数 → `api` → 配置 → 环境变量，添加 `DEEPSEEK_API_KEY`（[platform.deepseek.com](https://platform.deepseek.com) 申请）。可选 `DEEPSEEK_MODEL`，默认 `deepseek-chat`。

### 3. 部署与分发

1. 开发者工具中右键 `cloudfunctions/api` → 「上传并部署：云端安装依赖」。以后每次改后台都重复这一步。
2. 开发者工具「上传」代码，到 mp.weixin.qq.com「版本管理」把该版本设为体验版。
3. 「成员管理」添加同事微信号为体验成员（个人主体上限 15 人），扫体验二维码即可使用。

### 云函数接口

小程序通过 `wx.cloud.callFunction({ name: 'api', data: { action, data } })` 调用，返回 `{ok: true, data}` 或 `{ok: false, code, error}`。

| action | 入参 | 说明 |
| --- | --- | --- |
| `progress.get` | 无 | 读取云端进度 |
| `progress.put` | `{progress}` | 整份覆盖上传 |
| `ai.diagnose` | `{summary, planOutline}` | 学习进度诊断 |
| `ai.adjustPlan` | `{summary, planOutline, diagnosis?, request?}` | 计划调整建议 |
| `ai.chat` | `{messages, summary}` | AI 教练对话 |
| `ai.history` | 无 | 最近 30 条诊断 / 调整记录 |

AI 动作每人每天 20 次；密钥只存在云函数环境变量里。

## 学习计划概览

| 周 | 主题 | 实战任务 |
| --- | --- | --- |
| 1 | 打招呼 + 数字 1–10 | 向 3 个人用阿姆哈拉语打招呼 |
| 2 | 市场购物 + 大数字 | 去市场用阿姆哈拉语砍价一次 |
| 3 | 交通方位 + 埃塞时间 | 打车谈价指路，用埃塞时间约一次 |
| 4 | 餐馆点餐 + 第一次 AI 诊断 | 全程阿姆哈拉语点一餐 |
| 5 | 代词 / 有 / 疑问词 / 形容词 | 每天向同事问一个真实问题 |
| 6 | 工作场景 + 动词 | 用阿姆哈拉语安排一件明天的事 |
| 7 | 健康紧急 + 住宿日常 | 药店买药，向房东报告问题 |
| 8 | 综合复习 + 5 个实战挑战 + AI 结业诊断 | 砍价 / 打车 / 点餐 / 约时间 / 描述问题 |

每天约 20 分钟：5 分钟闪卡复习 + 10 分钟新内容 + 5 分钟小测或实战。
设计依据见 [docs/learning-plan.md](docs/learning-plan.md)。

## 说明

- 小程序无法内置阿姆哈拉语 TTS，发音以转写为主；建议配合当地同事或 Google Translate 听读。
- 词汇为亚的斯亚贝巴日常口语，第二人称区分对男 / 对女形式，注意 note 字段。
