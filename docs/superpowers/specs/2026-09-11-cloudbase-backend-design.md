# 子项目 1：后台迁移到微信云开发 —— 设计说明

日期：2026-09-11
状态：已与项目负责人逐段确认，待审阅

## 1. 背景与目标

Amharic Learner 现有后台是 Express 服务器，要求小程序通过 HTTPS 域名访问。微信要求小程序请求域名完成 ICP 备案，项目负责人在埃塞俄比亚无法办理，也没有服务器和小程序 AppID。

本子项目把后台迁移到微信云开发（云函数 + 云数据库），消除域名、备案、服务器和登录接口。它是后续子项目（语音、内容重构、多用户配额）的底座。

需求来源（brainstorming 结论）：

- 使用者：项目负责人和身边几个同事，体验版分发即可。
- 8 周目标：工作沟通（IT/通信/设备交付行业），对象覆盖司机后勤、一线工人班组、办公室同事、客户与政府。
- 必须有语音，可接云 TTS（子项目 2）。
- 每天 30 到 45 分钟（影响子项目 3 的内容量）。

## 2. 非目标

- 不做 TTS、不改学习内容、不做完整配额系统。这些分别属于子项目 2、3、4。
- 不做字段级进度合并。一个人只在一台手机上学，云端整份覆盖即可。
- 不保留 Express 后台作为备选。

## 3. 架构

```
小程序页面 ──> utils/api.js ──> wx.cloud.callFunction('api', {action, data})
                                        │
                                  云函数 api/index.js（取 openid，分发）
                                        │
                                  api/handler.js（纯逻辑，依赖注入）
                                   ├── 云数据库 progress、ai_logs
                                   └── DeepSeek Chat Completions
```

### 3.1 云函数 `api`

- 单一函数，`data.action` 分发，共 6 个动作：

| action | 入参 | 出参 data |
| --- | --- | --- |
| `progress.get` | 无 | `{progress, updatedAt}`，无记录时 `progress: null` |
| `progress.put` | `{progress}` | `{updatedAt}` |
| `ai.diagnose` | `{summary, planOutline}` | 诊断 JSON（结构同现有 prompts.js） |
| `ai.adjustPlan` | `{summary, planOutline, diagnosis?, request?}` | 计划调整 JSON |
| `ai.chat` | `{messages, summary}` | `{reply}` |
| `ai.history` | 无 | `{history: [...]}`，最近 30 条 |

- 超时 60 秒（`config.json`），DeepSeek 内部超时 50 秒。诊断 `max_tokens` 2000，调整 2000，对话 1200。
- 密钥与模型从环境变量读取：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`（默认 `deepseek-chat`）、`DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com`）。
- 文件布局：

```
cloudfunctions/api/
  index.js        取 openid，调 handler，捕获异常
  handler.js      handle(action, data, ctx) 纯逻辑；ctx = {openid, db, deepseek, now}
  prompts.js      从 server/src/prompts.js 搬来，改 CommonJS，内容不变
  deepseek.js     从 server/src/deepseek.js 搬来，改 CommonJS
  config.json     {"timeout": 60}
  package.json    依赖 wx-server-sdk
  test/           node:test，用内存假 db 与假 deepseek
```

### 3.2 云数据库

- `progress`：`_id` = openid。字段 `progress`（整份对象）、`updatedAt`。
- `ai_logs`：每条一个文档。字段 `openid`、`type`（`diagnosis` | `plan` | `chat`）、`date`（ISO 字符串）、`request`（调整诉求或对话最后一条用户消息，截断 500 字）、`result`（诊断/调整 JSON；对话只存 `{reply}` 前 500 字）。写入后按 openid 只保留最近 30 条 `diagnosis`/`plan`；`chat` 记录只用于当日计数，`ai.history` 不返回它，超过 7 天的 `chat` 记录在下次写入时顺带删除。
- 权限：两集合均设为"仅创建者可读写"，云函数用管理权限访问。

### 3.3 小程序侧

- `utils/api.js`：`call(action, data)` 封装 `wx.cloud.callFunction`；返回 `ok: false` 时抛 `Error`，`err.code` 带上 code。删除登录、token、baseUrl。
- `miniprogram/config.js`：`{ cloudEnv: '' }`，负责人创建环境后填入。
- `app.js`：`wx.cloud.init({ env: config.cloudEnv, traceUser: true })`。
- `utils/sync.js`：`configured()` 改为 `!!config.cloudEnv`。
- `pages/profile`：删除服务器地址输入与"测试连接"，保留"立即上传"、"从服务器恢复"，显示云环境是否已配置。
- `pages/coach`：`fail()` 按 code 给文案。
- `app.json`：`networkTimeout.request` 设 60000。
- `project.config.json`：加 `cloudfunctionRoot: "cloudfunctions/"`。

### 3.4 删除

- `server/` 整个目录（含 Dockerfile、docker-compose.yml、nginx.example.conf、tests）。
- README 中的 Express/Docker/Nginx 部署段落，替换为云开发部署清单。

## 4. 数据流

- 进度：本地存储为主。每次保存后 3 秒合并上传一次，切后台时上传，换手机时"从服务器恢复"整份覆盖本地。
- AI：小程序本地生成摘要（不含聊天记录与 SRS 明细），云函数拼提示词调 DeepSeek，结果写 `ai_logs` 后原样返回，小程序写本地 aiHistory。

## 5. 错误处理

云函数统一返回：

```
成功  { ok: true,  data }
失败  { ok: false, code, error }
```

| code | 触发 | 小程序文案 |
| --- | --- | --- |
| `BAD_REQUEST` | 未知 action、缺参数、超每日上限 | 按 error 原文显示 |
| `NO_API_KEY` | 未配置 `DEEPSEEK_API_KEY` | 管理员还没配置 DeepSeek 密钥 |
| `UPSTREAM` | DeepSeek 非 200、内容为空、JSON 解析失败 | AI 服务暂时不可用，稍后再试 |
| `TIMEOUT` | DeepSeek 超过 50 秒 | AI 响应超时，请重试 |

`index.js` 捕获所有未预期异常，返回 `UPSTREAM` 并记录 `console.error`。

## 6. 最低限度费用边界

AI 三个动作按 openid 统计当日 `ai_logs` 条数，达到 20 次返回 `BAD_REQUEST`，error 为"今天的 AI 次数已用完（20 次），明天再来"。完整配额与管理界面属于子项目 4。

## 7. 测试

`cloudfunctions/api/test/` 用 node:test，不连云端：

1. 分发：未知 action 返回 `BAD_REQUEST`；缺 `summary` 返回 `BAD_REQUEST`。
2. 进度：put 后 get 返回同一对象与 updatedAt；不同 openid 互不可见。
3. AI：假 deepseek 返回固定 JSON 时，diagnose 结果写入 `ai_logs` 并原样返回；缺密钥返回 `NO_API_KEY`；假 deepseek 抛超时返回 `TIMEOUT`。
4. 上限：第 21 次 AI 调用返回 `BAD_REQUEST`。
5. history：只返回 diagnosis/plan，最多 30 条，按时间倒序。

小程序侧沿用现有模拟脚本，增加 `wx.cloud.callFunction` 假实现，跑通同步与 AI 调用路径。

## 8. 上线步骤（负责人手动）

1. 注册个人主体小程序（mp.weixin.qq.com，需大陆身份证、手机号、本人微信），AppID 填 `project.config.json`。
2. 开发者工具开通云开发，创建环境，环境 id 填 `miniprogram/config.js`。云开发为付费套餐，个人最低档约每月 20 元，以控制台为准。
3. 云开发控制台 → 云函数 `api` → 环境变量，填 `DEEPSEEK_API_KEY`。
4. 开发者工具右键 `cloudfunctions/api` → 上传并部署：云端安装依赖。
5. 上传代码，设为体验版，成员管理添加同事微信号（个人主体上限 15 人）。

依赖顺序：1 → 2 → {3, 4, 5}。开发与测试不依赖这些步骤。

## 9. 验收标准

- `cd cloudfunctions/api && npm test` 全部通过。
- 仓库中不再有 `server/`。
- 小程序模拟脚本跑通：同步、诊断、调整、对话在假云函数下返回预期结构。
- README 部署段落只描述云开发路径。
- 负责人完成第 8 节步骤后，在真机体验版上能完成一次诊断。
