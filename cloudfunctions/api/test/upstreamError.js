// 测试辅助：构造带 code 的上游错误，用来验证 handler 的错误映射。
const { UpstreamError } = require('../upstream-error.js');

function errorOf(code, message) {
  return new UpstreamError(message || code, code);
}

module.exports = { errorOf };
