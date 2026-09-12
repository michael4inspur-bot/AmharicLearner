// 微信云函数的运行环境可能是 Node 16，没有全局 fetch（Node 18 才内置）。
// 这里用内置 http/https 模块补一个最小实现，只覆盖本项目用到的部分：
// POST、字符串或 Buffer 的 body、自定义请求头、AbortController 信号，
// 以及响应上的 ok / status / text() / json() / arrayBuffer()。
const http = require('node:http');
const https = require('node:https');

function abortError() {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * fetch 的最小替代实现。
 * @param {string} url
 * @param {{method?: string, headers?: object, body?: string|Buffer, signal?: AbortSignal}} [options]
 */
function httpFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'http:' ? http : https;
    const body = options.body == null ? null : (Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body)));
    const headers = { ...(options.headers || {}) };
    if (body && headers['Content-Length'] == null && headers['content-length'] == null) {
      headers['Content-Length'] = String(body.length);
    }

    const signal = options.signal;
    if (signal && signal.aborted) { reject(abortError()); return; }

    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'http:' ? 80 : 443),
        path: `${target.pathname}${target.search}`,
        method: options.method || 'GET',
        headers
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('error', reject);
        res.on('end', () => {
          if (signal) signal.removeEventListener('abort', onAbort);
          const buf = Buffer.concat(chunks);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            async text() { return buf.toString('utf8'); },
            async json() { return JSON.parse(buf.toString('utf8')); },
            async arrayBuffer() { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); }
          });
        });
      }
    );

    function onAbort() {
      req.destroy();
      reject(abortError());
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    req.on('error', (err) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      // destroy() 触发的 error 已经在 onAbort 里 reject 过，这里忽略
      if (signal && signal.aborted) return;
      reject(err);
    });

    if (body) req.write(body);
    req.end();
  });
}

/** 只在运行环境缺少全局 fetch 时装上，Node 18+ 保持原生实现。 */
function installFetch() {
  if (typeof globalThis.fetch !== 'function') globalThis.fetch = httpFetch;
}

module.exports = { httpFetch, installFetch };
