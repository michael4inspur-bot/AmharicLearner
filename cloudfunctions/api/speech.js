// 语音动作（tts.* / stt.*）纯逻辑。不直接依赖 wx-server-sdk，外部依赖通过 ctx 注入。
// ctx = { openid, db, azure, storage, now? }
const crypto = require('node:crypto');
const { similarity, wordMatches } = require('./scoring.js');
const { getLimits, DEFAULT_LIMITS } = require('./limits.js');
const { dayStartIso, monthStartIso } = require('./time.js');

const TTS_DAILY_LIMIT = DEFAULT_LIMITS.tts; // 默认值常量；实际上限每次调用 getLimits() 读取
const STT_DAILY_LIMIT = DEFAULT_LIMITS.stt;
const VOICES = { female: 'am-ET-MekdesNeural', male: 'am-ET-AmehaNeural' };
const RATES = ['normal', 'slow'];
const MAX_TEXT_CHARS = 300;
const MAX_BATCH_ITEMS = 40;
const BATCH_CONCURRENCY = 5;
const UPSTREAM_CODES = ['NO_API_KEY', 'TIMEOUT', 'UPSTREAM'];

function ok(data) { return { ok: true, data }; }
function fail(code, error) { return { ok: false, code, error }; }

/** 缓存键：sha1(`${voice}|${rate}|${text}`) 十六进制 */
function ttsKey(voice, rate, text) {
  return crypto.createHash('sha1').update(`${voice}|${rate}|${text}`).digest('hex');
}

/** Azure 适配器错误 → fail；其他异常向上抛。 */
function mapError(err) {
  if (err && UPSTREAM_CODES.includes(err.code)) return fail(err.code, err.message);
  throw err;
}

function validVoice(voice) { return Object.prototype.hasOwnProperty.call(VOICES, voice); }
function validRate(rate) { return RATES.includes(rate); }

/** 校验并规整文本；返回字符串或 null（非法） */
function cleanText(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t || t.length > MAX_TEXT_CHARS) return null;
  return t;
}

/**
 * 取一条文本的音频 url：缓存命中直接取临时链接；未命中检查每日次数与本月全体字符上限 → 合成 → 上传 → 缓存 → 日志。
 * 抛出的错误由调用方映射。
 * @returns {Promise<{url: string, key: string} | {limited: 'day' | 'month', limit: number}>}
 */
async function ensureTts(ctx, now, text, voice, rate) {
  const { openid, db, azure, storage } = ctx;
  const key = ttsKey(voice, rate, text);
  let cached = await db.getTtsCache(key);
  if (!cached) {
    const limits = getLimits();
    const used = await db.countAiSince(openid, dayStartIso(now), ['tts']);
    if (used >= limits.tts) return { limited: 'day', limit: limits.tts };
    const monthChars = await db.sumTtsCharsSince(monthStartIso(now));
    if (monthChars + text.length > limits.ttsMonthlyChars) return { limited: 'month', limit: limits.ttsMonthlyChars };
    const audio = await azure.synthesize(text, VOICES[voice], rate);
    const fileID = await storage.upload(`tts/${key}.mp3`, audio);
    cached = { _id: key, fileID, text, voice, rate, chars: text.length, createdAt: now.toISOString() };
    await db.putTtsCache(cached);
    await db.addAiLog({
      openid,
      type: 'tts',
      date: now.toISOString(),
      request: text.slice(0, 100),
      result: { chars: text.length, key }
    });
  }
  const urls = await storage.tempUrls([cached.fileID]);
  const url = urls[cached.fileID];
  if (!url) {
    const err = new Error('获取音频临时链接失败');
    err.code = 'UPSTREAM';
    throw err;
  }
  return { url, key };
}

/** 简单 worker 池：并发最多 limit 个执行 fn(item)。 */
async function runPool(items, limit, fn) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
  await Promise.all(workers);
}

async function ttsGet(data, ctx, now) {
  const { voice, rate } = data;
  if (!validVoice(voice)) return fail('BAD_REQUEST', `voice 非法: ${voice}`);
  if (!validRate(rate)) return fail('BAD_REQUEST', `rate 非法: ${rate}`);
  const text = cleanText(data.text);
  if (!text) return fail('BAD_REQUEST', `text 必须是 1–${MAX_TEXT_CHARS} 字符的非空字符串`);
  let r;
  try {
    r = await ensureTts(ctx, now, text, voice, rate);
  } catch (err) {
    return mapError(err);
  }
  if (r.limited === 'month') return fail('BAD_REQUEST', '本月语音额度已用完，下月恢复');
  if (r.limited) return fail('BAD_REQUEST', `今天的语音合成次数已用完（${r.limit} 次），明天再来`);
  return ok({ url: r.url, key: r.key });
}

async function ttsBatch(data, ctx, now) {
  const { voice, rate, items } = data;
  if (!validVoice(voice)) return fail('BAD_REQUEST', `voice 非法: ${voice}`);
  if (!validRate(rate)) return fail('BAD_REQUEST', `rate 非法: ${rate}`);
  if (!Array.isArray(items)) return fail('BAD_REQUEST', 'items 必须是数组');
  if (items.length > MAX_BATCH_ITEMS) return fail('BAD_REQUEST', `items 最多 ${MAX_BATCH_ITEMS} 条`);
  const urls = {};
  const valid = items
    .filter((it) => it && (typeof it.id === 'string' || typeof it.id === 'number'))
    .map((it) => ({ id: String(it.id), text: cleanText(it.text) }))
    .filter((it) => it.text);
  await runPool(valid, BATCH_CONCURRENCY, async (it) => {
    try {
      const r = await ensureTts(ctx, now, it.text, voice, rate);
      if (!r.limited) urls[it.id] = r.url;
    } catch (err) {
      // 单条失败不影响其他：Azure/存储类错误静默省略该 id，其他异常向上抛
      if (!(err && UPSTREAM_CODES.includes(err.code))) throw err;
    }
  });
  return ok({ urls });
}

async function sttScore(data, ctx, now) {
  const { openid, db, azure, storage } = ctx;
  const { fileID } = data;
  if (typeof fileID !== 'string' || !fileID) return fail('BAD_REQUEST', '缺少 fileID');
  const target = typeof data.target === 'string' ? data.target.trim() : '';
  if (!target) return fail('BAD_REQUEST', '缺少 target');
  const sttLimit = getLimits().stt;
  const used = await db.countAiSince(openid, dayStartIso(now), ['stt']);
  if (used >= sttLimit) return fail('BAD_REQUEST', `今天的跟读评分次数已用完（${sttLimit} 次），明天再来`);
  let recog;
  try {
    const wav = await storage.download(fileID);
    recog = await azure.recognize(wav);
  } catch (err) {
    await storage.remove([fileID]).catch(() => {});
    return mapError(err);
  }
  await storage.remove([fileID]).catch(() => {});
  let result;
  if (recog && recog.status === 'Success') {
    const transcript = recog.text || '';
    result = { transcript, score: similarity(target, transcript), words: wordMatches(target, transcript) };
  } else {
    result = { transcript: '', score: 0, words: wordMatches(target, '') };
  }
  await db.addAiLog({
    openid,
    type: 'stt',
    date: now.toISOString(),
    request: target.slice(0, 500),
    result: { transcript: result.transcript.slice(0, 500), score: result.score }
  });
  return ok(result);
}

async function handleSpeech(action, data, ctx) {
  const now = ctx.now ? ctx.now() : new Date();
  data = data || {};
  switch (action) {
    case 'tts.get': return ttsGet(data, ctx, now);
    case 'tts.batch': return ttsBatch(data, ctx, now);
    case 'stt.score': return sttScore(data, ctx, now);
    default: return fail('BAD_REQUEST', `未知 action: ${action}`);
  }
}

module.exports = { handleSpeech, TTS_DAILY_LIMIT, STT_DAILY_LIMIT, VOICES, ttsKey, monthStartIso };
