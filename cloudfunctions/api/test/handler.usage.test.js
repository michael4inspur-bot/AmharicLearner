const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handle } = require('../handler.js');
const { ttsKey } = require('../speech.js');
const { monthStartIso, dayStartIso } = require('../time.js');
const { createFakeDb } = require('./fakeDb.js');
const { createFakeDeepseek } = require('./fakeDeepseek.js');
const { createFakeAzure } = require('./fakeAzure.js');
const { createFakeStorage } = require('./fakeStorage.js');

const KEYS = ['AI_DAILY_LIMIT', 'TTS_DAILY_LIMIT', 'STT_DAILY_LIMIT', 'TTS_MONTHLY_CHARS_LIMIT', 'ADMIN_OPENIDS'];
const NOW = '2026-09-11T10:00:00Z';

/** 临时设置环境变量执行 async fn，结束后恢复。 */
async function withEnv(vars, fn) {
  const saved = {};
  for (const k of KEYS) saved[k] = process.env[k];
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
  try {
    return await fn();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

function ctx({ openid = 'u1', db, deepseek, azure, storage, isoNow } = {}) {
  return {
    openid,
    db: db || createFakeDb(),
    deepseek: deepseek || createFakeDeepseek(() => 'ok'),
    azure: azure || createFakeAzure(),
    storage: storage || createFakeStorage(),
    now: () => new Date(isoNow || NOW)
  };
}

function log(openid, type, date, result) {
  return { openid, type, date, request: 'x', result };
}

async function chat(c) {
  return handle('ai.chat', { messages: [{ role: 'user', content: 'hi' }] }, c);
}

test('time.monthStartIso / dayStartIso：东非时间自然月 / 自然日', () => {
  assert.equal(dayStartIso(new Date('2026-09-11T10:00:00Z')), '2026-09-10T21:00:00.000Z');
  // 9 月 1 日东非 00:00 = 8 月 31 日 UTC 21:00
  assert.equal(monthStartIso(new Date('2026-09-11T10:00:00Z')), '2026-08-31T21:00:00.000Z');
  // UTC 8 月 31 日 22:00 已是东非 9 月 1 日
  assert.equal(monthStartIso(new Date('2026-08-31T22:00:00Z')), '2026-08-31T21:00:00.000Z');
  // UTC 8 月 31 日 20:00 仍是东非 8 月 31 日
  assert.equal(monthStartIso(new Date('2026-08-31T20:00:00Z')), '2026-07-31T21:00:00.000Z');
});

test('usage.get：2 条 chat、1 条 tts(5 字)、1 条 stt → 计数正确，limit 为默认', async () => {
  await withEnv({}, async () => {
    const db = createFakeDb();
    await db.addAiLog(log('u1', 'chat', '2026-09-11T08:00:00.000Z', { reply: 'a' }));
    await db.addAiLog(log('u1', 'chat', '2026-09-11T09:00:00.000Z', { reply: 'b' }));
    await db.addAiLog(log('u1', 'tts', '2026-09-11T09:10:00.000Z', { chars: 5, key: 'k' }));
    await db.addAiLog(log('u1', 'stt', '2026-09-11T09:20:00.000Z', { transcript: '', score: 0 }));
    // 昨天（东非时间）的记录不计入今日，但计入本月字符
    await db.addAiLog(log('u1', 'chat', '2026-09-10T20:00:00.000Z', { reply: 'old' }));
    await db.addAiLog(log('u1', 'tts', '2026-09-10T20:00:00.000Z', { chars: 7, key: 'k2' }));
    // 上月的 tts 不计入本月字符
    await db.addAiLog(log('u1', 'tts', '2026-08-20T10:00:00.000Z', { chars: 100, key: 'k3' }));
    // 其他用户的 tts 字符计入全体合计，但不计入 u1 的次数
    await db.addAiLog(log('u2', 'tts', '2026-09-11T09:30:00.000Z', { chars: 11, key: 'k4' }));
    const res = await handle('usage.get', {}, ctx({ db }));
    assert.equal(res.ok, true);
    assert.deepEqual(res.data, {
      ai: { used: 2, limit: 20 },
      tts: { used: 1, limit: 300 },
      stt: { used: 1, limit: 100 },
      monthChars: { used: 5 + 7 + 11, limit: 400000 },
      isAdmin: false
    });
  });
});

test('AI_DAILY_LIMIT=3：usage.get 的 limit 为 3，第 4 次 chat 被拒', async () => {
  await withEnv({ AI_DAILY_LIMIT: '3' }, async () => {
    const c = ctx();
    for (let i = 0; i < 3; i++) {
      const r = await chat(c);
      assert.equal(r.ok, true, `第 ${i + 1} 次应成功`);
    }
    const blocked = await chat(c);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, 'BAD_REQUEST');
    assert.match(blocked.error, /3/);
    assert.match(blocked.error, /已用完/);
    const usage = await handle('usage.get', {}, c);
    assert.deepEqual(usage.data.ai, { used: 3, limit: 3 });
  });
  // 环境恢复后回到默认
  await withEnv({}, async () => {
    const usage = await handle('usage.get', {}, ctx());
    assert.equal(usage.data.ai.limit, 20);
  });
});

test('TTS_DAILY_LIMIT / STT_DAILY_LIMIT 也每次从环境读取', async () => {
  await withEnv({ TTS_DAILY_LIMIT: '1', STT_DAILY_LIMIT: '2' }, async () => {
    const c = ctx();
    const usage = await handle('usage.get', {}, c);
    assert.equal(usage.data.tts.limit, 1);
    assert.equal(usage.data.stt.limit, 2);
    assert.equal((await handle('tts.get', { text: 'A', voice: 'female', rate: 'normal' }, c)).ok, true);
    const blocked = await handle('tts.get', { text: 'B', voice: 'female', rate: 'normal' }, c);
    assert.equal(blocked.code, 'BAD_REQUEST');
    assert.match(blocked.error, /1 次/);
    const storage = c.storage;
    for (let i = 0; i < 2; i++) {
      const fileID = await storage.upload(`stt/${i}.wav`, Buffer.from('wav'));
      assert.equal((await handle('stt.score', { fileID, target: 'ሰላም' }, c)).ok, true);
    }
    const fileID = await storage.upload('stt/last.wav', Buffer.from('wav'));
    const stt = await handle('stt.score', { fileID, target: 'ሰላም' }, c);
    assert.equal(stt.code, 'BAD_REQUEST');
    assert.match(stt.error, /2 次/);
  });
});

test('admin.usage：非管理员被拒绝（含 ADMIN_OPENIDS 未设置）', async () => {
  await withEnv({}, async () => {
    const res = await handle('admin.usage', {}, ctx());
    assert.deepEqual(res, { ok: false, code: 'BAD_REQUEST', error: '无权限' });
  });
  await withEnv({ ADMIN_OPENIDS: 'boss, other' }, async () => {
    const res = await handle('admin.usage', {}, ctx({ openid: 'u1' }));
    assert.equal(res.code, 'BAD_REQUEST');
    assert.equal(res.error, '无权限');
    const usage = await handle('usage.get', {}, ctx({ openid: 'u1' }));
    assert.equal(usage.data.isAdmin, false);
  });
});

test('admin.usage：管理员得到最近 7 天按用户汇总，按 ai 降序', async () => {
  await withEnv({ ADMIN_OPENIDS: ' u1 ,boss' }, async () => {
    const db = createFakeDb();
    // u1：1 chat、1 tts
    await db.addAiLog(log('u1', 'chat', '2026-09-09T08:00:00.000Z', { reply: 'a' }));
    await db.addAiLog(log('u1', 'tts', '2026-09-11T09:00:00.000Z', { chars: 5, key: 'k' }));
    // u2：2 diagnosis + 1 plan + 1 stt + 2 tts
    await db.addAiLog(log('u2', 'diagnosis', '2026-09-05T08:00:00.000Z', {}));
    await db.addAiLog(log('u2', 'plan', '2026-09-06T08:00:00.000Z', {}));
    await db.addAiLog(log('u2', 'diagnosis', '2026-09-10T23:00:00.000Z', {}));
    await db.addAiLog(log('u2', 'stt', '2026-09-07T08:00:00.000Z', { transcript: '', score: 0 }));
    await db.addAiLog(log('u2', 'tts', '2026-09-07T08:00:00.000Z', { chars: 3, key: 'a' }));
    await db.addAiLog(log('u2', 'tts', '2026-09-08T08:00:00.000Z', { chars: 4, key: 'b' }));
    // 7 天之前的不计
    await db.addAiLog(log('u2', 'chat', '2026-09-01T08:00:00.000Z', { reply: 'old' }));
    await db.addAiLog(log('u3', 'chat', '2026-08-30T08:00:00.000Z', { reply: 'old' }));
    const c = ctx({ openid: 'u1', db });
    assert.equal((await handle('usage.get', {}, c)).data.isAdmin, true);
    const res = await handle('admin.usage', {}, c);
    assert.equal(res.ok, true);
    assert.equal(res.data.since, '2026-09-04T10:00:00.000Z');
    assert.deepEqual(res.data.users, [
      { openid: 'u2', ai: 3, tts: 2, stt: 1, ttsChars: 7, lastActive: '2026-09-10' },
      { openid: 'u1', ai: 1, tts: 1, stt: 0, ttsChars: 5, lastActive: '2026-09-11' }
    ]);
  });
});

test('TTS_MONTHLY_CHARS_LIMIT=10：未命中 6 字成功、再 6 字被拒、已缓存仍可取', async () => {
  await withEnv({ TTS_MONTHLY_CHARS_LIMIT: '10' }, async () => {
    const c = ctx();
    const first = await handle('tts.get', { text: 'ሰላምሰላም', voice: 'female', rate: 'normal' }, c);
    assert.equal(first.ok, true);
    assert.equal(first.data.key, ttsKey('female', 'normal', 'ሰላምሰላም'));
    assert.equal(c.azure.synthCalls.length, 1);
    const second = await handle('tts.get', { text: 'ሀሁሂሃሄህ', voice: 'female', rate: 'normal' }, c);
    assert.deepEqual(second, { ok: false, code: 'BAD_REQUEST', error: '本月语音额度已用完，下月恢复' });
    assert.equal(c.azure.synthCalls.length, 1);
    assert.equal(c.db._logs.length, 1);
    // 已缓存的仍能取到 url（不调 azure）
    const hit = await handle('tts.get', { text: 'ሰላምሰላም', voice: 'female', rate: 'normal' }, c);
    assert.equal(hit.ok, true);
    assert.equal(hit.data.url, first.data.url);
    assert.equal(c.azure.synthCalls.length, 1);
    // 其他用户同样受全体合计限制
    const other = await handle('tts.get', { text: 'ሀሁሂሃሄህ', voice: 'female', rate: 'normal' }, { ...c, openid: 'u2' });
    assert.equal(other.code, 'BAD_REQUEST');
    assert.match(other.error, /本月/);
    // 刚好用满允许：4 字（6 + 4 = 10，不超过）
    const exact = await handle('tts.get', { text: 'ሀሁሂሃ', voice: 'female', rate: 'normal' }, c);
    assert.equal(exact.ok, true);
    // usage.get 反映本月字符
    const usage = await handle('usage.get', {}, c);
    assert.deepEqual(usage.data.monthChars, { used: 10, limit: 10 });
    // 下月恢复（东非 10 月 1 日 00:30 = UTC 9 月 30 日 21:30）
    const nextMonth = await handle('tts.get', { text: 'ሀሁሂሃሄህ', voice: 'female', rate: 'normal' }, { ...c, now: () => new Date('2026-09-30T21:30:00Z') });
    assert.equal(nextMonth.ok, true);
  });
});

test('tts.batch：月度超限的未命中项被省略，命中项与未超限项正常', async () => {
  await withEnv({ TTS_MONTHLY_CHARS_LIMIT: '10' }, async () => {
    const c = ctx();
    await handle('tts.get', { text: 'ሰላምሰላም', voice: 'female', rate: 'normal' }, c); // 6 字，已缓存
    const res = await handle('tts.batch', {
      voice: 'female',
      rate: 'normal',
      items: [{ id: 'hit', text: 'ሰላምሰላም' }, { id: 'small', text: 'ሀሁ' }, { id: 'big', text: 'ሀሁሂሃሄህሆ' }]
    }, c);
    assert.equal(res.ok, true);
    assert.deepEqual(Object.keys(res.data.urls).sort(), ['hit', 'small']);
    assert.equal(c.azure.synthCalls.length, 2);
  });
});

test('usage.get 不接受入参也不写日志', async () => {
  await withEnv({}, async () => {
    const c = ctx();
    const res = await handle('usage.get', undefined, c);
    assert.equal(res.ok, true);
    assert.equal(c.db._logs.length, 0);
  });
});
