// DeepSeek 使用 OpenAI 兼容的 Chat Completions 接口。配置全部来自环境变量。
class DeepSeekError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DeepSeekError';
    this.code = code; // NO_API_KEY | TIMEOUT | UPSTREAM
  }
}

function config() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS || 50000)
  };
}

/**
 * @param {Array<{role:string, content:string}>} messages
 * @param {{json?: boolean, temperature?: number, maxTokens?: number}} [opts]
 * @returns {Promise<string>} 模型回复文本
 */
async function chatCompletion(messages, opts = {}) {
  const { apiKey, baseUrl, model, timeoutMs } = config();
  if (!apiKey) throw new DeepSeekError('未配置 DEEPSEEK_API_KEY', 'NO_API_KEY');

  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2000,
    stream: false
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new DeepSeekError('DeepSeek 响应超时', 'TIMEOUT');
    throw new DeepSeekError(`调用 DeepSeek 失败: ${err.message}`, 'UPSTREAM');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DeepSeekError(`DeepSeek 返回 ${res.status}: ${text.slice(0, 300)}`, 'UPSTREAM');
  }
  const data = await res.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (typeof content !== 'string') throw new DeepSeekError('DeepSeek 返回内容为空', 'UPSTREAM');
  return content;
}

/** 解析模型返回的 JSON；容忍 ```json 代码块包裹和前后文字。 */
function parseJsonReply(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (e2) { /* fallthrough */ }
    }
    throw new DeepSeekError('无法解析 DeepSeek 返回的 JSON', 'UPSTREAM');
  }
}

module.exports = { DeepSeekError, chatCompletion, parseJsonReply };
