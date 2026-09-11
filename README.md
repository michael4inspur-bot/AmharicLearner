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
| 我的 | 每日目标、新词上限、开始日期、后台地址、进度上传/恢复 |

## 目录

```
miniprogram/          微信小程序（原生 WXML/WXSS/JS，无第三方依赖）
  data/vocab.js       词汇与对话
  data/plan.js        8 周计划与每日任务生成
  data/fidel.js       Fidel 字母表
  utils/srs.js        SM-2 算法
  utils/progress.js   进度存储、统计、给 AI 的摘要
  utils/api.js        后台请求与登录
  pages/              9 个页面
server/               Node.js + Express 后台
  src/deepseek.js     DeepSeek Chat Completions 调用
  src/prompts.js      诊断 / 调整 / 教练提示词（含成人学习原则）
  src/routes.js       API 路由
docs/learning-plan.md 学习计划设计说明
```

## 快速开始

### 1. 后台

```bash
cd server
cp .env.example .env      # 填入 DEEPSEEK_API_KEY；可选 WX_APPID / WX_SECRET
npm install
npm test
npm start                 # http://localhost:3000
```

API（均以 `/api` 开头）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /auth/login | `{code}` 微信 code 换 token；未配置 AppID 时匿名开发模式 |
| GET/PUT | /progress | 读取 / 上传学习进度 |
| POST | /ai/diagnose | `{summary, planOutline}` → 诊断 JSON |
| POST | /ai/adjust-plan | `{summary, planOutline, diagnosis?, request?}` → 计划调整 JSON |
| POST | /ai/chat | `{messages, summary}` → 教练回复 |
| GET | /ai/history | 最近的 AI 记录 |

部署到公网时需要 HTTPS（可用 Nginx + Let's Encrypt 反代），并在微信公众平台
「开发 → 开发设置 → 服务器域名」中把域名加入 request 合法域名。

### 2. 小程序

1. 用微信开发者工具打开仓库根目录（`project.config.json` 已指向 `miniprogram/`），把 `appid` 改成自己的。
2. 开发阶段勾选「不校验合法域名」，在小程序「我的」页填后台地址，例如 `http://192.168.1.10:3000/api`，点「测试连接」。
3. 正式发布前把 `miniprogram/utils/api.js` 里的 `DEFAULT_BASE_URL` 改成你的 HTTPS 域名。

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
