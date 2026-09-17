const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { synthesize, recognize, buildSsml } = require('../azure.js');
const { createFakeAzure } = require('./fakeAzure.js');
const { createFakeStorage } = require('./fakeStorage.js');

const savedEnv = {};
const savedFetch = globalThis.fetch;

beforeEach(() => {
  for (const k of ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION']) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of Object.keys(savedEnv)) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = savedFetch;
});

function withEnv() {
  process.env.AZURE_SPEECH_KEY = 'k';
  process.env.AZURE_SPEECH_REGION = 'southeastasia';
}

test('缺环境变量时 synthesize reject 且 code 为 NO_API_KEY', async () => {
  await assert.rejects(synthesize('ሰላም', 'am-ET-MekdesNeural', 'normal'), (err) => {
    assert.equal(err.code, 'NO_API_KEY');
    assert.equal(err.message, '未配置 AZURE_SPEECH_KEY');
    return true;
  });
});

test('缺环境变量时 recognize reject 且 code 为 NO_API_KEY', async () => {
  await assert.rejects(recognize(Buffer.alloc(0)), (err) => {
    assert.equal(err.code, 'NO_API_KEY');
    return true;
  });
});

test('buildSsml 慢速包含 prosody，正常速不包含', () => {
  const slow = buildSsml('ሰላም', 'am-ET-MekdesNeural', 'slow');
  assert.ok(slow.includes('<prosody rate="-25%">ሰላም</prosody>'));
  assert.ok(slow.includes('<voice name="am-ET-MekdesNeural">'));
  assert.ok(slow.includes('xml:lang="am-ET"'));
  const normal = buildSsml('ሰላም', 'am-ET-MekdesNeural', 'normal');
  assert.ok(!normal.includes('<prosody'));
  assert.ok(normal.includes('>ሰላም</voice>'));
});

test('buildSsml 对 XML 特殊字符转义', () => {
  const ssml = buildSsml(`a & b < c > "d" 'e'`, 'am-ET-AmehaNeural', 'normal');
  assert.ok(ssml.includes('a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;'));
  assert.ok(!ssml.includes('a & b'));
});

test('buildSsml 拒绝非法 rate', () => {
  assert.throws(() => buildSsml('x', 'v', 'fast'), (err) => err.code === 'BAD_REQUEST');
});

test('synthesize 按计划的 URL 与请求头调用并返回 Buffer', async () => {
  withEnv();
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, init };
    return { status: 200, ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const buf = await synthesize('ሰላም', 'am-ET-MekdesNeural', 'slow');
  assert.ok(Buffer.isBuffer(buf));
  assert.deepEqual([...buf], [1, 2, 3]);
  assert.equal(seen.url, 'https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['Ocp-Apim-Subscription-Key'], 'k');
  assert.equal(seen.init.headers['Content-Type'], 'application/ssml+xml');
  assert.equal(seen.init.headers['X-Microsoft-OutputFormat'], 'audio-24khz-48kbitrate-mono-mp3');
  assert.equal(seen.init.headers['User-Agent'], 'Amharic-Learner');
  assert.ok(seen.init.body.includes('<prosody rate="-25%">'));
});

test('synthesize 非 200 抛 UPSTREAM', async () => {
  withEnv();
  globalThis.fetch = async () => ({ status: 401, ok: false, text: async () => 'bad key' });
  await assert.rejects(synthesize('x', 'v', 'normal'), (err) => {
    assert.equal(err.code, 'UPSTREAM');
    assert.match(err.message, /401/);
    return true;
  });
});

test('synthesize 超时抛 TIMEOUT', async () => {
  withEnv();
  globalThis.fetch = async (url, init) => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  };
  await assert.rejects(synthesize('x', 'v', 'normal'), (err) => err.code === 'TIMEOUT');
});

test('recognize 按计划的 URL 与请求头调用并解析 JSON', async () => {
  withEnv();
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, init };
    return { status: 200, ok: true, json: async () => ({ RecognitionStatus: 'Success', DisplayText: 'ሰላም ነው' }) };
  };
  const wav = Buffer.from('RIFF');
  const r = await recognize(wav);
  assert.deepEqual(r, { status: 'Success', text: 'ሰላም ነው' });
  assert.equal(
    seen.url,
    'https://southeastasia.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=am-ET&format=simple'
  );
  assert.equal(seen.init.headers['Content-Type'], 'audio/wav; codecs=audio/pcm; samplerate=16000');
  assert.equal(seen.init.headers.Accept, 'application/json');
  assert.equal(seen.init.headers['Ocp-Apim-Subscription-Key'], 'k');
  assert.equal(seen.init.body, wav);
});

test('recognize 无 DisplayText 时 text 为空串', async () => {
  withEnv();
  globalThis.fetch = async () => ({ status: 200, ok: true, json: async () => ({ RecognitionStatus: 'NoMatch' }) });
  assert.deepEqual(await recognize(Buffer.alloc(0)), { status: 'NoMatch', text: '' });
});

test('fakeAzure 记录调用并支持脚本与默认值', async () => {
  const fake = createFakeAzure();
  const buf = await fake.synthesize('ሰላም', 'v', 'normal');
  assert.equal(buf.toString(), 'mp3:ሰላም');
  assert.deepEqual(fake.synthCalls, [{ text: 'ሰላም', voiceName: 'v', rate: 'normal' }]);
  assert.deepEqual(await fake.recognize(Buffer.alloc(1)), { status: 'Success', text: '' });
  assert.equal(fake.recogCalls.length, 1);

  const scripted = createFakeAzure({
    synth: () => { throw new Error('boom'); },
    recog: () => ({ status: 'Success', text: 'x' })
  });
  await assert.rejects(scripted.synthesize('a', 'v', 'slow'), /boom/);
  assert.deepEqual(await scripted.recognize(Buffer.alloc(0)), { status: 'Success', text: 'x' });
});

test('fakeStorage 上传 / 临时链接 / 下载 / 删除', async () => {
  const s = createFakeStorage();
  const id = await s.upload('tts/abc.mp3', Buffer.from('mp3'));
  assert.equal(id, 'cloud://fake/tts/abc.mp3');
  assert.deepEqual(await s.tempUrls([id]), { [id]: `https://fake/${id}` });
  assert.equal((await s.download(id)).toString(), 'mp3');
  assert.ok(s._files.has(id));
  await s.remove([id]);
  assert.ok(!s._files.has(id));
  await assert.rejects(s.download(id), /文件不存在/);
});
