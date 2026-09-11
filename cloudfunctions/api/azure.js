// Azure Speech REST 适配器（TTS / STT）。配置全部来自环境变量，错误类复用 deepseek.js 的 DeepSeekError。
const { DeepSeekError } = require('./deepseek.js');

const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const TIMEOUT_MS = 20000;

function config() {
  const apiKey = process.env.AZURE_SPEECH_KEY || '';
  const region = process.env.AZURE_SPEECH_REGION || '';
  if (!apiKey || !region) throw new DeepSeekError('未配置 AZURE_SPEECH_KEY', 'NO_API_KEY');
  return { apiKey, region };
}

function xmlEscape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 生成 SSML；rate 只接受 'normal' | 'slow'。 */
function buildSsml(text, voiceName, rate) {
  if (rate !== 'normal' && rate !== 'slow') throw new DeepSeekError(`rate 非法: ${rate}`, 'BAD_REQUEST');
  const slow = rate === 'slow';
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="am-ET">` +
    `<voice name="${xmlEscape(voiceName)}">` +
    `${slow ? '<prosody rate="-25%">' : ''}${xmlEscape(text)}${slow ? '</prosody>' : ''}` +
    `</voice></speak>`;
}

async function post(url, headers, body, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new DeepSeekError(`Azure ${label} 响应超时`, 'TIMEOUT');
    throw new DeepSeekError(`调用 Azure ${label} 失败: ${err.message}`, 'UPSTREAM');
  } finally {
    clearTimeout(timer);
  }
  if (res.status !== 200) {
    const text = await res.text().catch(() => '');
    throw new DeepSeekError(`Azure ${label} 返回 ${res.status}: ${text.slice(0, 300)}`, 'UPSTREAM');
  }
  return res;
}

/**
 * @param {string} text
 * @param {string} voiceName 如 am-ET-MekdesNeural
 * @param {'normal'|'slow'} rate
 * @returns {Promise<Buffer>} mp3 音频
 */
async function synthesize(text, voiceName, rate) {
  const { apiKey, region } = config();
  const ssml = buildSsml(text, voiceName, rate);
  const res = await post(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
      'User-Agent': 'AmharicLeander'
    },
    ssml,
    'TTS'
  );
  return Buffer.from(await res.arrayBuffer());
}

/**
 * @param {Buffer} wavBuffer 16kHz 单声道 PCM wav
 * @returns {Promise<{status: string, text: string}>}
 */
async function recognize(wavBuffer) {
  const { apiKey, region } = config();
  const res = await post(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=am-ET&format=simple`,
    {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      Accept: 'application/json'
    },
    wavBuffer,
    'STT'
  );
  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new DeepSeekError('Azure STT 返回内容无法解析', 'UPSTREAM');
  }
  return { status: json.RecognitionStatus, text: json.DisplayText || '' };
}

module.exports = { synthesize, recognize, buildSsml, xmlEscape };
