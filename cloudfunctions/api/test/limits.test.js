const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getLimits, isAdmin, DEFAULT_LIMITS } = require('../limits.js');

const KEYS = ['AI_DAILY_LIMIT', 'TTS_DAILY_LIMIT', 'STT_DAILY_LIMIT', 'TTS_MONTHLY_CHARS_LIMIT', 'ADMIN_OPENIDS'];

/** 临时设置环境变量执行 fn，结束后恢复（undefined 表示删除）。 */
function withEnv(vars, fn) {
  const saved = {};
  for (const k of KEYS) saved[k] = process.env[k];
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
  try {
    return fn();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('环境变量缺失时使用默认值', () => {
  withEnv({}, () => {
    assert.deepEqual(getLimits(), { ai: 20, tts: 300, stt: 100, ttsMonthlyChars: 400000 });
    assert.deepEqual(DEFAULT_LIMITS, { ai: 20, tts: 300, stt: 100, ttsMonthlyChars: 400000 });
  });
});

test('环境变量为正整数时生效', () => {
  withEnv({ AI_DAILY_LIMIT: '3', TTS_DAILY_LIMIT: '50', STT_DAILY_LIMIT: '7', TTS_MONTHLY_CHARS_LIMIT: '1000' }, () => {
    assert.deepEqual(getLimits(), { ai: 3, tts: 50, stt: 7, ttsMonthlyChars: 1000 });
  });
  // 每次调用重新读取，不缓存
  withEnv({ AI_DAILY_LIMIT: '5' }, () => assert.equal(getLimits().ai, 5));
  withEnv({}, () => assert.equal(getLimits().ai, 20));
});

test('非法值（非数字、0、负数、小数、空串）回退默认', () => {
  for (const bad of ['abc', '0', '-5', '2.5', '', '  ', 'NaN', 'Infinity']) {
    withEnv({ AI_DAILY_LIMIT: bad, TTS_DAILY_LIMIT: bad, STT_DAILY_LIMIT: bad, TTS_MONTHLY_CHARS_LIMIT: bad }, () => {
      assert.deepEqual(getLimits(), { ai: 20, tts: 300, stt: 100, ttsMonthlyChars: 400000 }, JSON.stringify(bad));
    });
  }
});

test('isAdmin：逗号分隔、trim、缺失时全部为 false', () => {
  withEnv({}, () => {
    assert.equal(isAdmin('u1'), false);
    assert.equal(isAdmin(''), false);
    assert.equal(isAdmin(undefined), false);
  });
  withEnv({ ADMIN_OPENIDS: ' u1 , u2,,  ' }, () => {
    assert.equal(isAdmin('u1'), true);
    assert.equal(isAdmin('u2'), true);
    assert.equal(isAdmin('u3'), false);
    assert.equal(isAdmin(''), false);
    assert.equal(isAdmin(undefined), false);
  });
  withEnv({ ADMIN_OPENIDS: '' }, () => assert.equal(isAdmin('u1'), false));
});

test('withEnv 结束后环境变量已恢复', () => {
  const before = process.env.AI_DAILY_LIMIT;
  withEnv({ AI_DAILY_LIMIT: '99' }, () => assert.equal(getLimits().ai, 99));
  assert.equal(process.env.AI_DAILY_LIMIT, before);
});
