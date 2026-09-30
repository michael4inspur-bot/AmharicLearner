const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { handle } = require('../handler.js');
const { handleSpeech } = require('../speech.js');
const { createOmAudio, omKey } = require('../om-audio.js');
const { createFakeDb } = require('./fakeDb.js');
const { createFakeAzure } = require('./fakeAzure.js');
const { createFakeStorage } = require('./fakeStorage.js');

function tmpAudio(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-audio-'));
  const manifest = {};
  entries.forEach(([rate, text]) => {
    const name = `${omKey(rate, text)}.mp3`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(`mp3:${rate}:${text}`));
    manifest[`${rate}|${text}`] = name;
  });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return createOmAudio(dir);
}

function ctx(extra) {
  return {
    openid: 'u1',
    db: createFakeDb({ registered: false }),
    azure: createFakeAzure({ synth: () => { throw new Error('不应调用 Azure'); } }),
    storage: createFakeStorage(),
    omAudio: tmpAudio([['normal', 'Akkam?'], ['slow', 'Akkam?'], ['normal', 'Galatoomi']]),
    now: () => new Date('2026-09-30T10:00:00Z'),
    ...extra
  };
}

test('tts.get om：从代码包取文件、上传一次、写缓存，不调 Azure、不写日志', async () => {
  const c = ctx();
  const res = await handleSpeech('tts.get', { text: 'Akkam?', rate: 'normal', lang: 'om' }, c);
  assert.equal(res.ok, true, JSON.stringify(res));
  const key = omKey('normal', 'Akkam?');
  assert.equal(res.data.key, key);
  assert.equal(res.data.fileID, `cloud://fake/tts/om/${key}.mp3`);
  assert.equal(c.storage._files.get(res.data.fileID).toString(), 'mp3:normal:Akkam?');
  const cached = await c.db.getTtsCache(key);
  assert.equal(cached.lang, 'om');
  assert.equal(cached.chars, 0, '不计入月度字符');
  assert.equal(c.db._logs.length, 0, '不写 ai_logs');
  const again = await handleSpeech('tts.get', { text: 'Akkam?', rate: 'normal', lang: 'om' }, c);
  assert.equal(again.data.fileID, res.data.fileID);
  assert.equal(c.storage._files.size, 1, '第二次走缓存，不再上传');
});

test('tts.get om：清单里没有的句子给出明确错误', async () => {
  const res = await handleSpeech('tts.get', { text: 'Hin jiru', rate: 'normal', lang: 'om' }, ctx());
  assert.equal(res.ok, false);
  assert.equal(res.code, 'BAD_REQUEST');
  assert.match(res.error, /还没有生成语音/);
});

test('tts.get：lang 非法返回 BAD_REQUEST，am 缺省行为不变', async () => {
  assert.equal((await handleSpeech('tts.get', { text: 'x', rate: 'normal', voice: 'female', lang: 'fr' }, ctx())).code, 'BAD_REQUEST');
});

test('tts.batch om：批量返回，缺失的 id 省略', async () => {
  const res = await handleSpeech('tts.batch', { rate: 'normal', lang: 'om', items: [{ id: 'a', text: 'Akkam?' }, { id: 'b', text: 'Galatoomi' }, { id: 'c', text: 'Hin jiru' }] }, ctx());
  assert.equal(res.ok, true);
  assert.deepEqual(Object.keys(res.data.urls).sort(), ['a', 'b']);
});

test('tts.caps 声明支持的语言', async () => {
  const res = await handleSpeech('tts.caps', {}, ctx());
  assert.deepEqual(res, { ok: true, data: { langs: ['am', 'om'] } });
});

test('stt.score 拒绝奥罗莫语', async () => {
  const res = await handleSpeech('stt.score', { fileID: 'cloud://fake/stt/u1/a.wav', target: 'Akkam', lang: 'om' }, ctx());
  assert.equal(res.code, 'BAD_REQUEST');
  assert.match(res.error, /暂不支持发音评分/);
});

test('奥罗莫语语音不要求登录，停用账号也可用；阿姆哈拉语仍要登录', async () => {
  const c = ctx();
  const om = await handle('tts.get', { text: 'Akkam?', rate: 'slow', lang: 'om' }, c);
  assert.equal(om.ok, true, '未登录可用');
  await c.db.putUser('u1', { _id: 'u1', status: 'blocked' });
  assert.equal((await handle('tts.get', { text: 'Akkam?', rate: 'normal', lang: 'om' }, c)).ok, true, '停用账号可用');
  const am = await handle('tts.get', { text: 'ሰላም', rate: 'normal', voice: 'female' }, ctx());
  assert.equal(am.ok, false);
  assert.match(am.error, /登录/);
});

test('默认音频包：真实 manifest 可读且含首页问候语', () => {
  const { defaultOmAudio } = require('../om-audio.js');
  assert.ok(defaultOmAudio.lookup('Akkam?', 'normal'), 'audio-om 里有 Akkam?');
});
