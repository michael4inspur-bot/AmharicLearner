# 后台迁移到微信云开发 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Amharic Learner 的 Express 后台替换为一个微信云函数 `api` 加两个云数据库集合，小程序改用 `wx.cloud.callFunction`，删除 `server/`。

**Architecture:** 小程序页面通过 `utils/api.js` 调 `wx.cloud.callFunction('api', {action, data})`；云函数 `index.js` 取 openid 后交给纯逻辑 `handler.js`，`handler.js` 通过注入的 `db` 适配器和 `deepseek` 客户端工作，因此可以在本地用假实现做 node:test。提示词与 DeepSeek 调用代码从 `server/src` 搬来改成 CommonJS，内容不变。

**Tech Stack:** 微信小程序原生框架、微信云开发（云函数 Node.js 18.15 运行时、云数据库）、wx-server-sdk、DeepSeek Chat Completions（OpenAI 兼容接口）、Node 内置 `node:test`。

**Spec:** `docs/superpowers/specs/2026-09-11-cloudbase-backend-design.md`

## Global Constraints

- 云函数运行时 `Nodejs18.15`（需要全局 `fetch`），超时 60 秒，DeepSeek 内部超时 50 秒。
- 云函数返回统一为 `{ ok: true, data }` 或 `{ ok: false, code, error }`，code 只有 `BAD_REQUEST`、`NO_API_KEY`、`UPSTREAM`、`TIMEOUT` 四种。
- AI 动作每 openid 每日上限 20 次，按东非时间（UTC+3）计日。
- `ai.history` 只返回 `diagnosis`/`plan` 类型，最多 30 条，时间倒序；`chat` 记录 7 天后清理。
- 密钥只从环境变量 `DEEPSEEK_API_KEY` 读取，不进代码库。
- 云函数目录 `cloudfunctions/api/` 使用 CommonJS（`require`/`module.exports`），小程序目录同样是 CommonJS。
- 所有 git 提交信息末尾附两行：`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` 和 `Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ`。
- 本地跑云函数测试不需要安装 `wx-server-sdk`：测试只加载 `handler.js`、`deepseek.js`、`prompts.js`。

---

## 文件结构

新建：

- `cloudfunctions/api/package.json` — 云函数依赖与测试脚本
- `cloudfunctions/api/config.json` — 运行时与超时
- `cloudfunctions/api/handler.js` — 纯逻辑：动作分发、进度存取、AI 动作、每日上限
- `cloudfunctions/api/deepseek.js` — DeepSeek 调用（从 `server/src/deepseek.js` 搬来，CJS）
- `cloudfunctions/api/prompts.js` — 提示词（从 `server/src/prompts.js` 搬来，CJS）
- `cloudfunctions/api/db.js` — 云数据库适配器（真实实现，依赖 wx-server-sdk）
- `cloudfunctions/api/index.js` — 云函数入口
- `cloudfunctions/api/test/fakeDb.js` — 内存假数据库
- `cloudfunctions/api/test/fakeDeepseek.js` — 假 DeepSeek 客户端
- `cloudfunctions/api/test/handler.progress.test.js`
- `cloudfunctions/api/test/handler.ai.test.js`
- `cloudfunctions/api/test/prompts.test.js`
- `miniprogram/config.js` — 云环境 id
- `scripts/sim-miniprogram.js` — 小程序端到端模拟脚本（假 wx + 假 wx.cloud 直连 handler）
- `package.json`（仓库根）— 一条 `npm test` 跑全部测试

修改：

- `miniprogram/utils/api.js` — 整体重写为 callFunction
- `miniprogram/utils/sync.js:8-11` — `configured()` 改用 `api.configured()`
- `miniprogram/app.js` — 加 `wx.cloud.init`
- `miniprogram/app.json` — 加 `networkTimeout`
- `project.config.json` — 加 `cloudfunctionRoot`
- `miniprogram/pages/profile/profile.js`、`profile.wxml` — 删服务器地址相关
- `miniprogram/pages/coach/coach.js:38-42` — `fail()` 文案
- `README.md` — 部署段落
- `.gitignore`

删除：

- `server/` 整个目录

---

### Task 1: 云函数骨架与进度存取

**Files:**
- Create: `cloudfunctions/api/package.json`
- Create: `cloudfunctions/api/config.json`
- Create: `cloudfunctions/api/handler.js`
- Create: `cloudfunctions/api/test/fakeDb.js`
- Test: `cloudfunctions/api/test/handler.progress.test.js`

**Interfaces:**
- Produces: `handle(action: string, data: object, ctx: {openid, db, deepseek, now?: () => Date}) => Promise<{ok:true,data}|{ok:false,code,error}>`
- Produces: `db` 适配器接口（fakeDb 与 Task 4 的真实 db.js 都实现）：
  - `getProgress(openid) => Promise<{progress, updatedAt} | null>`
  - `putProgress(openid, {progress, updatedAt}) => Promise<void>`
  - `countAiSince(openid, sinceIso) => Promise<number>`
  - `addAiLog({openid, type, date, request, result}) => Promise<void>`
  - `listAiLogs(openid, types: string[], limit) => Promise<Array<{type,date,request,result}>>`（按 date 倒序）
  - `pruneAiLogs(openid, {keep: number, chatBefore: string}) => Promise<void>`

- [ ] **Step 1: 建目录与 package.json、config.json**

`cloudfunctions/api/package.json`：

```json
{
  "name": "api",
  "version": "1.0.0",
  "description": "Amharic Learner 云函数：进度存储 + DeepSeek 学习诊断",
  "main": "index.js",
  "scripts": {
    "test": "node --test test/*.test.js"
  },
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

`cloudfunctions/api/config.json`：

```json
{
  "runtime": "Nodejs18.15",
  "timeout": 60,
  "permissions": {
    "openapi": []
  }
}
```

- [ ] **Step 2: 写假数据库**

`cloudfunctions/api/test/fakeDb.js`：

```js
// 内存实现，接口与 ../db.js 完全一致，供测试与小程序模拟脚本使用。
function createFakeDb() {
  const progress = new Map();
  const logs = [];
  return {
    _logs: logs,
    async getProgress(openid) {
      return progress.has(openid) ? { ...progress.get(openid) } : null;
    },
    async putProgress(openid, doc) {
      progress.set(openid, { progress: doc.progress, updatedAt: doc.updatedAt });
    },
    async countAiSince(openid, sinceIso) {
      return logs.filter((l) => l.openid === openid && l.date >= sinceIso).length;
    },
    async addAiLog(entry) {
      logs.push({ ...entry, _id: String(logs.length + 1) });
    },
    async listAiLogs(openid, types, limit) {
      return logs
        .filter((l) => l.openid === openid && types.includes(l.type))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit)
        .map(({ type, date, request, result }) => ({ type, date, request, result }));
    },
    async pruneAiLogs(openid, { keep, chatBefore }) {
      for (let i = logs.length - 1; i >= 0; i--) {
        const l = logs[i];
        if (l.openid === openid && l.type === 'chat' && l.date < chatBefore) logs.splice(i, 1);
      }
      const kept = logs
        .filter((l) => l.openid === openid && (l.type === 'diagnosis' || l.type === 'plan'))
        .sort((a, b) => b.date.localeCompare(a.date));
      const drop = new Set(kept.slice(keep).map((l) => l._id));
      for (let i = logs.length - 1; i >= 0; i--) if (drop.has(logs[i]._id)) logs.splice(i, 1);
    }
  };
}

module.exports = { createFakeDb };
```

- [ ] **Step 3: 写进度存取的失败测试**

`cloudfunctions/api/test/handler.progress.test.js`：

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handle } = require('../handler.js');
const { createFakeDb } = require('./fakeDb.js');

function ctx(openid, db) {
  return { openid, db, deepseek: null, now: () => new Date('2026-09-11T10:00:00Z') };
}

test('未知 action 返回 BAD_REQUEST', async () => {
  const res = await handle('nope', {}, ctx('u1', createFakeDb()));
  assert.equal(res.ok, false);
  assert.equal(res.code, 'BAD_REQUEST');
});

test('progress.get 无记录时返回 progress null', async () => {
  const res = await handle('progress.get', {}, ctx('u1', createFakeDb()));
  assert.deepEqual(res, { ok: true, data: { progress: null, updatedAt: null } });
});

test('progress.put 后 get 返回同一对象与 updatedAt', async () => {
  const db = createFakeDb();
  const put = await handle('progress.put', { progress: { streak: 3 } }, ctx('u1', db));
  assert.equal(put.ok, true);
  assert.equal(put.data.updatedAt, '2026-09-11T10:00:00.000Z');
  const got = await handle('progress.get', {}, ctx('u1', db));
  assert.deepEqual(got.data, { progress: { streak: 3 }, updatedAt: '2026-09-11T10:00:00.000Z' });
});

test('progress.put 缺 progress 返回 BAD_REQUEST', async () => {
  const res = await handle('progress.put', {}, ctx('u1', createFakeDb()));
  assert.equal(res.code, 'BAD_REQUEST');
});

test('不同 openid 的进度互不可见', async () => {
  const db = createFakeDb();
  await handle('progress.put', { progress: { streak: 1 } }, ctx('u1', db));
  const other = await handle('progress.get', {}, ctx('u2', db));
  assert.equal(other.data.progress, null);
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd cloudfunctions/api && npm test`
Expected: FAIL，错误为 `Cannot find module '../handler.js'`

- [ ] **Step 5: 写 handler.js 的进度部分**

`cloudfunctions/api/handler.js`：

```js
// 云函数纯逻辑。不直接依赖 wx-server-sdk，所有外部依赖通过 ctx 注入。
// ctx = { openid, db, deepseek, now? }

function ok(data) { return { ok: true, data }; }
function fail(code, error) { return { ok: false, code, error }; }

async function handle(action, data, ctx) {
  const { openid, db } = ctx;
  const now = ctx.now ? ctx.now() : new Date();
  data = data || {};

  switch (action) {
    case 'progress.get': {
      const doc = await db.getProgress(openid);
      return ok(doc ? { progress: doc.progress, updatedAt: doc.updatedAt } : { progress: null, updatedAt: null });
    }
    case 'progress.put': {
      if (!data.progress || typeof data.progress !== 'object') return fail('BAD_REQUEST', 'progress 必须是对象');
      const updatedAt = now.toISOString();
      await db.putProgress(openid, { progress: data.progress, updatedAt });
      return ok({ updatedAt });
    }
    default:
      return fail('BAD_REQUEST', `未知 action: ${action}`);
  }
}

module.exports = { handle };
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd cloudfunctions/api && npm test`
Expected: `# pass 5`，`# fail 0`

- [ ] **Step 7: 提交**

```bash
git add cloudfunctions/api
git commit -m "feat(cloud): scaffold api cloud function with progress get/put

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ"
```

---

### Task 2: DeepSeek 客户端与提示词搬到云函数（CommonJS）

**Files:**
- Create: `cloudfunctions/api/deepseek.js`（来源 `server/src/deepseek.js`）
- Create: `cloudfunctions/api/prompts.js`（来源 `server/src/prompts.js`）
- Test: `cloudfunctions/api/test/prompts.test.js`

**Interfaces:**
- Produces: `deepseek.chatCompletion(messages, {json?, temperature?, maxTokens?}) => Promise<string>`，失败抛 `DeepSeekError`，其 `code` 为 `NO_API_KEY` | `TIMEOUT` | `UPSTREAM`
- Produces: `deepseek.parseJsonReply(text) => object`，失败抛 `DeepSeekError`（code `UPSTREAM`）
- Produces: `prompts.diagnosisSystemPrompt()`, `prompts.planAdjustSystemPrompt()`, `prompts.tutorSystemPrompt(summary)`, `prompts.buildDiagnosisUserMessage(summary, planOutline)`, `prompts.buildPlanAdjustUserMessage(summary, planOutline, diagnosis, request)`，全部返回字符串

- [ ] **Step 1: 写失败测试**

`cloudfunctions/api/test/prompts.test.js`：

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDiagnosisUserMessage, buildPlanAdjustUserMessage, diagnosisSystemPrompt, tutorSystemPrompt
} = require('../prompts.js');
const { parseJsonReply, chatCompletion, DeepSeekError } = require('../deepseek.js');

test('诊断 user 消息包含摘要与计划大纲', () => {
  const msg = buildDiagnosisUserMessage({ streak: 3 }, { weeks: [{ week: 1 }] });
  assert.match(msg, /"streak":3/);
  assert.match(msg, /"week":1/);
  assert.match(diagnosisSystemPrompt(), /overall_level/);
});

test('计划调整 user 消息包含学员诉求', () => {
  const msg = buildPlanAdjustUserMessage({}, {}, null, '想先学谈判用语');
  assert.match(msg, /想先学谈判用语/);
});

test('教练 system 提示包含进度摘要', () => {
  assert.match(tutorSystemPrompt({ streak: 9 }), /"streak":9/);
});

test('parseJsonReply 容忍代码块与前后文字', () => {
  assert.deepEqual(parseJsonReply('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonReply('好的：{"b":[1,2]} 完'), { b: [1, 2] });
  assert.throws(() => parseJsonReply('没有 json'), (e) => e instanceof DeepSeekError && e.code === 'UPSTREAM');
});

test('未配置密钥时 chatCompletion 抛 NO_API_KEY', async () => {
  const saved = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    await assert.rejects(chatCompletion([{ role: 'user', content: 'hi' }]), (e) => e.code === 'NO_API_KEY');
  } finally {
    if (saved !== undefined) process.env.DEEPSEEK_API_KEY = saved;
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd cloudfunctions/api && npm test`
Expected: FAIL，`Cannot find module '../prompts.js'`

- [ ] **Step 3: 写 deepseek.js**

`cloudfunctions/api/deepseek.js`：

```js
// DeepSeek 使用 OpenAI 兼容的 Chat Completions 接口。配置全部来自环境变量。
class DeepSeekError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DeepSeekError';
    this.code = code; // NO_API_KEY | TIMEOUT | UPSTREAM
  }
}

function config() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS || 50000)
  };
}

/**
 * @param {Array<{role:string, content:string}>} messages
 * @param {{json?: boolean, temperature?: number, maxTokens?: number}} [opts]
 * @returns {Promise<string>} 模型回复文本
 */
async function chatCompletion(messages, opts = {}) {
  const { apiKey, baseUrl, model, timeoutMs } = config();
  if (!apiKey) throw new DeepSeekError('未配置 DEEPSEEK_API_KEY', 'NO_API_KEY');

  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2000,
    stream: false
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new DeepSeekError('DeepSeek 响应超时', 'TIMEOUT');
    throw new DeepSeekError(`调用 DeepSeek 失败: ${err.message}`, 'UPSTREAM');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DeepSeekError(`DeepSeek 返回 ${res.status}: ${text.slice(0, 300)}`, 'UPSTREAM');
  }
  const data = await res.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (typeof content !== 'string') throw new DeepSeekError('DeepSeek 返回内容为空', 'UPSTREAM');
  return content;
}

/** 解析模型返回的 JSON；容忍 ```json 代码块包裹和前后文字。 */
function parseJsonReply(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (e2) { /* fallthrough */ }
    }
    throw new DeepSeekError('无法解析 DeepSeek 返回的 JSON', 'UPSTREAM');
  }
}

module.exports = { DeepSeekError, chatCompletion, parseJsonReply };
```

- [ ] **Step 4: 把 prompts.js 转成 CommonJS**

用脚本搬运，只改导出语法，内容不动：

```bash
sed -e 's/^export function /function /' server/src/prompts.js > cloudfunctions/api/prompts.js
cat >> cloudfunctions/api/prompts.js <<'EOF'

module.exports = {
  diagnosisSystemPrompt,
  planAdjustSystemPrompt,
  tutorSystemPrompt,
  buildDiagnosisUserMessage,
  buildPlanAdjustUserMessage
};
EOF
grep -c "^export" cloudfunctions/api/prompts.js   # 期望输出 0
node --check cloudfunctions/api/prompts.js
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd cloudfunctions/api && npm test`
Expected: 本文件 `# pass 5`；连同 Task 1 一起 `npm test` 为 `# pass 10`

- [ ] **Step 6: 提交**

```bash
git add cloudfunctions/api
git commit -m "feat(cloud): port DeepSeek client and prompts to cloud function

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ"
```

---

### Task 3: AI 动作、每日上限与历史

**Files:**
- Modify: `cloudfunctions/api/handler.js`（整体重写，含 Task 1 的进度部分）
- Create: `cloudfunctions/api/test/fakeDeepseek.js`
- Test: `cloudfunctions/api/test/handler.ai.test.js`

**Interfaces:**
- Consumes: Task 1 的 `db` 接口、Task 2 的 `deepseek.chatCompletion` / `parseJsonReply` / `DeepSeekError`、`prompts.*`
- Produces: 动作 `ai.diagnose`、`ai.adjustPlan`、`ai.chat`、`ai.history`，出参见 spec 3.1；导出常量 `DAILY_AI_LIMIT = 20`

- [ ] **Step 1: 写假 DeepSeek 客户端**

`cloudfunctions/api/test/fakeDeepseek.js`：

```js
// 假 DeepSeek：按脚本返回文本或抛错，记录收到的 messages。
const { parseJsonReply, DeepSeekError } = require('../deepseek.js');

function createFakeDeepseek(script) {
  // script: (messages, opts) => string | throws
  const calls = [];
  return {
    calls,
    DeepSeekError,
    parseJsonReply,
    async chatCompletion(messages, opts) {
      calls.push({ messages, opts });
      return script(messages, opts);
    }
  };
}

function errorOf(code, message) {
  return new DeepSeekError(message || code, code);
}

module.exports = { createFakeDeepseek, errorOf };
```

- [ ] **Step 2: 写失败测试**

`cloudfunctions/api/test/handler.ai.test.js`：

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handle, DAILY_AI_LIMIT } = require('../handler.js');
const { createFakeDb } = require('./fakeDb.js');
const { createFakeDeepseek, errorOf } = require('./fakeDeepseek.js');

const DIAG = { overall_level: '入门', score: 42, summary: 'ok', strengths: [], weaknesses: [], risks: [],
  recommendations: [], plan_changes: [], daily_minutes_suggestion: 30, next_7_days: [], encouragement: '加油' };

function ctx(openid, db, deepseek, isoNow) {
  return { openid, db, deepseek, now: () => new Date(isoNow || '2026-09-11T10:00:00Z') };
}

test('ai.diagnose 缺 summary 返回 BAD_REQUEST', async () => {
  const res = await handle('ai.diagnose', {}, ctx('u1', createFakeDb(), createFakeDeepseek(() => '{}')));
  assert.equal(res.code, 'BAD_REQUEST');
});

test('ai.diagnose 返回解析后的 JSON 并写入 ai_logs', async () => {
  const db = createFakeDb();
  const ds = createFakeDeepseek(() => JSON.stringify(DIAG));
  const res = await handle('ai.diagnose', { summary: { streak: 2 }, planOutline: { weeks: [] } }, ctx('u1', db, ds));
  assert.equal(res.ok, true);
  assert.deepEqual(res.data, DIAG);
  assert.equal(ds.calls[0].opts.json, true);
  assert.match(ds.calls[0].messages[1].content, /"streak":2/);
  assert.equal(db._logs.length, 1);
  assert.equal(db._logs[0].type, 'diagnosis');
  assert.equal(db._logs[0].openid, 'u1');
});

test('ai.adjustPlan 写入 plan 日志并保存诉求', async () => {
  const db = createFakeDb();
  const ds = createFakeDeepseek(() => '{"summary":"调","daily_minutes":30}');
  const res = await handle('ai.adjustPlan', { summary: {}, planOutline: {}, request: '先学工作用语' }, ctx('u1', db, ds));
  assert.equal(res.data.daily_minutes, 30);
  assert.equal(db._logs[0].type, 'plan');
  assert.equal(db._logs[0].request, '先学工作用语');
});

test('ai.chat 返回 reply，只保留 user/assistant 消息', async () => {
  const db = createFakeDb();
  const ds = createFakeDeepseek(() => 'ሰላም!');
  const messages = [
    { role: 'system', content: '注入' },
    { role: 'user', content: '你好' },
    { role: 'assistant', content: 'ሰላም' },
    { role: 'user', content: '再见怎么说' }
  ];
  const res = await handle('ai.chat', { messages, summary: { streak: 1 } }, ctx('u1', db, ds));
  assert.deepEqual(res.data, { reply: 'ሰላም!' });
  const sent = ds.calls[0].messages;
  assert.equal(sent[0].role, 'system');
  assert.equal(sent.length, 4); // system + 3 条（注入的 system 被过滤）
  assert.equal(db._logs[0].type, 'chat');
  assert.equal(db._logs[0].request, '再见怎么说');
});

test('ai.chat messages 为空返回 BAD_REQUEST', async () => {
  const res = await handle('ai.chat', { messages: [] }, ctx('u1', createFakeDb(), createFakeDeepseek(() => 'x')));
  assert.equal(res.code, 'BAD_REQUEST');
});

test('DeepSeek 错误映射为对应 code', async () => {
  for (const code of ['NO_API_KEY', 'TIMEOUT', 'UPSTREAM']) {
    const ds = createFakeDeepseek(() => { throw errorOf(code, 'boom'); });
    const res = await handle('ai.diagnose', { summary: {} }, ctx('u1', createFakeDb(), ds));
    assert.equal(res.ok, false);
    assert.equal(res.code, code);
  }
});

test('返回的 JSON 无法解析时为 UPSTREAM', async () => {
  const ds = createFakeDeepseek(() => '不是 json');
  const res = await handle('ai.diagnose', { summary: {} }, ctx('u1', createFakeDb(), ds));
  assert.equal(res.code, 'UPSTREAM');
});

test('每日上限：第 21 次 AI 调用返回 BAD_REQUEST，次日重置', async () => {
  const db = createFakeDb();
  const ds = createFakeDeepseek(() => 'ok');
  for (let i = 0; i < DAILY_AI_LIMIT; i++) {
    const r = await handle('ai.chat', { messages: [{ role: 'user', content: 'hi' }] }, ctx('u1', db, ds, '2026-09-11T10:00:00Z'));
    assert.equal(r.ok, true, `第 ${i + 1} 次应成功`);
  }
  const blocked = await handle('ai.chat', { messages: [{ role: 'user', content: 'hi' }] }, ctx('u1', db, ds, '2026-09-11T20:00:00Z'));
  assert.equal(blocked.code, 'BAD_REQUEST');
  assert.match(blocked.error, /20/);
  // 东非时间次日 00:30 = UTC 21:30
  const nextDay = await handle('ai.chat', { messages: [{ role: 'user', content: 'hi' }] }, ctx('u1', db, ds, '2026-09-11T21:30:00Z'));
  assert.equal(nextDay.ok, true);
  // 其他用户不受影响
  const other = await handle('ai.chat', { messages: [{ role: 'user', content: 'hi' }] }, ctx('u2', db, ds, '2026-09-11T20:00:00Z'));
  assert.equal(other.ok, true);
});

test('ai.history 只返回 diagnosis/plan，倒序，最多 30 条', async () => {
  const db = createFakeDb();
  const ds = createFakeDeepseek(() => JSON.stringify(DIAG));
  for (let i = 0; i < 35; i++) {
    // 日期必须单调递增（真实调用如此），否则后插入的早期日期会被"每日上限"按当天计数拦截
    const iso = new Date(Date.UTC(2026, 6, 1 + i, 10)).toISOString(); // 2026-07-01 … 2026-08-04，每天一条
    await handle('ai.diagnose', { summary: {} }, ctx('u1', db, ds, iso));
  }
  await handle('ai.chat', { messages: [{ role: 'user', content: 'hi' }] }, ctx('u1', db, ds, '2026-09-11T10:00:00Z'));
  const res = await handle('ai.history', {}, ctx('u1', db, ds));
  assert.equal(res.data.history.length, 30);
  assert.ok(res.data.history.every((h) => h.type === 'diagnosis'));
  assert.ok(res.data.history[0].date >= res.data.history[1].date);
});

test('chat 日志超过 7 天被清理', async () => {
  const db = createFakeDb();
  const ds = createFakeDeepseek(() => 'ok');
  await handle('ai.chat', { messages: [{ role: 'user', content: 'old' }] }, ctx('u1', db, ds, '2026-09-01T10:00:00Z'));
  await handle('ai.chat', { messages: [{ role: 'user', content: 'new' }] }, ctx('u1', db, ds, '2026-09-11T10:00:00Z'));
  const chats = db._logs.filter((l) => l.type === 'chat');
  assert.equal(chats.length, 1);
  assert.equal(chats[0].request, 'new');
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd cloudfunctions/api && npm test`
Expected: handler.ai 的用例 FAIL（`DAILY_AI_LIMIT` 为 undefined，`ai.*` 返回 BAD_REQUEST）

- [ ] **Step 4: 重写 handler.js**

`cloudfunctions/api/handler.js` 整个文件替换为：

```js
// 云函数纯逻辑。不直接依赖 wx-server-sdk，所有外部依赖通过 ctx 注入。
// ctx = { openid, db, deepseek, now? }
const prompts = require('./prompts.js');

const DAILY_AI_LIMIT = 20;
const HISTORY_LIMIT = 30;
const CHAT_LOG_TTL_DAYS = 7;
const EAT_OFFSET_HOURS = 3; // 东非时间 UTC+3
const MAX_CHAT_MESSAGES = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

function ok(data) { return { ok: true, data }; }
function fail(code, error) { return { ok: false, code, error }; }

/** 东非时间当天 00:00 对应的 ISO 时刻 */
function dayStartIso(now) {
  const shifted = new Date(now.getTime() + EAT_OFFSET_HOURS * 3600 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - EAT_OFFSET_HOURS * 3600 * 1000).toISOString();
}

async function withAi(ctx, now, type, request, run) {
  const { openid, db, deepseek } = ctx;
  const used = await db.countAiSince(openid, dayStartIso(now));
  if (used >= DAILY_AI_LIMIT) {
    return fail('BAD_REQUEST', `今天的 AI 次数已用完（${DAILY_AI_LIMIT} 次），明天再来`);
  }
  let result;
  try {
    result = await run();
  } catch (err) {
    if (err && ['NO_API_KEY', 'TIMEOUT', 'UPSTREAM'].includes(err.code)) return fail(err.code, err.message);
    throw err;
  }
  await db.addAiLog({
    openid,
    type,
    date: now.toISOString(),
    request: String(request || '').slice(0, 500),
    result: type === 'chat' ? { reply: String(result.reply).slice(0, 500) } : result
  });
  await db.pruneAiLogs(openid, {
    keep: HISTORY_LIMIT,
    chatBefore: new Date(now.getTime() - CHAT_LOG_TTL_DAYS * DAY_MS).toISOString()
  });
  void deepseek;
  return ok(result);
}

async function handle(action, data, ctx) {
  const { openid, db, deepseek } = ctx;
  const now = ctx.now ? ctx.now() : new Date();
  data = data || {};

  switch (action) {
    case 'progress.get': {
      const doc = await db.getProgress(openid);
      return ok(doc ? { progress: doc.progress, updatedAt: doc.updatedAt } : { progress: null, updatedAt: null });
    }
    case 'progress.put': {
      if (!data.progress || typeof data.progress !== 'object') return fail('BAD_REQUEST', 'progress 必须是对象');
      const updatedAt = now.toISOString();
      await db.putProgress(openid, { progress: data.progress, updatedAt });
      return ok({ updatedAt });
    }
    case 'ai.diagnose': {
      if (!data.summary) return fail('BAD_REQUEST', '缺少 summary');
      return withAi(ctx, now, 'diagnosis', '', async () => {
        const text = await deepseek.chatCompletion(
          [
            { role: 'system', content: prompts.diagnosisSystemPrompt() },
            { role: 'user', content: prompts.buildDiagnosisUserMessage(data.summary, data.planOutline) }
          ],
          { json: true, temperature: 0.4, maxTokens: 2000 }
        );
        return deepseek.parseJsonReply(text);
      });
    }
    case 'ai.adjustPlan': {
      if (!data.summary) return fail('BAD_REQUEST', '缺少 summary');
      return withAi(ctx, now, 'plan', data.request, async () => {
        const text = await deepseek.chatCompletion(
          [
            { role: 'system', content: prompts.planAdjustSystemPrompt() },
            { role: 'user', content: prompts.buildPlanAdjustUserMessage(data.summary, data.planOutline, data.diagnosis, data.request) }
          ],
          { json: true, temperature: 0.5, maxTokens: 2000 }
        );
        return deepseek.parseJsonReply(text);
      });
    }
    case 'ai.chat': {
      if (!Array.isArray(data.messages) || data.messages.length === 0) return fail('BAD_REQUEST', 'messages 必须是非空数组');
      const history = data.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_CHAT_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
      if (history.length === 0) return fail('BAD_REQUEST', 'messages 中没有有效消息');
      const lastUser = [...history].reverse().find((m) => m.role === 'user');
      return withAi(ctx, now, 'chat', lastUser ? lastUser.content : '', async () => {
        const reply = await deepseek.chatCompletion(
          [{ role: 'system', content: prompts.tutorSystemPrompt(data.summary) }, ...history],
          { temperature: 0.7, maxTokens: 1200 }
        );
        return { reply };
      });
    }
    case 'ai.history': {
      const history = await db.listAiLogs(openid, ['diagnosis', 'plan'], HISTORY_LIMIT);
      return ok({ history });
    }
    default:
      return fail('BAD_REQUEST', `未知 action: ${action}`);
  }
}

module.exports = { handle, DAILY_AI_LIMIT, HISTORY_LIMIT, dayStartIso };
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd cloudfunctions/api && npm test`
Expected: `# pass 20`，`# fail 0`（5 进度 + 5 提示词 + 10 AI）

- [ ] **Step 6: 提交**

```bash
git add cloudfunctions/api
git commit -m "feat(cloud): add AI diagnose/adjustPlan/chat/history with daily cap

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ"
```

---

### Task 4: 云数据库适配器与云函数入口

**Files:**
- Create: `cloudfunctions/api/db.js`
- Create: `cloudfunctions/api/index.js`

**Interfaces:**
- Consumes: Task 1 定义的 `db` 接口，Task 3 的 `handle`
- Produces: `exports.main(event: {action, data}) => Promise<{ok,...}>`，微信云函数入口

这两个文件依赖 `wx-server-sdk`，本地不跑单元测试，用 `node --check` 和一个带桩模块的加载测试验证。

- [ ] **Step 1: 写 db.js**

`cloudfunctions/api/db.js`：

```js
// 云数据库适配器。接口与 test/fakeDb.js 一致。
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const PROGRESS = 'progress';
const LOGS = 'ai_logs';

module.exports = {
  async getProgress(openid) {
    const r = await db.collection(PROGRESS).where({ _id: openid }).limit(1).get();
    const doc = r.data[0];
    return doc ? { progress: doc.progress, updatedAt: doc.updatedAt } : null;
  },
  async putProgress(openid, doc) {
    await db.collection(PROGRESS).doc(openid).set({ data: { progress: doc.progress, updatedAt: doc.updatedAt } });
  },
  async countAiSince(openid, sinceIso) {
    const r = await db.collection(LOGS).where({ openid, date: _.gte(sinceIso) }).count();
    return r.total;
  },
  async addAiLog(entry) {
    await db.collection(LOGS).add({ data: entry });
  },
  async listAiLogs(openid, types, limit) {
    const r = await db.collection(LOGS)
      .where({ openid, type: _.in(types) })
      .orderBy('date', 'desc')
      .limit(limit)
      .field({ type: true, date: true, request: true, result: true })
      .get();
    return r.data.map(({ type, date, request, result }) => ({ type, date, request, result }));
  },
  async pruneAiLogs(openid, { keep, chatBefore }) {
    await db.collection(LOGS).where({ openid, type: 'chat', date: _.lt(chatBefore) }).remove();
    const extra = await db.collection(LOGS)
      .where({ openid, type: _.in(['diagnosis', 'plan']) })
      .orderBy('date', 'desc')
      .skip(keep)
      .limit(100)
      .field({ _id: true })
      .get();
    if (extra.data.length) {
      await db.collection(LOGS).where({ _id: _.in(extra.data.map((d) => d._id)) }).remove();
    }
  }
};
```

- [ ] **Step 2: 写 index.js**

`cloudfunctions/api/index.js`：

```js
// 云函数入口：取 openid，交给 handler，兜底异常。
const cloud = require('wx-server-sdk');
const db = require('./db.js');
const deepseek = require('./deepseek.js');
const { handle } = require('./handler.js');

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, code: 'BAD_REQUEST', error: '无法识别用户' };
  try {
    return await handle(event && event.action, event && event.data, { openid: OPENID, db, deepseek });
  } catch (err) {
    console.error(err);
    return { ok: false, code: 'UPSTREAM', error: (err && err.message) || '服务器错误' };
  }
};
```

- [ ] **Step 3: 语法检查并用桩模块验证入口可加载、异常被兜底**

```bash
node --check cloudfunctions/api/db.js && node --check cloudfunctions/api/index.js
cd cloudfunctions/api && node -e '
const Module = require("module");
const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === "wx-server-sdk") return {
    DYNAMIC_CURRENT_ENV: "dyn", init() {}, getWXContext: () => ({ OPENID: "o1" }),
    database: () => ({ command: {}, collection: () => { throw new Error("db down"); } })
  };
  return orig.call(this, req, ...rest);
};
const { main } = require("./index.js");
main({ action: "progress.get" }).then((r) => { console.log(JSON.stringify(r)); if (r.ok !== false || r.code !== "UPSTREAM") process.exit(1); });
'
```

Expected: 打印 `{"ok":false,"code":"UPSTREAM","error":"db down"}`，退出码 0

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/api/db.js cloudfunctions/api/index.js
git commit -m "feat(cloud): add cloud database adapter and function entry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ"
```

---

### Task 5: 小程序改用 callFunction

**Files:**
- Create: `miniprogram/config.js`
- Modify: `miniprogram/utils/api.js`（整体重写）
- Modify: `miniprogram/utils/sync.js:8-11`
- Modify: `miniprogram/app.js`
- Modify: `miniprogram/app.json`
- Modify: `project.config.json`

**Interfaces:**
- Consumes: 云函数动作名与返回形状（Task 3）
- Produces: `api.configured() => boolean`；`api.syncProgress(progress)`、`api.fetchProgress()`（resolve `{progress, updatedAt}`）、`api.diagnose(summary, planOutline)`（resolve 诊断对象）、`api.adjustPlan(summary, planOutline, diagnosis, request)`（resolve 调整对象）、`api.chat(messages, summary)`（resolve `{reply}`）、`api.aiHistory()`（resolve `{history}`）。失败 reject `Error`，带 `code`。

- [ ] **Step 1: 新建 config.js**

`miniprogram/config.js`：

```js
// 云开发环境 id。在微信开发者工具「云开发」控制台创建环境后填入，例如 'amharic-1a2b3c'。
module.exports = {
  cloudEnv: ''
};
```

- [ ] **Step 2: 重写 api.js**

`miniprogram/utils/api.js` 整个文件替换为：

```js
// 后台请求封装：全部走微信云函数 api，按 action 分发。
const config = require('../config.js');

const MESSAGES = {
  NO_API_KEY: '管理员还没配置 DeepSeek 密钥',
  UPSTREAM: 'AI 服务暂时不可用，稍后再试',
  TIMEOUT: 'AI 响应超时，请重试'
};

function configured() {
  return !!config.cloudEnv;
}

function call(action, data) {
  if (!configured()) {
    const err = new Error('还没有配置云开发环境');
    err.code = 'NO_ENV';
    return Promise.reject(err);
  }
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'api',
      data: { action, data },
      success: (res) => {
        const r = res.result || {};
        if (r.ok) { resolve(r.data); return; }
        const err = new Error(MESSAGES[r.code] || r.error || '请求失败');
        err.code = r.code || 'UNKNOWN';
        err.raw = r.error;
        reject(err);
      },
      fail: (e) => {
        const msg = (e && e.errMsg) || '';
        const err = new Error(/timeout/i.test(msg) ? MESSAGES.TIMEOUT : `网络错误：${msg}`);
        err.code = /timeout/i.test(msg) ? 'TIMEOUT' : 'NETWORK';
        reject(err);
      }
    });
  });
}

module.exports = {
  configured,
  syncProgress: (progress) => call('progress.put', { progress }),
  fetchProgress: () => call('progress.get'),
  diagnose: (summary, planOutline) => call('ai.diagnose', { summary, planOutline }),
  adjustPlan: (summary, planOutline, diagnosis, request) => call('ai.adjustPlan', { summary, planOutline, diagnosis, request }),
  chat: (messages, summary) => call('ai.chat', { messages, summary }),
  aiHistory: () => call('ai.history')
};
```

注意 coach.js 里现有调用是 `const { diagnosis } = await api.diagnose(...)`、`const { adjustment } = await api.adjustPlan(...)`，云函数直接返回诊断/调整对象本身，Task 6 会同步改掉这两处解构。

- [ ] **Step 3: 改 sync.js 的 configured()**

`miniprogram/utils/sync.js` 第 8 到 11 行：

```js
function configured() {
  const { baseUrl } = api.getSettings();
  return baseUrl && !baseUrl.includes('example.com');
}
```

改为：

```js
function configured() {
  return api.configured();
}
```

- [ ] **Step 4: 改 app.js、app.json、project.config.json**

`miniprogram/app.js` 整个文件替换为：

```js
const config = require('./config.js');
const progress = require('./utils/progress.js');
const sync = require('./utils/sync.js');

App({
  globalData: { version: '0.3.0' },
  onLaunch() {
    if (wx.cloud && config.cloudEnv) {
      wx.cloud.init({ env: config.cloudEnv, traceUser: true });
    }
    progress.load();
    // 每次进度保存后 3 秒内合并上传一次
    progress.setOnSaved(() => sync.scheduleSync(3000));
  },
  onHide() {
    // 切到后台时把进度静默上传到云端（未配置云环境时跳过）
    sync.syncNow();
  }
});
```

`miniprogram/app.json`：在 `"style": "v2"` 之前加一项：

```json
  "networkTimeout": { "request": 60000 },
```

`project.config.json`：在 `"miniprogramRoot": "miniprogram/",` 之后加：

```json
  "cloudfunctionRoot": "cloudfunctions/",
```

- [ ] **Step 5: 语法与 JSON 检查**

```bash
node --check miniprogram/utils/api.js && node --check miniprogram/utils/sync.js && node --check miniprogram/app.js && node --check miniprogram/config.js
node -e "JSON.parse(require('fs').readFileSync('miniprogram/app.json','utf8')); JSON.parse(require('fs').readFileSync('project.config.json','utf8'))"
grep -rn "getSettings\|saveSettings\|health()" miniprogram/ --include=*.js
```

Expected: 前两条无输出；grep 只应命中 `pages/profile/profile.js`（Task 6 处理）。

- [ ] **Step 6: 提交**

```bash
git add miniprogram/config.js miniprogram/utils/api.js miniprogram/utils/sync.js miniprogram/app.js miniprogram/app.json project.config.json
git commit -m "feat(mp): call cloud function instead of HTTP backend

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ"
```

---

### Task 6: 「我的」与「AI 教练」页面适配

**Files:**
- Modify: `miniprogram/pages/profile/profile.js`
- Modify: `miniprogram/pages/profile/profile.wxml:20-36`
- Modify: `miniprogram/pages/coach/coach.js:38-42, 52-54, 63-66`

**Interfaces:**
- Consumes: Task 5 的 `api.configured()`、`api.diagnose()` 直接 resolve 诊断对象、`api.adjustPlan()` 直接 resolve 调整对象

- [ ] **Step 1: 改 profile.js**

`miniprogram/pages/profile/profile.js` 整个文件替换为：

```js
const progress = require('../../utils/progress.js');
const api = require('../../utils/api.js');

Page({
  data: { cloudReady: false, goal: 20, newCards: 10, startDate: '', stats: {}, streak: 0, totalMinutes: 0, days: 0, quizzes: 0 },
  onShow() {
    const p = progress.load();
    const totalMinutes = Object.values(p.logs).reduce((a, l) => a + (l.minutes || 0), 0);
    this.setData({
      cloudReady: api.configured(), goal: p.dailyMinutesGoal, newCards: p.newCardsPerDay, startDate: p.startDate,
      stats: progress.srsStats(p), streak: progress.streak(p), totalMinutes,
      days: Object.keys(p.logs).filter((k) => p.logs[k].minutes > 0).length,
      quizzes: p.quizScores.length
    });
  },
  onGoal(e) { const p = progress.load(); p.dailyMinutesGoal = e.detail.value; progress.save(p); this.setData({ goal: e.detail.value }); },
  onNewCards(e) { const p = progress.load(); p.newCardsPerDay = e.detail.value; progress.save(p); this.setData({ newCards: e.detail.value }); },
  onStartDate(e) { const p = progress.load(); p.startDate = e.detail.value; progress.save(p); this.setData({ startDate: e.detail.value }); },
  async upload() {
    try { await api.syncProgress(progress.load()); wx.showToast({ title: '已上传到云端', icon: 'success' }); }
    catch (e) { wx.showModal({ title: '上传失败', content: e.message, showCancel: false }); }
  },
  async download() {
    try {
      const { progress: remote } = await api.fetchProgress();
      if (!remote) { wx.showToast({ title: '云端没有数据', icon: 'none' }); return; }
      wx.showModal({
        title: '覆盖本地进度？', content: '将用云端的进度替换本机数据。',
        success: (r) => { if (r.confirm) { progress.replace(remote); this.onShow(); wx.showToast({ title: '已恢复', icon: 'success' }); } }
      });
    } catch (e) { wx.showModal({ title: '恢复失败', content: e.message, showCancel: false }); }
  },
  resetAll() {
    wx.showModal({
      title: '清空全部进度', content: '闪卡、小测、AI 记录都会删除，无法恢复。', confirmColor: '#c0392b',
      success: (r) => { if (r.confirm) { progress.reset(); this.onShow(); } }
    });
  }
});
```

- [ ] **Step 2: 改 profile.wxml 的服务器卡片**

`miniprogram/pages/profile/profile.wxml` 第 20 到 36 行（`<view class="card">` 起，到 `从服务器恢复</view>` 所在行的下一行 `</view>` 止）替换为：

```xml
  <view class="card">
    <view class="card-title">云端同步（微信云开发 + DeepSeek）</view>
    <view class="muted">{{cloudReady ? '✓ 已配置云环境，进度会自动同步' : '✗ 还没配置云环境，请管理员在 miniprogram/config.js 填写 cloudEnv'}}</view>
    <view class="divider"></view>
    <view class="muted" style="margin-bottom:10rpx">换手机时先在旧手机"立即上传"，再在新手机"从云端恢复"。</view>
    <view class="row">
      <view class="btn outline small" bindtap="upload">立即上传</view>
      <view style="width:12rpx"></view>
      <view class="btn outline small" bindtap="download">从云端恢复</view>
    </view>
  </view>
```

替换后用 `grep -n "baseUrl\|testServer\|serverOk\|userId" miniprogram/pages/profile/` 确认无输出。

- [ ] **Step 3: 改 coach.js**

`miniprogram/pages/coach/coach.js` 第 38 到 42 行的 `fail()` 替换为：

```js
  fail(err) {
    this.setData({ loading: '' });
    const msg = err.message || '请求失败';
    const hint = err.code === 'NO_ENV' ? '\n\n请管理员在 miniprogram/config.js 填写云开发环境 id。' : '';
    wx.showModal({ title: 'AI 请求失败', content: msg + hint, showCancel: false });
  },
```

`diagnose()` 中：

```js
      const { diagnosis } = await api.diagnose(summary, plan.planOutline());
```

改为：

```js
      const diagnosis = await api.diagnose(summary, plan.planOutline());
```

`adjust()` 中：

```js
      const { adjustment } = await api.adjustPlan(summary, plan.planOutline(), this.data.diagnosis, this.data.request);
```

改为：

```js
      const adjustment = await api.adjustPlan(summary, plan.planOutline(), this.data.diagnosis, this.data.request);
```

`send()` 中 `const { reply } = await api.chat(...)` 保持不变（云函数返回 `{reply}`）。

- [ ] **Step 4: 语法检查**

```bash
node --check miniprogram/pages/profile/profile.js && node --check miniprogram/pages/coach/coach.js
grep -rn "getSettings\|saveSettings\|example.com\|{ diagnosis } = await\|{ adjustment } = await" miniprogram/
```

Expected: grep 无输出

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/profile miniprogram/pages/coach
git commit -m "feat(mp): adapt profile and coach pages to cloud function API

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ"
```

---

### Task 7: 小程序端到端模拟脚本

**Files:**
- Create: `scripts/sim-miniprogram.js`
- Create: `package.json`（仓库根）

**Interfaces:**
- Consumes: `cloudfunctions/api/handler.js`、`test/fakeDb.js`、`test/fakeDeepseek.js`，小程序全部页面与 utils
- Produces: `npm test`（仓库根）跑云函数单测 + 模拟脚本

模拟脚本用假 `wx` 全局，`wx.cloud.callFunction` 直接调用真实 `handler.js`（假 db、假 DeepSeek），验证小程序到云函数的完整链路。

- [ ] **Step 1: 写模拟脚本**

`scripts/sim-miniprogram.js`：

```js
// 模拟微信运行环境，跑通小程序核心逻辑与云函数调用链路。用法：node scripts/sim-miniprogram.js
const path = require('path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..', 'miniprogram');
const fnRoot = path.join(__dirname, '..', 'cloudfunctions', 'api');
const { handle } = require(path.join(fnRoot, 'handler.js'));
const { createFakeDb } = require(path.join(fnRoot, 'test', 'fakeDb.js'));
const { createFakeDeepseek } = require(path.join(fnRoot, 'test', 'fakeDeepseek.js'));

const DIAG = { overall_level: '入门', score: 50, summary: '模拟诊断', strengths: ['坚持'], weaknesses: [], risks: [],
  recommendations: [], plan_changes: [], daily_minutes_suggestion: 30, next_7_days: [], encouragement: '继续' };
const db = createFakeDb();
const deepseek = createFakeDeepseek((messages, opts) => (opts && opts.json ? JSON.stringify(DIAG) : 'ሰላም! 模拟回复'));

const store = {};
global.wx = {
  getStorageSync: (k) => store[k],
  setStorageSync: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
  removeStorageSync: (k) => { delete store[k]; },
  showToast() {}, showModal() {}, setNavigationBarTitle() {}, navigateTo() {}, switchTab() {},
  navigateBack() {}, redirectTo() {}, setClipboardData() {},
  cloud: {
    init() {},
    callFunction({ data, success, fail }) {
      handle(data.action, data.data, { openid: 'sim-user', db, deepseek })
        .then((result) => success({ result }))
        .catch((e) => fail({ errMsg: e.message }));
    }
  }
};
const pages = [];
global.Page = (cfg) => pages.push(cfg);
global.App = (cfg) => { global.__app = cfg; };

// 先填云环境，再加载依赖 config 的模块
require(path.join(root, 'config.js')).cloudEnv = 'sim-env';

const progress = require(path.join(root, 'utils/progress.js'));
const quiz = require(path.join(root, 'utils/quiz.js'));
const plan = require(path.join(root, 'data/plan.js'));
const vocab = require(path.join(root, 'data/vocab.js'));
const api = require(path.join(root, 'utils/api.js'));
const sync = require(path.join(root, 'utils/sync.js'));

['index/index', 'lessons/lessons', 'lesson/lesson', 'review/review', 'quiz/quiz', 'plan/plan', 'coach/coach', 'fidel/fidel', 'profile/profile', 'search/search']
  .forEach((p) => require(path.join(root, 'pages', p + '.js')));
assert.equal(pages.length, 10, 'pages loaded');
require(path.join(root, 'app.js'));
global.__app.onLaunch();

async function main() {
  // 学习流程
  progress.learnUnit('u01');
  const due = progress.dueCards();
  assert.equal(due.length, 10, '每日新卡上限 10');
  progress.gradeCard(due[0].id, 5); progress.gradeCard(due[1].id, 1); progress.gradeCard(due[2].id, 3);
  assert.equal(progress.dueCards().length, 7);
  const q = quiz.buildQuiz('u01', 10, progress.load());
  assert.equal(q.length, 10);
  assert.ok(q[0].options.some((o) => o.id === q[0].answer));
  progress.recordQuiz('u01', 8, 10);
  progress.addMinutes(12);
  progress.completeMission('w1');
  const s = progress.summary();
  assert.equal(s.streak, 1);
  assert.equal(plan.planOutline().weeks.length, 8);
  plan.weeks.forEach((w) => w.units.forEach((id) => assert.ok(vocab.getUnit(id), 'unit ' + id)));

  // 今日页
  const indexPage = pages[0];
  indexPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  indexPage.data = {};
  indexPage.refresh();
  assert.ok(indexPage.data.tasks.length >= 2);

  // 搜索页
  const searchPage = pages[9];
  searchPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  searchPage.data = { q: '', results: [], recent: [] };
  searchPage.search('多少钱');
  assert.equal(searchPage.data.results[0].am, 'ስንት ነው?');

  // 云函数链路：同步
  assert.equal(api.configured(), true);
  assert.equal(await sync.syncNow(), true, '首次同步应上传');
  assert.equal(await sync.syncNow(), false, '未变化不重复上传');
  const fetched = await api.fetchProgress();
  assert.equal(fetched.progress.unitsLearned.u01, progress.load().unitsLearned.u01);

  // 云函数链路：AI
  const diag = await api.diagnose(s, plan.planOutline());
  assert.equal(diag.score, 50);
  const chat = await api.chat([{ role: 'user', content: '你好怎么说' }], s);
  assert.match(chat.reply, /ሰላም/);
  const hist = await api.aiHistory();
  assert.equal(hist.history.length, 1);
  assert.equal(hist.history[0].type, 'diagnosis');

  // 教练页 diagnose() 走完整路径
  const coach = pages[6];
  coach.setData = function (d) { this.data = { ...this.data, ...d }; };
  coach.data = { selfReport: '', diagnosis: null, adjustment: null, loading: '', request: '' };
  await coach.diagnose();
  assert.equal(coach.data.diagnosis.score, 50);
  assert.equal(coach.data.loading, '');

  // 未配置云环境时的失败路径
  require(path.join(root, 'config.js')).cloudEnv = '';
  await assert.rejects(api.diagnose(s, {}), (e) => e.code === 'NO_ENV');

  console.log('OK: miniprogram simulation passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: 写根 package.json**

`package.json`（仓库根）：

```json
{
  "name": "amharic-leander",
  "private": true,
  "description": "Amharic Learner 阿姆哈拉语学习小程序（含微信云函数）",
  "scripts": {
    "test": "node --test cloudfunctions/api/test/*.test.js && node scripts/sim-miniprogram.js"
  }
}
```

- [ ] **Step 3: 运行**

Run: `npm test`
Expected: 云函数 `# pass 20`，随后打印 `OK: miniprogram simulation passed`，退出码 0

如果 `coach.diagnose()` 断言失败，检查 Task 6 Step 3 的解构是否已改为 `const diagnosis = await api.diagnose(...)`。

- [ ] **Step 4: 提交**

```bash
git add scripts/sim-miniprogram.js package.json
git commit -m "test: add end-to-end mini-program simulation against cloud handler

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ"
```

---

### Task 8: 删除 Express 后台，更新 README 与 .gitignore

**Files:**
- Delete: `server/`
- Modify: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: 删除 server 目录**

```bash
git rm -r -q server
ls server 2>&1 | head -1   # 期望：No such file or directory
grep -rn "server/" README.md docs/learning-plan.md miniprogram/ scripts/ | grep -v "云端\|服务器" || true
```

- [ ] **Step 2: 改 .gitignore**

整个文件替换为：

```
node_modules/
.env
.DS_Store
```

- [ ] **Step 3: 改 README.md**

功能表中「我的」一行替换为：

```
| 我的 | 每日目标、新词上限、开始日期、云端同步状态、立即上传 / 从云端恢复 |
```

「目录」代码块整体替换为：

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

「快速开始」整节（从 `## 快速开始` 到 `## 学习计划概览` 之前）替换为：

````
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

````

- [ ] **Step 4: 全量验证**

```bash
npm test
git status --short
grep -rn "server/\|Express\|Docker\|nginx" README.md || echo "README clean"
```

Expected: 测试通过；`git status` 只显示 README、.gitignore 的修改和 server 的删除；最后一行 `README clean`

- [ ] **Step 5: 提交并推送**

```bash
git add -A
git commit -m "chore: remove Express backend, document CloudBase deployment

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ"
git push -u origin claude/amharic-learning-wechat-app-phqk1c
```

---

## 自查记录

- Spec 3.1 六个动作 → Task 1（progress.*）、Task 3（ai.*）。超时 60/50 秒 → Task 1 config.json、Task 2 deepseek.js。环境变量 → Task 2。
- Spec 3.2 两集合、权限、30 条保留、chat 7 天清理 → Task 3 handler + Task 4 db.js；集合创建与权限在 Task 8 README 步骤 2.3。
- Spec 3.3 小程序侧六项 → Task 5（api.js、config.js、app.js、sync.js、app.json、project.config.json）、Task 6（profile、coach）。
- Spec 3.4 删除 → Task 8。
- Spec 5 错误码与文案 → Task 3 映射、Task 5 MESSAGES、Task 6 fail()。
- Spec 6 每日 20 次 → Task 3。
- Spec 7 测试五类 → Task 1（分发、进度）、Task 3（AI、上限、history）、Task 7（小程序模拟）。
- Spec 8 上线步骤 → Task 8 README。
- 名称一致性：`api.configured()` 在 Task 5 定义、Task 5 sync.js 与 Task 6 profile 使用；`DAILY_AI_LIMIT` 在 Task 3 导出、Task 3 测试使用；db 接口六个方法在 Task 1 fakeDb、Task 4 db.js、Task 3 handler 三处一致。
