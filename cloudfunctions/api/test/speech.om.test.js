const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('node:crypto');
const { handle } = require('../handler.js');
const { handleSpeech, ttsKey } = require('../speech.js');
const { createOmAudio, omKey, omFileKey } = require('../om-audio.js');
const { createFakeDb } = require('./fakeDb.js');
const { createFakeAzure } = require('./fakeAzure.js');
const { createFakeStorage } = require('./fakeStorage.js');

function tmpDir(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-audio-'));
  const manifest = {};
  entries.forEach(([rate, text]) => {
    const name = `${omFileKey(rate, text)}.mp3`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(`mp3:${rate}:${text}`));
    manifest[`${rate}|${text}`] = name;
  });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return dir;
}

function tmpAudio(entries) {
  return createOmAudio(tmpDir(entries));
}

/** 内容版本：文件字节 sha1 的前 12 位 */
function ver(bytes) {
  return crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 12);
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
  const key = omKey('normal', 'Akkam?', ver(Buffer.from('mp3:normal:Akkam?')));
  assert.equal(res.data.key, key, '缓存键带内容版本');
  assert.equal(res.data.fileID, `cloud://fake/tts/om/${key}.mp3`);
  assert.equal(res.data.lang, 'om', '回包带 lang，客户端据此识别旧云函数');
  assert.equal(c.storage._files.get(res.data.fileID).toString(), 'mp3:normal:Akkam?');
  const cached = await c.db.getTtsCache(key);
  assert.equal(cached.lang, 'om');
  assert.equal(cached.chars, 0, '不计入月度字符');
  assert.equal(c.db._logs.length, 0, '不写 ai_logs');
  const again = await handleSpeech('tts.get', { text: 'Akkam?', rate: 'normal', lang: 'om' }, c);
  assert.equal(again.data.fileID, res.data.fileID);
  assert.equal(c.storage._files.size, 1, '第二次走缓存，不再上传');
});

test('tts.get om：同一条清单项的 mp3 换成真人录音后，缓存键与云存储文件都换新', async () => {
  const dir = tmpDir([['normal', 'Akkam?']]);
  const file = path.join(dir, `${omFileKey('normal', 'Akkam?')}.mp3`);
  const c = ctx({ omAudio: createOmAudio(dir) });
  const before = await handleSpeech('tts.get', { text: 'Akkam?', rate: 'normal', lang: 'om' }, c);
  assert.equal(before.ok, true, JSON.stringify(before));
  // 覆盖同名文件（清单不变），重新部署 = 新进程 = 新实例
  fs.writeFileSync(file, Buffer.from('human-recording'));
  const after = await handleSpeech('tts.get', { text: 'Akkam?', rate: 'normal', lang: 'om' }, { ...c, omAudio: createOmAudio(dir) });
  assert.equal(after.ok, true, JSON.stringify(after));
  assert.notEqual(after.data.key, before.data.key, '内容变了 → 新缓存键');
  assert.notEqual(after.data.fileID, before.data.fileID, '内容变了 → 新云存储路径');
  assert.equal(after.data.key, omKey('normal', 'Akkam?', ver(Buffer.from('human-recording'))));
  assert.equal(c.storage._files.size, 2, '重新上传了一次');
  assert.equal(c.storage._files.get(after.data.fileID).toString(), 'human-recording', '播放的是新录音');
  assert.equal(after.data.lang, 'om');
});

test('om-audio：内容版本按文件路径记忆，同一进程内只读一次', () => {
  const dir = tmpDir([['normal', 'Akkam?']]);
  const a = createOmAudio(dir);
  const first = a.lookup('Akkam?', 'normal');
  assert.equal(first.ver, ver(Buffer.from('mp3:normal:Akkam?')));
  fs.writeFileSync(first.file, Buffer.from('changed'));
  assert.equal(a.lookup('Akkam?', 'normal').ver, first.ver, '同一实例不重复读文件算版本');
  assert.equal(a.lookup('Hin jiru', 'normal'), null, '清单里没有返回 null');
});

test('tts.get om：清单里没有的句子给出明确错误', async () => {
  const res = await handleSpeech('tts.get', { text: 'Hin jiru', rate: 'normal', lang: 'om' }, ctx());
  assert.equal(res.ok, false);
  assert.equal(res.code, 'BAD_REQUEST');
  assert.match(res.error, /还没有生成语音/);
});

test('tts.get：lang 非法返回 BAD_REQUEST', async () => {
  assert.equal((await handleSpeech('tts.get', { text: 'x', rate: 'normal', voice: 'female', lang: 'fr' }, ctx())).code, 'BAD_REQUEST');
});

test('tts.get 不带 lang：已登录用户仍走阿姆哈拉语 Azure 路径，缓存键不变', async () => {
  const c = ctx({
    db: createFakeDb(),
    azure: createFakeAzure(),
    omAudio: tmpAudio([])
  });
  const text = 'ሰላም';
  const res = await handle('tts.get', { text, rate: 'normal', voice: 'female' }, c);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(c.azure.synthCalls.length, 1);
  assert.equal(c.azure.synthCalls[0].voiceName, 'am-ET-MekdesNeural');
  assert.equal(res.data.key, ttsKey('female', 'normal', text));
  assert.equal(res.data.fileID, `cloud://fake/tts/${res.data.key}.mp3`);
  assert.equal(c.db._logs.length, 1, '阿姆哈拉语仍写 ai_logs 计额度');
});

test('tts.batch om：批量返回，缺失的 id 省略', async () => {
  const res = await handleSpeech('tts.batch', { rate: 'normal', lang: 'om', items: [{ id: 'a', text: 'Akkam?' }, { id: 'b', text: 'Galatoomi' }, { id: 'c', text: 'Hin jiru' }] }, ctx());
  assert.equal(res.ok, true);
  assert.deepEqual(Object.keys(res.data.urls).sort(), ['a', 'b']);
  assert.equal(res.data.lang, 'om', '批量回包也带 lang');
});

test('tts.caps 声明支持的语言', async () => {
  const res = await handleSpeech('tts.caps', {}, ctx());
  assert.deepEqual(res, { ok: true, data: { langs: ['am', 'om'] } });
});

test('stt.score 拒绝奥罗莫语：已上传的本人录音当场删除，不识别、不写日志', async () => {
  const c = ctx({ azure: createFakeAzure({ recog: () => { throw new Error('不应调用 Azure 识别'); } }) });
  const fileID = await c.storage.upload('stt/u1/a.wav', Buffer.from('wav'));
  const res = await handleSpeech('stt.score', { fileID, target: 'Akkam', lang: 'om' }, c);
  assert.equal(res.code, 'BAD_REQUEST');
  assert.match(res.error, /暂不支持发音评分/);
  assert.equal(c.storage._files.has(fileID), false, '拒绝前删除录音（隐私承诺）');
  assert.equal(c.db._logs.length, 0);
});

test('stt.score 奥罗莫语 + 别人的文件：先按「录音文件不合法」拒绝，不删除别人的文件', async () => {
  const c = ctx();
  const other = await c.storage.upload('stt/u2/b.wav', Buffer.from('wav'));
  const res = await handleSpeech('stt.score', { fileID: other, target: 'Akkam', lang: 'om' }, c);
  assert.equal(res.code, 'BAD_REQUEST');
  assert.match(res.error, /录音文件不合法/);
  assert.equal(c.storage._files.has(other), true, '不能借 lang 删除别人的文件');
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
  const hit = defaultOmAudio.lookup('Akkam?', 'normal');
  assert.ok(hit && hit.file && /^[0-9a-f]{12}$/.test(hit.ver), 'audio-om 里有 Akkam?，带内容版本');
});

test('登录门槛边界：只有 tts.* 的 om / tts.caps 放行', async () => {
  const c = ctx(); // 未注册用户
  assert.deepEqual(await handle('tts.caps', {}, c), { ok: true, data: { langs: ['am', 'om'] } }, 'tts.caps 免登录');
  const batch = await handle('tts.batch', { rate: 'normal', lang: 'om', items: [{ id: 'a', text: 'Akkam?' }] }, c);
  assert.equal(batch.ok, true, 'tts.batch om 免登录');
  assert.deepEqual(Object.keys(batch.data.urls), ['a']);

  const stt = await handle('stt.score', { lang: 'om', fileID: 'cloud://fake/stt/u1/a.wav', target: 'x' }, c);
  assert.equal(stt.ok, false);
  assert.match(stt.error, /登录/, 'stt 不因 lang 放行');

  const amExplicit = await handle('tts.get', { text: 'ሰላም', rate: 'normal', voice: 'female', lang: 'am' }, c);
  assert.equal(amExplicit.ok, false);
  assert.match(amExplicit.error, /登录/, '显式 lang=am 仍要登录');
  assert.equal(c.azure.synthCalls.length, 0);
});

test('登录门槛边界：user.* / admin.* 带 lang=om 不会被放行，行为与不带时一致', async () => {
  for (const action of ['user.setProfile', 'admin.users', 'admin.setStatus']) {
    const base = { nickname: 'x', openid: 'u2', status: 'blocked' };
    const without = await handle(action, { ...base }, ctx());
    const withOm = await handle(action, { ...base, lang: 'om' }, ctx());
    assert.deepEqual(withOm, without, `${action} 带 lang 结果相同`);
    assert.equal(withOm.ok, false, `${action} 对未注册用户失败`);
    assert.match(withOm.error, action === 'user.setProfile' ? /登录/ : /无权限/);
  }
});
