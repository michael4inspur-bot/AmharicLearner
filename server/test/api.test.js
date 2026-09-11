import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/index.js';
import { JsonStore } from '../src/store.js';

async function startServer() {
  const file = path.join(os.tmpdir(), `amharic-test-${Date.now()}.json`);
  const app = await createApp(new JsonStore(file));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return { server, base };
}

test('login (dev mode) then sync progress round-trips', async () => {
  const { server, base } = await startServer();
  try {
    const login = await (await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'dev' })
    })).json();
    assert.ok(login.token);
    assert.equal(login.devMode, true);

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` };
    const put = await fetch(`${base}/progress`, { method: 'PUT', headers, body: JSON.stringify({ progress: { streak: 2 } }) });
    assert.equal(put.status, 200);

    const got = await (await fetch(`${base}/progress`, { headers })).json();
    assert.deepEqual(got.progress, { streak: 2 });

    const unauth = await fetch(`${base}/progress`);
    assert.equal(unauth.status, 401);
  } finally {
    server.close();
  }
});

test('AI endpoints return 503 without API key instead of crashing', async () => {
  delete process.env.DEEPSEEK_API_KEY;
  const { server, base } = await startServer();
  try {
    const login = await (await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'dev' })
    })).json();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` };
    const res = await fetch(`${base}/ai/diagnose`, { method: 'POST', headers, body: JSON.stringify({ summary: {} }) });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.match(body.error, /DEEPSEEK_API_KEY/);
  } finally {
    server.close();
  }
});
