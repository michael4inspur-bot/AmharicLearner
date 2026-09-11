// DeepSeek 使用 OpenAI 兼容的 Chat Completions 接口。
import { config } from './config.js';

export class DeepSeekError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'DeepSeekError';
    this.status = status;
  }
}

/**
 * @param {Array<{role:string, content:string}>} messages
 * @param {{json?: boolean, temperature?: number, maxTokens?: number}} [opts]
 * @returns {Promise<string>} 模型回复文本
 */
export async function chatCompletion(messages, opts = {}) {
  const { apiKey, baseUrl, model, timeoutMs } = config.deepseek;
  if (!apiKey) {
    throw new DeepSeekError('未配置 DEEPSEEK_API_KEY，请在 server/.env 中设置', 503);
  }

  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
    stream: false
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    throw new DeepSeekError(`调用 DeepSeek 失败: ${err.name === 'AbortError' ? '超时' : err.message}`, 502);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DeepSeekError(`DeepSeek 返回 ${res.status}: ${text.slice(0, 300)}`, 502);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new DeepSeekError('DeepSeek 返回内容为空', 502);
  }
  return content;
}

/** 解析模型返回的 JSON；容忍 ```json 代码块包裹。 */
export function parseJsonReply(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new DeepSeekError('无法解析 DeepSeek 返回的 JSON', 502);
  }
}
