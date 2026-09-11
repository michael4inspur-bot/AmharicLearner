// 上限配置：每次调用时从环境变量读取（不缓存，便于运行时改环境变量与测试）。
const DEFAULT_LIMITS = Object.freeze({
  ai: 20, // 每人每日 diagnosis/plan/chat 次数
  tts: 300, // 每人每日 TTS 缓存未命中次数
  stt: 100, // 每人每日识别次数
  ttsMonthlyChars: 400000 // 全体用户本月 TTS 合成字符合计（Azure 免费层 50 万，留 10 万余量）
});

const ENV_KEYS = {
  ai: 'AI_DAILY_LIMIT',
  tts: 'TTS_DAILY_LIMIT',
  stt: 'STT_DAILY_LIMIT',
  ttsMonthlyChars: 'TTS_MONTHLY_CHARS_LIMIT'
};

/** 环境变量为正整数（十进制）时返回该值，否则返回 fallback。 */
function positiveInt(raw, fallback) {
  if (typeof raw !== 'string') return fallback;
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return fallback;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

/** @returns {{ai: number, tts: number, stt: number, ttsMonthlyChars: number}} */
function getLimits() {
  const out = {};
  for (const [key, envKey] of Object.entries(ENV_KEYS)) out[key] = positiveInt(process.env[envKey], DEFAULT_LIMITS[key]);
  return out;
}

/** ADMIN_OPENIDS（逗号分隔，忽略首尾空白）是否包含 openid */
function isAdmin(openid) {
  if (typeof openid !== 'string' || !openid) return false;
  const raw = process.env.ADMIN_OPENIDS;
  if (typeof raw !== 'string') return false;
  return raw.split(',').map((s) => s.trim()).filter(Boolean).includes(openid);
}

module.exports = { getLimits, isAdmin, DEFAULT_LIMITS };
