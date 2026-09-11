// 假 DeepSeek：按脚本返回文本或抛错，记录收到的 messages。
const { parseJsonReply, DeepSeekError } = require('../deepseek.js');

function createFakeDeepseek(script) {
  // script: (messages, opts) => string | throws
  const calls = [];
  return {
    calls,
    DeepSeekError,
    parseJsonReply,
    async chatCompletion(messages, opts) {
      calls.push({ messages, opts });
      return script(messages, opts);
    }
  };
}

function errorOf(code, message) {
  return new DeepSeekError(message || code, code);
}

module.exports = { createFakeDeepseek, errorOf };
