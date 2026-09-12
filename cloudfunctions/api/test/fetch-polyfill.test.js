const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { httpFetch, installFetch } = require('../fetch-polyfill.js');

/** 起一个本地 http 服务，handler 收到 (req, body, res) */
function serve(handler) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => handler(req, Buffer.concat(chunks), res));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

test('POST 成功：ok / status / text / json', async () => {
  const { server, base } = await serve((req, body, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ got: body.toString(), method: req.method }));
  });
  try {
    const r = await httpFetch(`${base}/x`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' });
    assert.equal(r.ok, true);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.got, '{"a":1}');
    assert.equal(j.method, 'POST');
  } finally { server.close(); }
});

test('非 2xx：ok 为 false，仍能读到 body', async () => {
  const { server, base } = await serve((req, body, res) => {
    res.writeHead(401);
    res.end('bad key');
  });
  try {
    const r = await httpFetch(`${base}/x`, { method: 'POST', body: 'x' });
    assert.equal(r.ok, false);
    assert.equal(r.status, 401);
    assert.equal(await r.text(), 'bad key');
  } finally { server.close(); }
});

test('arrayBuffer 拿到完整二进制', async () => {
  const payload = Buffer.from([0, 1, 2, 253, 254, 255]);
  const { server, base } = await serve((req, body, res) => {
    res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
    res.end(payload);
  });
  try {
    const r = await httpFetch(`${base}/tts`, { method: 'POST', body: '<speak/>' });
    const buf = Buffer.from(await r.arrayBuffer());
    assert.deepEqual(buf, payload);
  } finally { server.close(); }
});

test('请求头与 Buffer body 原样送达，并带上 Content-Length', async () => {
  let seen = null; let seenBody = null;
  const { server, base } = await serve((req, body, res) => {
    seen = req.headers; seenBody = body;
    res.writeHead(200); res.end('ok');
  });
  try {
    const wav = Buffer.from([1, 2, 3, 4]);
    await httpFetch(`${base}/stt`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': 'k1' }, body: wav });
    assert.equal(seen['ocp-apim-subscription-key'], 'k1');
    assert.equal(seen['content-length'], '4');
    assert.deepEqual(seenBody, wav);
  } finally { server.close(); }
});

test('AbortController 中止时 reject 且 name 为 AbortError', async () => {
  const { server, base } = await serve(() => { /* 永不响应 */ });
  try {
    const c = new AbortController();
    setTimeout(() => c.abort(), 30);
    await assert.rejects(
      httpFetch(`${base}/slow`, { method: 'POST', body: 'x', signal: c.signal }),
      (e) => e.name === 'AbortError'
    );
  } finally { server.close(); }
});

test('installFetch 不覆盖已存在的 fetch', () => {
  const original = globalThis.fetch;
  const stub = () => {};
  globalThis.fetch = stub;
  try {
    installFetch();
    assert.equal(globalThis.fetch, stub);
  } finally { globalThis.fetch = original; }
});

test('installFetch 在缺失时装上实现', () => {
  const original = globalThis.fetch;
  delete globalThis.fetch;
  try {
    installFetch();
    assert.equal(typeof globalThis.fetch, 'function');
    assert.equal(globalThis.fetch, httpFetch);
  } finally { globalThis.fetch = original; }
});
