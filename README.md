# AmharicLeander

面向在埃塞俄比亚工作/生活的中文使用者的阿姆哈拉语速成微信小程序，以工作沟通为主线。
8 周学习计划按成人学习特性设计，面向 IT / 通信 / 设备交付行业的司机后勤、一线班组、办公室同事、客户与政府沟通，后台对接 DeepSeek 做学习进度诊断和计划修改建议，接 Azure 语音做阿姆哈拉语朗读与发音评分。

## 功能

| 模块 | 说明 |
| --- | --- |
| 今日 | 按计划自动生成当天任务（复习 / 新单元 / 小测 / Fidel / 实战任务），记录时长和连续天数 |
| 课程 | 16 个场景单元、374 条词句：问候、数字、市场砍价、打车指路、埃塞时间、餐馆、代词句型、工作、动词、健康紧急、住宿日常，以及现场班组、电话沟通、正式敬语三个工作场景。每条含 Fidel 原文、拉丁转写、中文、对男/对女形式 |
| 复习 | SM-2 间隔重复闪卡，每日新卡上限可调，忘了的卡 10 分钟后重现 |
| 小测 | 10 题选择题，阿→中 / 中→阿 交替，错得多的词优先出现，结果回写 SRS |
| Fidel | 33 个基础辅音 × 7 序全表，分 5 批渐进学习，认读自测 |
| 计划 | 8 周计划、每周"为什么学"、实战任务、里程碑；展示 AI 调整 |
| AI 教练 | DeepSeek 进度诊断（优势/薄弱/风险/建议/未来 7 天）、计划调整（按周改动 + 依据，可一键采纳）、随时问教练 |
| 查词句 | 现场急用：中文 / 转写 / 阿姆哈拉语模糊搜索全部词句，长按复制，可直接加入闪卡 |
| 语音 | Azure 阿姆哈拉语朗读（课程、闪卡、搜索结果、教练回复，男 / 女声、正常 / 慢速）、小测与闪卡听力题、跟读录音、发音评分（分数 + 识别文字 + 逐词对错） |
| 我的 | 每日目标、新词上限、开始日期、声音与语速、云端同步状态、立即上传 / 从云端恢复 |

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
  utils/audio.js        语音播放、本地缓存、预取
  pages/                11 个页面（含 speak 跟读评分）
cloudfunctions/api/     微信云函数：进度存储 + DeepSeek 诊断 / 计划调整 / 教练对话 + Azure 语音
  handler.js            纯逻辑（可本地测试）
  prompts.js            提示词（含成人学习原则）
  deepseek.js           DeepSeek Chat Completions 调用
  speech.js             tts.get / tts.batch / stt.score（云端缓存 + 每日上限）
  scoring.js            发音评分（归一化 + Levenshtein 相似度 + 逐词匹配）
  azure.js              Azure Speech REST（合成 / 识别）
  storage.js            云存储适配器
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
3. 云开发控制台 → 数据库 → 新建集合 `progress`、`ai_logs` 和 `tts_cache`，权限选「仅创建者可读写」。
4. 云开发控制台 → 云函数 → `api` → 配置 → 环境变量，添加 `DEEPSEEK_API_KEY`（[platform.deepseek.com](https://platform.deepseek.com) 申请）。可选 `DEEPSEEK_MODEL`，默认 `deepseek-chat`。
5. 注册 [Azure](https://portal.azure.com) 账号，创建「语音服务」（Speech）资源，定价层选 F0 免费（每月 50 万字符合成、5 小时识别），区域建议 `southeastasia` 或 `eastasia`。
6. 同一环境变量页添加 `AZURE_SPEECH_KEY`（资源的密钥）和 `AZURE_SPEECH_REGION`（如 `southeastasia`）。
7. 语音音频缓存在云存储 `tts/` 目录和第 3 步的 `tts_cache` 集合里；跟读需要小程序录音权限，真机首次录音会弹授权。

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
| `tts.get` | `{text, voice: 'female'\|'male', rate: 'normal'\|'slow'}` | 合成朗读，返回 `{url, key}`；命中 `tts_cache` 不再调 Azure |
| `tts.batch` | `{items: [{id, text}], voice, rate}`（最多 40 条） | 批量取 url，返回 `{urls: {id: url}}`，缺失项并行生成 |
| `stt.score` | `{fileID, target}` | 识别云存储里的录音并评分，返回 `{transcript, score, words}`；处理完删除录音 |
| `usage.get` | 无 | 本人今日 AI / 语音 / 评分用量与上限，本月语音字符 |
| `admin.usage` | 无 | 管理员（`ADMIN_OPENIDS`）查看最近 7 天各用户用量 |

每人每日上限默认：AI（`ai.diagnose` / `ai.adjustPlan` / `ai.chat`）20 次、`tts` 缓存未命中 300 次、`stt.score` 100 次；全体用户本月语音字符默认 40 万。可用云函数环境变量 `AI_DAILY_LIMIT`、`TTS_DAILY_LIMIT`、`STT_DAILY_LIMIT`、`TTS_MONTHLY_CHARS_LIMIT` 调整；`ADMIN_OPENIDS`（逗号分隔 openid）指定谁能在「我的」页看到团队用量。DeepSeek 与 Azure 密钥只存在云函数环境变量里。

## 学习计划概览

| 周 | 主题 | 主单元 | 自选 | 实战任务 |
| --- | --- | --- | --- | --- |
| 1 | 打招呼 + 数字 1–10 | u01, u02 | — | 向门卫、司机、同事各问候一个来回 |
| 2 | 安排工作 + 时间 | u10, u06 | u13 住宿日常 | 用阿姆哈拉语给司机安排一次明天的行程（时间 + 地点） |
| 3 | 电话沟通 + 交通方位 | u15, u05 | u03 市场购物 | 给本地同事打一个阿姆哈拉语电话（在哪、几点到） |
| 4 | 现场与班组 + 第一次复盘 | u14 | u07 餐馆 | 在现场向班组布置一件事并确认完成；周末 AI 诊断 |
| 5 | 句子骨架 | u08, u09 | u04 大数字 | 每天向同事问一个真实问题并听懂回答 |
| 6 | 动词 + 正式场合 | u11, u16 | — | 用敬语接待一位客户或合作方 |
| 7 | 健康紧急 + 综合工作对话 | u12 | — | 向后勤或房东报告一个问题并跟进到解决 |
| 8 | 综合复习 + 5 个工作实战 | — | — | 安排行程 / 电话约时间 / 现场布置任务 / 敬语接待 / 报告并解决问题 |

每天约 33 分钟：8 分钟闪卡复习 + 15 分钟新内容 + 10 分钟小测或实战。自选单元在每周第 5、6 天出现，不计入周完成度。
设计依据见 [docs/learning-plan.md](docs/learning-plan.md)。

## 说明

- 阿姆哈拉语朗读与发音评分由 Azure 语音服务提供（`am-ET-MekdesNeural` 女声 / `am-ET-AmehaNeural` 男声），合成结果缓存在云存储，本机再缓存一份，同一句只合成一次。
- 词汇为亚的斯亚贝巴日常口语，第二人称区分对男 / 对女形式，注意 note 字段。
