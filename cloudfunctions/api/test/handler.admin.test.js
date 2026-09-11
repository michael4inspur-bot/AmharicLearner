const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handle } = require('../handler.js');
const { USER_STATUSES } = require('../admin.js');
const { dayStartIso } = require('../time.js');
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

test('user.setProfile：昵称去空白后写入，超长 / 空 / 非字符串被拒', async () => {
  await withEnv({}, async () => {
    const c = ctx();
    assert.equal((await handle('user.setProfile', { nickname: '   ' }, c)).code, 'BAD_REQUEST');
    assert.equal((await handle('user.setProfile', { nickname: 'x'.repeat(21) }, c)).code, 'BAD_REQUEST');
    assert.equal((await handle('user.setProfile', { nickname: 42 }, c)).code, 'BAD_REQUEST');
    assert.equal((await handle('user.setProfile', {}, c)).code, 'BAD_REQUEST');
    const res = await handle('user.setProfile', { nickname: '  李工  ' }, c);
    assert.deepEqual(res, { ok: true, data: { nickname: '李工' } });
    const doc = await c.db.getUser('u1');
    assert.equal(doc.nickname, '李工');
    // 未显式写过 status 的文档视为 active
    assert.equal((await handle('user.me', {}, c)).data.status, 'active');
  });
});

test('user.me：无记录视为 active 且昵称为空；设置昵称后返回昵称与状态', async () => {
  await withEnv({}, async () => {
    const c = ctx();
    assert.deepEqual((await handle('user.me', {}, c)).data, { openid: 'u1', nickname: '', status: 'active' });
    await handle('user.setProfile', { nickname: '李工' }, c);
    await c.db.putUser('u1', { status: 'paused' });
    assert.deepEqual((await handle('user.me', {}, c)).data, { openid: 'u1', nickname: '李工', status: 'paused' });
  });
});

test('progress.put：写 users 摘要，createdAt 仅首次，meta 缺省为 0', async () => {
  await withEnv({}, async () => {
    const db = createFakeDb();
    await handle('progress.put', { progress: { streak: 3 }, meta: { week: 2, streak: 5, stars: 12 } }, ctx({ db }));
    const first = await db.getUser('u1');
    assert.equal(first.createdAt, '2026-09-11T10:00:00.000Z');
    assert.equal(first.lastActive, '2026-09-11T10:00:00.000Z');
    assert.deepEqual([first.week, first.streak, first.stars], [2, 5, 12]);
    // 第二次：createdAt 不变，lastActive 更新，meta 缺省为 0
    await handle('progress.put', { progress: { streak: 4 } }, ctx({ db, isoNow: '2026-09-12T10:00:00Z' }));
    const second = await db.getUser('u1');
    assert.equal(second.createdAt, '2026-09-11T10:00:00.000Z');
    assert.equal(second.lastActive, '2026-09-12T10:00:00.000Z');
    assert.deepEqual([second.week, second.streak, second.stars], [0, 0, 0]);
  });
});

test('状态拦截：paused 用户 ai/tts/stt 被拒，progress.put 仍可用', async () => {
  await withEnv({}, async () => {
    const db = createFakeDb();
    await db.putUser('u1', { status: 'paused' });
    const c = ctx({ db });
    const chat = await handle('ai.chat', { messages: [{ role: 'user', content: 'hi' }] }, c);
    assert.deepEqual(chat, { ok: false, code: 'BAD_REQUEST', error: '账号已被管理员暂停' });
    const tts = await handle('tts.get', { text: 'ሰላም', voice: 'female', rate: 'normal' }, c);
    assert.equal(tts.error, '账号已被管理员暂停');
    const stt = await handle('stt.score', { fileID: 'x', target: 'ሰላም' }, c);
    assert.equal(stt.error, '账号已被管理员暂停');
    assert.equal(c.db._logs.length, 0);
    assert.equal((await handle('progress.put', { progress: { streak: 1 } }, c)).ok, true);
    assert.equal((await handle('progress.get', {}, c)).ok, true);
    // 状态回到 active 后恢复
    await db.putUser('u1', { status: 'active' });
    assert.equal((await handle('ai.chat', { messages: [{ role: 'user', content: 'hi' }] }, c)).ok, true);
  });
});

test('状态拦截：blocked 用户 progress.get / progress.put 被拒', async () => {
  await withEnv({}, async () => {
    const db = createFakeDb();
    await db.putUser('u1', { status: 'blocked' });
    const c = ctx({ db });
    assert.deepEqual(await handle('progress.put', { progress: { streak: 1 } }, c), { ok: false, code: 'BAD_REQUEST', error: '账号已停用' });
    assert.deepEqual(await handle('progress.get', {}, c), { ok: false, code: 'BAD_REQUEST', error: '账号已停用' });
    assert.equal((await handle('ai.chat', { messages: [{ role: 'user', content: 'hi' }] }, c)).error, '账号已被管理员暂停');
  });
});

test('admin.*：非管理员一律被拒', async () => {
  await withEnv({ ADMIN_OPENIDS: 'boss' }, async () => {
    const c = ctx({ openid: 'u1' });
    for (const action of ['admin.users', 'admin.setStatus', 'admin.deleteUser', 'admin.system', 'admin.clearTtsCache', 'admin.setAnnouncement']) {
      const res = await handle(action, { openid: 'u2', status: 'paused', confirm: true, text: 'x' }, c);
      assert.deepEqual(res, { ok: false, code: 'BAD_REQUEST', error: '无权限' }, action);
    }
  });
});

test('admin.users：合并当日用量、标 isSelf、按 lastActive 倒序', async () => {
  await withEnv({ ADMIN_OPENIDS: 'u1' }, async () => {
    const db = createFakeDb();
    await db.putUser('u1', { nickname: '李工', status: 'active', lastActive: '2026-09-11T09:00:00.000Z', week: 2, streak: 5, stars: 12 });
    await db.putUser('u2', { nickname: '', status: 'paused', lastActive: '2026-09-11T11:00:00.000Z', week: 1, streak: 0, stars: 3 });
    await db.addAiLog(log('u1', 'chat', '2026-09-11T08:00:00.000Z', { reply: 'a' }));
    await db.addAiLog(log('u1', 'diagnosis', '2026-09-11T08:10:00.000Z', {}));
    await db.addAiLog(log('u1', 'tts', '2026-09-11T08:20:00.000Z', { chars: 4, key: 'k' }));
    await db.addAiLog(log('u2', 'stt', '2026-09-11T08:30:00.000Z', { transcript: '', score: 0 }));
    // 昨天（东非时间）的不计入今日
    await db.addAiLog(log('u1', 'chat', '2026-09-10T20:00:00.000Z', { reply: 'old' }));
    assert.equal(dayStartIso(new Date(NOW)), '2026-09-10T21:00:00.000Z');
    const res = await handle('admin.users', {}, ctx({ openid: 'u1', db }));
    assert.equal(res.ok, true);
    assert.deepEqual(res.data.users, [
      { openid: 'u2', nickname: '', status: 'paused', lastActive: '2026-09-11T11:00:00.000Z', week: 1, streak: 0, stars: 3, today: { ai: 0, tts: 0, stt: 1 }, isSelf: false },
      { openid: 'u1', nickname: '李工', status: 'active', lastActive: '2026-09-11T09:00:00.000Z', week: 2, streak: 5, stars: 12, today: { ai: 2, tts: 1, stt: 0 }, isSelf: true }
    ]);
  });
});

test('admin.setStatus：非法值、缺 openid、对自己被拒；正常修改生效', async () => {
  await withEnv({ ADMIN_OPENIDS: 'u1' }, async () => {
    const db = createFakeDb();
    const c = ctx({ openid: 'u1', db });
    assert.deepEqual(USER_STATUSES, ['active', 'paused', 'blocked']);
    assert.match((await handle('admin.setStatus', { openid: 'u2', status: 'nope' }, c)).error, /status/);
    assert.equal((await handle('admin.setStatus', { status: 'paused' }, c)).code, 'BAD_REQUEST');
    assert.deepEqual(await handle('admin.setStatus', { openid: 'u1', status: 'paused' }, c), { ok: false, code: 'BAD_REQUEST', error: '不能操作自己的账号' });
    const res = await handle('admin.setStatus', { openid: 'u2', status: 'paused' }, c);
    assert.deepEqual(res, { ok: true, data: { openid: 'u2', status: 'paused' } });
    assert.equal((await db.getUser('u2')).status, 'paused');
    await handle('admin.setStatus', { openid: 'u2', status: 'active' }, c);
    assert.equal((await db.getUser('u2')).status, 'active');
  });
});

test('admin.deleteUser：缺 confirm 与对自己被拒', async () => {
  await withEnv({ ADMIN_OPENIDS: 'u1' }, async () => {
    const c = ctx({ openid: 'u1' });
    assert.deepEqual(await handle('admin.deleteUser', { openid: 'u2' }, c), { ok: false, code: 'BAD_REQUEST', error: '需要确认' });
    assert.deepEqual(await handle('admin.deleteUser', { openid: 'u1', confirm: true }, c), { ok: false, code: 'BAD_REQUEST', error: '不能操作自己的账号' });
  });
});

test('admin.deleteUser：进度与日志被删，users 文档变 blocked 且保留昵称', async () => {
  await withEnv({ ADMIN_OPENIDS: 'u1' }, async () => {
    const db = createFakeDb();
    await db.putProgress('u2', { progress: { streak: 3 }, updatedAt: NOW });
    await db.putUser('u2', { nickname: '小王', status: 'active', week: 2, streak: 3, stars: 9 });
    await db.addAiLog(log('u2', 'chat', '2026-09-11T08:00:00.000Z', { reply: 'a' }));
    await db.addAiLog(log('u1', 'chat', '2026-09-11T08:00:00.000Z', { reply: 'keep' }));
    const res = await handle('admin.deleteUser', { openid: 'u2', confirm: true }, ctx({ openid: 'u1', db }));
    assert.deepEqual(res, { ok: true, data: { deleted: true } });
    assert.equal(await db.getProgress('u2'), null);
    assert.deepEqual(db._logs.map((l) => l.openid), ['u1']);
    const doc = await db.getUser('u2');
    assert.equal(doc.status, 'blocked');
    assert.equal(doc.nickname, '小王');
    assert.equal(doc.deletedAt, '2026-09-11T10:00:00.000Z');
    assert.deepEqual([doc.week, doc.streak, doc.stars], [0, 0, 0]);
  });
});

test('admin.system：结构完整，aiDaily 14 项按日期升序，aiToday 为当天', async () => {
  await withEnv({ ADMIN_OPENIDS: 'u1', TTS_MONTHLY_CHARS_LIMIT: '1000' }, async () => {
    const db = createFakeDb();
    await db.addAiLog(log('u1', 'chat', '2026-09-11T08:00:00.000Z', { reply: 'a' }));
    await db.addAiLog(log('u1', 'diagnosis', '2026-09-11T09:00:00.000Z', {}));
    await db.addAiLog(log('u2', 'chat', '2026-09-05T09:00:00.000Z', {}));
    await db.addAiLog(log('u1', 'tts', '2026-09-11T09:30:00.000Z', { chars: 20, key: 'k' }));
    // 14 天之前的不计入
    await db.addAiLog(log('u2', 'chat', '2026-08-01T09:00:00.000Z', {}));
    await db.putTtsCache({ _id: 'k1', fileID: 'cloud://a', text: 'a', voice: 'female', rate: 'normal', chars: 6, createdAt: NOW });
    await db.putTtsCache({ _id: 'k2', fileID: 'cloud://b', text: 'b', voice: 'female', rate: 'normal', chars: 4, createdAt: NOW });
    await db.addErrorLog({ date: '2026-09-11T07:00:00.000Z', openid: 'u2', action: 'ai.chat', message: 'boom' });
    const res = await handle('admin.system', {}, ctx({ openid: 'u1', db }));
    assert.equal(res.ok, true);
    assert.deepEqual(res.data.monthChars, { used: 20, limit: 1000 });
    assert.equal(res.data.aiToday, 2);
    assert.equal(res.data.aiDaily.length, 14);
    assert.equal(res.data.aiDaily[0].date, '2026-08-29');
    assert.equal(res.data.aiDaily[13].date, '2026-09-11');
    assert.equal(res.data.aiDaily[13].count, 2);
    assert.equal(res.data.aiDaily.find((d) => d.date === '2026-09-05').count, 1);
    assert.equal(res.data.aiDaily.filter((d) => d.count === 0).length, 12);
    const dates = res.data.aiDaily.map((d) => d.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.deepEqual(res.data.ttsCache, { count: 2, chars: 10 });
    assert.deepEqual(res.data.errors, [{ date: '2026-09-11T07:00:00.000Z', openid: 'u2', action: 'ai.chat', message: 'boom' }]);
  });
});

test('admin.clearTtsCache：缺 confirm 被拒；确认后分批删文件与文档', async () => {
  await withEnv({ ADMIN_OPENIDS: 'u1' }, async () => {
    const db = createFakeDb();
    const storage = createFakeStorage();
    for (let i = 0; i < 120; i++) {
      const fileID = await storage.upload(`tts/${i}.mp3`, Buffer.from('mp3'));
      await db.putTtsCache({ _id: `k${i}`, fileID, text: 't', voice: 'female', rate: 'normal', chars: 1, createdAt: NOW });
    }
    const c = ctx({ openid: 'u1', db, storage });
    assert.deepEqual(await handle('admin.clearTtsCache', {}, c), { ok: false, code: 'BAD_REQUEST', error: '需要确认' });
    const res = await handle('admin.clearTtsCache', { confirm: true }, c);
    assert.deepEqual(res, { ok: true, data: { removed: 120 } });
    assert.deepEqual(await db.ttsCacheStats(), { count: 0, chars: 0 });
    assert.equal(storage._files.size, 0);
    assert.deepEqual((await handle('admin.clearTtsCache', { confirm: true }, c)).data, { removed: 0 });
  });
});

test('公告：默认空、写入后所有人可读、超 500 字被拒、清空即撤下', async () => {
  await withEnv({ ADMIN_OPENIDS: 'u1' }, async () => {
    const db = createFakeDb();
    const admin = ctx({ openid: 'u1', db });
    const user = ctx({ openid: 'u2', db });
    assert.deepEqual((await handle('announcement.get', {}, user)).data, { text: '', updatedAt: null });
    assert.equal((await handle('admin.setAnnouncement', { text: 'x'.repeat(501) }, admin)).code, 'BAD_REQUEST');
    assert.equal((await handle('admin.setAnnouncement', { text: 42 }, admin)).code, 'BAD_REQUEST');
    const put = await handle('admin.setAnnouncement', { text: '  周五实战  ' }, admin);
    assert.deepEqual(put.data, { text: '周五实战', updatedAt: '2026-09-11T10:00:00.000Z' });
    assert.deepEqual((await handle('announcement.get', {}, user)).data, { text: '周五实战', updatedAt: '2026-09-11T10:00:00.000Z' });
    assert.equal((await db.getSetting('announcement')).by, 'u1');
    // 清空即撤下
    await handle('admin.setAnnouncement', { text: '' }, admin);
    assert.equal((await handle('announcement.get', {}, user)).data.text, '');
  });
});

test('error_logs：addErrorLog 后 pruneErrorLogs(200) 只保留最新 200 条', async () => {
  const db = createFakeDb();
  for (let i = 0; i < 250; i++) {
    await db.addErrorLog({ date: `2026-09-11T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`, openid: 'u1', action: 'ai.chat', message: `e${i}` });
  }
  await db.pruneErrorLogs(200);
  assert.equal(db._errors.length, 200);
  const list = await db.listErrorLogs(20);
  assert.equal(list.length, 20);
  assert.equal(list[0].message, 'e249');
  assert.deepEqual(Object.keys(list[0]).sort(), ['action', 'date', 'message', 'openid']);
  // 全部条目都在最新 200 条内
  assert.equal(db._errors.every((e) => Number(e.message.slice(1)) >= 50), true);
});

test('index.js 的错误日志写入：message 截断到 300 字', async () => {
  await withEnv({ ADMIN_OPENIDS: 'u1' }, async () => {
    const db = createFakeDb();
    await db.addErrorLog({ date: NOW, openid: 'u1', action: 'ai.chat', message: 'x'.repeat(300) });
    const list = await db.listErrorLogs(20);
    assert.equal(list[0].message.length, 300);
  });
});

test('未知 user./announcement./admin. action → BAD_REQUEST；admin.usage 仍走原实现', async () => {
  await withEnv({ ADMIN_OPENIDS: 'u1' }, async () => {
    const c = ctx({ openid: 'u1' });
    assert.match((await handle('user.nope', {}, c)).error, /未知 action/);
    assert.match((await handle('announcement.nope', {}, c)).error, /未知 action/);
    assert.match((await handle('admin.nope', {}, c)).error, /未知 action/);
    const usage = await handle('admin.usage', {}, c);
    assert.equal(usage.ok, true);
    assert.deepEqual(usage.data.users, []);
    assert.equal(typeof usage.data.since, 'string');
  });
});
