const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handle } = require('../handler.js');
const { createFakeDb } = require('./fakeDb.js');

function ctx(openid, db) {
  return { openid, db, now: () => new Date('2026-09-11T10:00:00Z') };
}

test('未知 action 返回 BAD_REQUEST', async () => {
  const res = await handle('nope', {}, ctx('u1', createFakeDb()));
  assert.equal(res.ok, false);
  assert.equal(res.code, 'BAD_REQUEST');
});

test('progress.get 无记录时返回 progress null', async () => {
  const res = await handle('progress.get', {}, ctx('u1', createFakeDb()));
  assert.deepEqual(res, { ok: true, data: { progress: null, updatedAt: null, lang: 'am' } });
});

test('progress.put 后 get 返回同一对象与 updatedAt', async () => {
  const db = createFakeDb();
  const put = await handle('progress.put', { progress: { streak: 3 } }, ctx('u1', db));
  assert.equal(put.ok, true);
  assert.equal(put.data.updatedAt, '2026-09-11T10:00:00.000Z');
  const got = await handle('progress.get', {}, ctx('u1', db));
  assert.deepEqual(got.data, { progress: { streak: 3 }, updatedAt: '2026-09-11T10:00:00.000Z', lang: 'am' });
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

test('progress.put 带 baseUpdatedAt 时，旧快照不能覆盖云端新数据', async () => {
  const db = createFakeDb();
  const c = ctx('u1', db);
  const first = await handle('progress.put', { progress: { unitsLearned: { u01: '2026-09-11' } } }, c);
  assert.equal(first.ok, true);
  const base = first.data.updatedAt;
  // 另一台设备后来又传了一份
  await db.putProgress('u1', { progress: { unitsLearned: { u01: '2026-09-11', u02: '2026-09-12' } }, updatedAt: '2099-01-01T00:00:00.000Z' });
  // 旧设备拿着过期的 base 再传，必须被拒
  const stale = await handle('progress.put', { progress: { unitsLearned: {} }, baseUpdatedAt: base }, c);
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'CONFLICT');
  const doc = await db.getProgress('u1');
  assert.ok(doc.progress.unitsLearned.u02, '云端数据没有被旧快照覆盖');
});

test('progress 按语言分文档：om 写到 openid:om，am 不受影响', async () => {
  const db = createFakeDb();
  const c = ctx('u1', db);
  await handle('progress.put', { progress: { v: 'am' } }, c);
  const put = await handle('progress.put', { progress: { v: 'om' }, lang: 'om' }, c);
  assert.equal(put.ok, true);
  assert.equal(put.data.lang, 'om');
  assert.equal((await db.getProgress('u1')).progress.v, 'am', '阿姆哈拉语文档没被覆盖');
  assert.equal((await db.getProgress('u1:om')).progress.v, 'om');
  const got = await handle('progress.get', { lang: 'om' }, c);
  assert.deepEqual(got.data, { progress: { v: 'om' }, updatedAt: '2026-09-11T10:00:00.000Z', lang: 'om' });
});

test('progress 的 lang 非法时返回 BAD_REQUEST', async () => {
  const c = ctx('u1', createFakeDb());
  assert.equal((await handle('progress.get', { lang: 'xx' }, c)).code, 'BAD_REQUEST');
  assert.equal((await handle('progress.put', { progress: {}, lang: 'fr' }, c)).code, 'BAD_REQUEST');
});

test('冲突检测按语言各自进行', async () => {
  const db = createFakeDb();
  const c = ctx('u1', db);
  const first = await handle('progress.put', { progress: { v: 1 }, lang: 'om' }, c);
  await db.putProgress('u1', { progress: { v: 'am-new' }, updatedAt: '2099-01-01T00:00:00.000Z' });
  const again = await handle('progress.put', { progress: { v: 2 }, lang: 'om', baseUpdatedAt: first.data.updatedAt }, c);
  assert.equal(again.ok, true, '阿姆哈拉语文档更新不影响奥罗莫语的冲突判断');
});

test('只有阿姆哈拉语的上传更新用户摘要', async () => {
  const db = createFakeDb();
  await db.putUser('u1', { _id: 'u1', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' });
  const c = ctx('u1', db);
  await handle('progress.put', { progress: {}, meta: { week: 3, streak: 2, stars: 50 }, lang: 'om' }, c);
  assert.equal((await db.getUser('u1')).week, undefined, 'om 上传不写摘要');
  await handle('progress.put', { progress: {}, meta: { week: 3, streak: 2, stars: 50 } }, c);
  assert.equal((await db.getUser('u1')).week, 3);
});
