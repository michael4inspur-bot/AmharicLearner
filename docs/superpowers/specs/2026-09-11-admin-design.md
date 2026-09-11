# 子项目 6：小程序内管理端 —— 设计说明

日期：2026-09-11
状态：与负责人逐段确认，待审阅

## 1. 目标

给管理员（`ADMIN_OPENIDS`）一个小程序内的管理页面：管理用户账号、查看系统与费用、发公告。不查看任何人的 AI 诊断正文与对话。每个用户自己填昵称。

## 2. 非目标

- 不做独立 Web 后台。
- 不看单元成绩明细、诊断内容、对话记录。
- 不做词汇 / 计划的在线编辑。
- 管理员名单仍由环境变量 `ADMIN_OPENIDS` 决定，不做界面上的角色管理。

## 3. 数据

三个新集合，权限均为"仅创建者可读写"，云函数用管理权限访问：

| 集合 | 文档 | 字段 |
| --- | --- | --- |
| `users` | `_id` = openid | `nickname`（string，可空）、`status`（`active` \| `paused` \| `blocked`，默认 active）、`createdAt`、`lastActive`、`week`、`streak`、`stars` |
| `settings` | `_id` = `announcement` | `text`、`updatedAt`、`by` |
| `error_logs` | 自动 id | `date`、`openid`、`action`、`message`（≤ 300 字），保留最近 200 条 |

- `progress.put` 成功后 upsert `users` 摘要：`lastActive = now`，`week`/`streak`/`stars` 取自上传的 progress（`currentWeek` 由云端按 `startDate` 计算与客户端相同的公式；客户端把 `summary` 里的 `currentWeek`、`streak` 随 progress 一起上传到 `data.meta`，云端优先用 meta）。
- 摘要计算放在客户端 `api.syncProgress(progress, meta)`，`meta = {week, streak, stars}`。

## 4. 云函数动作

| action | 权限 | 入参 | 出参 / 行为 |
| --- | --- | --- | --- |
| `user.setProfile` | 本人 | `{nickname}` 1–20 字，去首尾空白 | upsert `users.nickname`；返回 `{nickname}` |
| `user.me` | 本人 | 无 | `{openid, nickname, status}`（供"我的"页显示与复制 openid） |
| `announcement.get` | 所有人 | 无 | `{text, updatedAt}`，无公告时 `text: ''` |
| `admin.users` | 管理员 | 无 | `{users: [{openid, nickname, status, lastActive, week, streak, stars, today: {ai, tts, stt}, isSelf}]}`，按 lastActive 倒序；today 用当日 `ai_logs` 计数合并 |
| `admin.setStatus` | 管理员 | `{openid, status}` | 不能对自己；status 只允许三值；返回 `{openid, status}` |
| `admin.deleteUser` | 管理员 | `{openid, confirm: true}` | 不能对自己；删除 `progress`、`ai_logs`（分批）、`users` 文档改为 `{status:'blocked', nickname, deletedAt}`；返回 `{deleted: true}` |
| `admin.system` | 管理员 | 无 | `{monthChars:{used,limit}, aiToday, aiDaily:[{date, count}] 14 天, ttsCache:{count, chars}, errors:[最近 20 条]}` |
| `admin.clearTtsCache` | 管理员 | `{confirm: true}` | 分批 50：删云存储文件、删 `tts_cache` 文档；返回 `{removed}` |
| `admin.setAnnouncement` | 管理员 | `{text}` ≤ 500 字 | 写 `settings/announcement`；返回 `{text, updatedAt}` |

- 状态检查：`ai.*`、`tts.*`、`stt.*` 执行前读 `users.status`，`paused`/`blocked` → `BAD_REQUEST`"账号已被管理员暂停"；`progress.put` 与 `progress.get` 在 `blocked` 时 → `BAD_REQUEST`"账号已停用"。`users` 无记录视为 active。
- 破坏性动作缺 `confirm: true` → `BAD_REQUEST`"需要确认"。
- 管理员操作自己 → `BAD_REQUEST`"不能操作自己的账号"。
- `index.js` 兜底 catch 时写 `error_logs`（失败静默），并裁剪到 200 条。
- db 适配器新增：`getUser/putUser/listUsers/deleteUserData(openid)`、`getSetting/putSetting`、`addErrorLog/listErrorLogs/pruneErrorLogs`、`countAiByDay(sinceIso)`（按东非日分组，与配额计日一致）、`ttsCacheStats()`（count + sum chars）、`listTtsCache(limit)`、`removeTtsCache(ids)`。fakeDb 同步。

## 5. 小程序

- `utils/api.js` 新增 `setProfile`、`me`、`announcement`、`adminUsers`、`adminSetStatus`、`adminDeleteUser`、`adminSystem`、`adminClearTtsCache`、`adminSetAnnouncement`；`syncProgress(progress, meta)`。
- `utils/sync.js` 上传时带 `meta = {week: currentPosition().week, streak: streak(), stars}`。
- 「我的」：学习设置卡顶部加"昵称"行（`<input type="nickname">`，失焦保存本地 `profile_v1.nickname` 并调 `setProfile`）；"关于"卡显示自己的 openid（`user.me` 返回，未配云环境显示"未登录"），长按复制；团队用量卡替换为"管理"入口卡（仅 `isAdmin`）。
- 首页：`onShow` 调 `announcement.get`（失败静默），有文本且 `updatedAt` 与本地 `announcement_seen` 不同则显示薰衣草公告条，"知道了"记录本地；未填昵称且云环境已配置时显示桃色提示条，点去"我的"。
- 新页面 `pages/admin/admin`：三个胶囊 Tab。
  - 用户：列表行（昵称或"未命名 · 尾号 xxxx"、状态标签、最近活跃、第 N 周、连续 N 天、星星、今日 AI/语音/评分）；点击非本人行弹出操作面板（暂停 / 恢复、删除）；删除需二次确认弹窗（`wx.showModal`，内容含昵称与尾号）。
  - 系统：四个状态块（本月语音字符带进度条、今日 AI、语音缓存 + "清理"按钮、错误条数）、14 天 AI 调用柱状条（view 绘制）、最近 20 条错误。
  - 公告：多行输入 + 发布按钮，显示当前公告与更新时间；清空发布即撤下。
- AI / 语音 / 评分请求收到含"暂停"或"停用"的错误时统一弹窗"账号已被管理员暂停，请联系管理员"。

## 6. 测试

- 云函数：`handler.admin.test.js` 覆盖第 4 节每个动作的成功、鉴权失败、自我操作拒绝、缺 confirm 拒绝、状态拦截、`progress.put` 写摘要、`error_logs` 裁剪。
- 模拟脚本：非管理员 `adminUsers` 被拒；`ADMIN_OPENIDS=sim-user` 时列表含本人 `isSelf`；`setAnnouncement` 后 `announcement.get` 返回文本；`setProfile` 后 `admin.users` 显示昵称。

## 7. 上线

1. 云开发控制台新建集合 `users`、`settings`、`error_logs`（仅创建者可读写）。
2. 重新部署云函数。
3. 在"我的"页复制自己的 openid，填入云函数环境变量 `ADMIN_OPENIDS`。
