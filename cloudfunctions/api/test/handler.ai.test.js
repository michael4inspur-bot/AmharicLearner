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
    // 日期必须单调递增（真实调用如此），否则后插入的早期日期会被“每日上限”按当天计数拦截
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
