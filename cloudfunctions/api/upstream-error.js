// 上游调用的统一错误类型。code 取 NO_API_KEY / TIMEOUT / UPSTREAM，handler 按 code 映射成用户可读文案。
class UpstreamError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'UpstreamError';
    this.code = code || 'UPSTREAM';
  }
}

module.exports = { UpstreamError };
