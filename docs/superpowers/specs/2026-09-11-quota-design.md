# 子项目 4：多用户与费用控制 —— 设计说明

日期：2026-09-11
状态：无人值守模式，决策由 AI 教练助手做出并记录

## 1. 目标

几位同事共用一个 DeepSeek key 与一个 Azure 资源。每人各自进度已由 openid 隔离；本子项目让上限可配置、用量可见、总额度有保护。

## 2. 变更

### 2.1 上限可配置（云函数）

- 环境变量 `AI_DAILY_LIMIT`（默认 20）、`TTS_DAILY_LIMIT`（默认 300）、`STT_DAILY_LIMIT`（默认 100）、`TTS_MONTHLY_CHARS_LIMIT`（默认 400000，全体用户合计，留 10 万给 Azure 免费层余量）。
- `handler.js` / `speech.js` 通过 `limits.js` 读取：`getLimits() => {ai, tts, stt, ttsMonthlyChars}`，非法值回退默认。
- TTS 未命中前检查本月（东非时间自然月）全体 `tts` 日志 `result.chars` 之和；超过 → `BAD_REQUEST`，error "本月语音额度已用完，下月恢复"。`db.sumTtsCharsSince(sinceIso)`：真实实现用聚合 `match({type:'tts', date: _.gte(sinceIso)}).group({_id: null, total: $.sum('$result.chars')})`。

### 2.2 用量查询

- 动作 `usage.get`（无入参）→ `{ai:{used,limit}, tts:{used,limit}, stt:{used,limit}, monthChars:{used,limit}, isAdmin}`。
- 动作 `admin.usage`：`ADMIN_OPENIDS` 环境变量（逗号分隔）包含当前 openid 才允许，否则 `BAD_REQUEST` "无权限"。返回最近 7 天按用户汇总：`{users:[{openid, ai, tts, stt, ttsChars, lastActive}], since}`，按 ai 降序。`db.listLogsSince(sinceIso, limit=2000)` 返回 `{openid, type, date, result}`。

### 2.3 小程序

- `api.js`：`usageGet()`、`adminUsage()`。
- 「我的」页：云端同步卡片下方显示"今日用量：AI x/20 · 语音 x/300 · 评分 x/100"，`onShow` 拉取，失败静默。`isAdmin` 时再显示"团队用量（7 天）"卡片：每行 openid 末 6 位、AI / 语音 / 评分次数、最近活跃日期。
- 教练页 `fail()`：error 含"已用完"时标题改为"今日额度已用完"。

## 3. 非目标

- 不做用户昵称、排行榜、管理员改额度界面（改环境变量即可）。

## 4. 测试

- `limits.test.js`：环境变量缺失用默认；非数字回退默认。
- `handler.usage.test.js`：`usage.get` 计数正确；非管理员 `admin.usage` 拒绝；管理员得到按用户汇总；月度字符超限时 `tts.get` 未命中被拒而命中仍可用。
- 模拟脚本：`api.usageGet()` 返回结构；`ADMIN_OPENIDS` 含 `sim-user` 时 `adminUsage()` 有 1 个用户。
