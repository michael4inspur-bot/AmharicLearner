const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleSpeech, TTS_DAILY_LIMIT, STT_DAILY_LIMIT, VOICES, ttsKey } = require('../speech.js');
const { handle } = require('../handler.js');
const { createFakeDb } = require('./fakeDb.js');
const { createFakeAzure } = require('./fakeAzure.js');
const { createFakeStorage } = require('./fakeStorage.js');
const { errorOf } = require('./fakeDeepseek.js');

function ctx({ openid = 'u1', db, azure, storage, isoNow } = {}) {
  return {
    openid,
    db: db || createFakeDb(),
    azure: azure || createFakeAzure(),
    storage: storage || createFakeStorage(),
    now: () => new Date(isoNow || '2026-09-11T10:00:00Z')
  };
}

const TTS_DATA = { text: 'ሰላም', voice: 'female', rate: 'normal' };

test('常量与 ttsKey', () => {
  assert.equal(TTS_DAILY_LIMIT, 300);
  assert.equal(STT_DAILY_LIMIT, 100);
  assert.deepEqual(VOICES, { female: 'am-ET-MekdesNeural', male: 'am-ET-AmehaNeural' });
  const key = ttsKey('female', 'normal', 'ሰላም');
  assert.match(key, /^[0-9a-f]{40}$/);
  assert.equal(key, ttsKey('female', 'normal', 'ሰላም'));
  assert.notEqual(key, ttsKey('male', 'normal', 'ሰላም'));
  assert.notEqual(key, ttsKey('female', 'slow', 'ሰላም'));
});

test('tts.get 首次：调 azure 一次、上传一次、缓存一条、日志一条', async () => {
  const c = ctx();
  const res = await handleSpeech('tts.get', TTS_DATA, c);
  assert.equal(res.ok, true);
  const key = ttsKey('female', 'normal', 'ሰላም');
  assert.equal(res.data.key, key);
  assert.equal(res.data.url, `https://fake/cloud://fake/tts/${key}.mp3`);
  assert.equal(c.azure.synthCalls.length, 1);
  assert.deepEqual(c.azure.synthCalls[0], { text: 'ሰላም', voiceName: 'am-ET-MekdesNeural', rate: 'normal' });
  assert.equal(c.storage._files.size, 1);
  assert.equal(c.storage._files.get(`cloud://fake/tts/${key}.mp3`).toString(), 'mp3:ሰላም');
  const cached = await c.db.getTtsCache(key);
  assert.equal(cached.fileID, `cloud://fake/tts/${key}.mp3`);
  assert.equal(cached.text, 'ሰላም');
  assert.equal(cached.voice, 'female');
  assert.equal(cached.rate, 'normal');
  assert.equal(cached.chars, 3);
  assert.equal(cached.createdAt, '2026-09-11T10:00:00.000Z');
  assert.equal(c.db._logs.length, 1);
  assert.equal(c.db._logs[0].type, 'tts');
  assert.equal(c.db._logs[0].openid, 'u1');
  assert.equal(c.db._logs[0].request, 'ሰላም');
  assert.deepEqual(c.db._logs[0].result, { chars: 3, key });
});

test('tts.get 第二次同 key 不调 azure，不写日志', async () => {
  const c = ctx();
  const first = await handleSpeech('tts.get', TTS_DATA, c);
  const second = await handleSpeech('tts.get', TTS_DATA, c);
  assert.deepEqual(second, first);
  assert.equal(c.azure.synthCalls.length, 1);
  assert.equal(c.db._logs.length, 1);
  // 男声 / 慢速是不同 key
  await handleSpeech('tts.get', { ...TTS_DATA, voice: 'male' }, c);
  assert.equal(c.azure.synthCalls.length, 2);
  assert.equal(c.azure.synthCalls[1].voiceName, 'am-ET-AmehaNeural');
  await handleSpeech('tts.get', { ...TTS_DATA, rate: 'slow' }, c);
  assert.equal(c.azure.synthCalls.length, 3);
  assert.equal(c.azure.synthCalls[2].rate, 'slow');
});

test('tts.get 参数校验：voice / rate 非法、文本空或超长 → BAD_REQUEST', async () => {
  const c = ctx();
  for (const data of [
    { ...TTS_DATA, voice: 'child' },
    { ...TTS_DATA, rate: 'fast' },
    { ...TTS_DATA, text: '' },
    { ...TTS_DATA, text: '   ' },
    { ...TTS_DATA, text: 123 },
    { ...TTS_DATA, text: 'ሰ'.repeat(301) }
  ]) {
    const res = await handleSpeech('tts.get', data, c);
    assert.equal(res.ok, false, JSON.stringify(data).slice(0, 60));
    assert.equal(res.code, 'BAD_REQUEST');
  }
  assert.equal(c.azure.synthCalls.length, 0);
  // 300 字符刚好允许
  const okRes = await handleSpeech('tts.get', { ...TTS_DATA, text: 'ሰ'.repeat(300) }, c);
  assert.equal(okRes.ok, true);
});

test('azure 抛 NO_API_KEY / TIMEOUT / UPSTREAM → 对应 code，其他错误向上抛', async () => {
  for (const code of ['NO_API_KEY', 'TIMEOUT', 'UPSTREAM']) {
    const c = ctx({ azure: createFakeAzure({ synth: () => { throw errorOf(code, 'boom'); } }) });
    const res = await handleSpeech('tts.get', TTS_DATA, c);
    assert.equal(res.ok, false);
    assert.equal(res.code, code);
    assert.equal(res.error, 'boom');
    assert.equal(c.db._logs.length, 0);
  }
  const c = ctx({ azure: createFakeAzure({ synth: () => { throw new Error('crash'); } }) });
  await assert.rejects(() => handleSpeech('tts.get', TTS_DATA, c), /crash/);
});

test('tts 每日上限：第 301 次未命中 BAD_REQUEST，命中不受限', async () => {
  const c = ctx();
  for (let i = 0; i < TTS_DAILY_LIMIT; i++) {
    const r = await handleSpeech('tts.get', { ...TTS_DATA, text: `ሰላም ${i}` }, c);
    assert.equal(r.ok, true, `第 ${i + 1} 次应成功`);
  }
  const blocked = await handleSpeech('tts.get', { ...TTS_DATA, text: '新句子' }, c);
  assert.equal(blocked.code, 'BAD_REQUEST');
  assert.match(blocked.error, /300/);
  assert.equal(c.azure.synthCalls.length, TTS_DAILY_LIMIT);
  // 已缓存的仍可取
  const hit = await handleSpeech('tts.get', { ...TTS_DATA, text: 'ሰላም 0' }, c);
  assert.equal(hit.ok, true);
  // 其他用户不受影响
  const other = await handleSpeech('tts.get', { ...TTS_DATA, text: '新句子' }, { ...c, openid: 'u2' });
  assert.equal(other.ok, true);
});

test('tts.batch 三条其中一条已缓存 → azure 调两次，urls 三个键', async () => {
  const c = ctx();
  await handleSpeech('tts.get', { text: 'B', voice: 'female', rate: 'normal' }, c);
  assert.equal(c.azure.synthCalls.length, 1);
  const res = await handleSpeech('tts.batch', {
    items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }],
    voice: 'female',
    rate: 'normal'
  }, c);
  assert.equal(res.ok, true);
  assert.equal(c.azure.synthCalls.length, 3);
  assert.deepEqual(Object.keys(res.data.urls).sort(), ['a', 'b', 'c']);
  for (const id of ['a', 'b', 'c']) {
    const key = ttsKey('female', 'normal', id.toUpperCase());
    assert.equal(res.data.urls[id], `https://fake/cloud://fake/tts/${key}.mp3`);
  }
  assert.equal(c.db._logs.length, 3);
});

test('tts.batch 单条失败不影响其他（该 id 省略）；并发最多 5', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const azure = createFakeAzure({
    synth: async (text) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      if (text === 'bad') throw errorOf('UPSTREAM', 'boom');
      return Buffer.from(`mp3:${text}`);
    }
  });
  const c = ctx({ azure });
  const items = [];
  for (let i = 0; i < 12; i++) items.push({ id: `i${i}`, text: i === 4 ? 'bad' : `t${i}` });
  items.push({ id: 'empty', text: '' });
  const res = await handleSpeech('tts.batch', { items, voice: 'male', rate: 'slow' }, c);
  assert.equal(res.ok, true);
  const keys = Object.keys(res.data.urls).sort();
  assert.equal(keys.length, 11);
  assert.ok(!keys.includes('i4'));
  assert.ok(!keys.includes('empty'));
  assert.ok(maxInFlight <= 5, `并发 ${maxInFlight}`);
  assert.ok(maxInFlight >= 2, `应有并发，实际 ${maxInFlight}`);
});

test('tts.batch 校验：超过 40 条、items 非数组、voice 非法 → BAD_REQUEST', async () => {
  const c = ctx();
  const many = Array.from({ length: 41 }, (_, i) => ({ id: String(i), text: 'x' }));
  assert.equal((await handleSpeech('tts.batch', { items: many, voice: 'female', rate: 'normal' }, c)).code, 'BAD_REQUEST');
  assert.equal((await handleSpeech('tts.batch', { items: 'x', voice: 'female', rate: 'normal' }, c)).code, 'BAD_REQUEST');
  assert.equal((await handleSpeech('tts.batch', { items: [{ id: 'a', text: 'x' }], voice: 'x', rate: 'normal' }, c)).code, 'BAD_REQUEST');
  assert.equal(c.azure.synthCalls.length, 0);
  const empty = await handleSpeech('tts.batch', { items: [], voice: 'female', rate: 'normal' }, c);
  assert.deepEqual(empty, { ok: true, data: { urls: {} } });
});

test('stt.score 成功路径：文件被删除、score 100、逐词、日志 stt', async () => {
  const storage = createFakeStorage();
  const fileID = await storage.upload('stt/1.wav', Buffer.from('wav'));
  const azure = createFakeAzure({ recog: () => ({ status: 'Success', text: 'ሰላም ነህ።' }) });
  const c = ctx({ storage, azure });
  const res = await handleSpeech('stt.score', { fileID, target: 'ሰላም ነህ' }, c);
  assert.equal(res.ok, true);
  assert.equal(res.data.transcript, 'ሰላም ነህ።');
  assert.equal(res.data.score, 100);
  assert.deepEqual(res.data.words, [{ w: 'ሰላም', ok: true }, { w: 'ነህ', ok: true }]);
  assert.equal(azure.recogCalls.length, 1);
  assert.equal(azure.recogCalls[0].wavBuffer.toString(), 'wav');
  assert.equal(storage._files.has(fileID), false);
  assert.equal(c.db._logs.length, 1);
  assert.equal(c.db._logs[0].type, 'stt');
  assert.equal(c.db._logs[0].request, 'ሰላም ነህ');
  assert.deepEqual(c.db._logs[0].result, { transcript: 'ሰላም ነህ።', score: 100 });
});

test('stt.score 部分匹配：score 介于 0-100，words 标出错词', async () => {
  const storage = createFakeStorage();
  const fileID = await storage.upload('stt/2.wav', Buffer.from('wav'));
  const azure = createFakeAzure({ recog: () => ({ status: 'Success', text: 'ሰላም' }) });
  const res = await handleSpeech('stt.score', { fileID, target: 'ሰላም ነህ' }, ctx({ storage, azure }));
  assert.ok(res.data.score > 0 && res.data.score < 100);
  assert.deepEqual(res.data.words, [{ w: 'ሰላም', ok: true }, { w: 'ነህ', ok: false }]);
});

test('stt.score NoMatch → ok 但 transcript 空、score 0，文件仍删除，日志仍写', async () => {
  const storage = createFakeStorage();
  const fileID = await storage.upload('stt/3.wav', Buffer.from('wav'));
  const azure = createFakeAzure({ recog: () => ({ status: 'NoMatch', text: '' }) });
  const c = ctx({ storage, azure });
  const res = await handleSpeech('stt.score', { fileID, target: 'ሰላም ነህ' }, c);
  assert.equal(res.ok, true);
  assert.deepEqual(res.data, { transcript: '', score: 0, words: [{ w: 'ሰላም', ok: false }, { w: 'ነህ', ok: false }] });
  assert.equal(storage._files.has(fileID), false);
  assert.equal(c.db._logs.length, 1);
  assert.equal(c.db._logs[0].type, 'stt');
});

test('stt.score azure 失败：文件仍被删除，返回错误码，不写日志', async () => {
  const storage = createFakeStorage();
  const fileID = await storage.upload('stt/4.wav', Buffer.from('wav'));
  const azure = createFakeAzure({ recog: () => { throw errorOf('TIMEOUT', 'slow'); } });
  const c = ctx({ storage, azure });
  const res = await handleSpeech('stt.score', { fileID, target: 'ሰላም' }, c);
  assert.equal(res.ok, false);
  assert.equal(res.code, 'TIMEOUT');
  assert.equal(storage._files.has(fileID), false);
  assert.equal(c.db._logs.length, 0);
});

test('stt.score 校验：缺 fileID / target → BAD_REQUEST', async () => {
  const c = ctx();
  assert.equal((await handleSpeech('stt.score', { target: 'x' }, c)).code, 'BAD_REQUEST');
  assert.equal((await handleSpeech('stt.score', { fileID: 'cloud://x' }, c)).code, 'BAD_REQUEST');
  assert.equal((await handleSpeech('stt.score', { fileID: 'cloud://x', target: '   ' }, c)).code, 'BAD_REQUEST');
  assert.equal(c.azure.recogCalls.length, 0);
});

test('stt 每日上限：第 101 次 BAD_REQUEST；tts 日志不计入', async () => {
  const storage = createFakeStorage();
  const azure = createFakeAzure({ recog: () => ({ status: 'Success', text: 'ሰላም' }) });
  const c = ctx({ storage, azure });
  await handleSpeech('tts.get', TTS_DATA, c); // 一条 tts 日志
  for (let i = 0; i < STT_DAILY_LIMIT; i++) {
    const fileID = await storage.upload(`stt/${i}.wav`, Buffer.from('wav'));
    const r = await handleSpeech('stt.score', { fileID, target: 'ሰላም' }, c);
    assert.equal(r.ok, true, `第 ${i + 1} 次应成功`);
  }
  const fileID = await storage.upload('stt/last.wav', Buffer.from('wav'));
  const blocked = await handleSpeech('stt.score', { fileID, target: 'ሰላም' }, c);
  assert.equal(blocked.code, 'BAD_REQUEST');
  assert.match(blocked.error, /100/);
  assert.equal(azure.recogCalls.length, STT_DAILY_LIMIT);
  // 次日重置（东非时间次日 00:30 = UTC 21:30）
  const nextDay = await handleSpeech('stt.score', { fileID, target: 'ሰላም' }, { ...c, now: () => new Date('2026-09-11T21:30:00Z') });
  assert.equal(nextDay.ok, true);
});

test('未知 tts./stt. action → BAD_REQUEST', async () => {
  const res = await handleSpeech('tts.nope', {}, ctx());
  assert.equal(res.code, 'BAD_REQUEST');
});

test('handler.handle 将 tts./stt. 委托给 handleSpeech', async () => {
  const c = ctx();
  const res = await handle('tts.get', TTS_DATA, c);
  assert.equal(res.ok, true);
  assert.equal(res.data.key, ttsKey('female', 'normal', 'ሰላም'));
  assert.equal(c.azure.synthCalls.length, 1);
  const storage = createFakeStorage();
  const fileID = await storage.upload('stt/h.wav', Buffer.from('wav'));
  const stt = await handle('stt.score', { fileID, target: 'ሰላም' }, ctx({ storage }));
  assert.equal(stt.ok, true);
  assert.equal(stt.data.score, 0);
  const bad = await handle(undefined, {}, c);
  assert.equal(bad.code, 'BAD_REQUEST');
});
