const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalize, similarity, wordMatches } = require('../scoring.js');

test('normalize 去除埃塞与 ASCII 标点以及所有空白', () => {
  assert.equal(normalize('ሰላም፣ ነው። እንዴት፡ ነህ?'), 'ሰላምነውእንዴትነህ');
  assert.equal(normalize('hello, world! ok.'), 'helloworldok');
  assert.equal(normalize(' a \t b\n c d '), 'abcd');
});

test('normalize 做 NFC 归一并容忍非字符串', () => {
  assert.equal(normalize('é'), 'é');
  assert.equal(normalize(''), '');
  assert.equal(normalize(null), '');
  assert.equal(normalize(undefined), '');
});

test('similarity 忽略标点：ሰላም ነው። 与 ሰላም ነው 为 100', () => {
  assert.equal(similarity('ሰላም ነው።', 'ሰላም ነው'), 100);
});

test('similarity 差异很大的文本低于 40', () => {
  assert.ok(similarity('ሰላም', 'ውሃ') < 40);
});

test('similarity 边界：都空 100，一空一非空 0', () => {
  assert.equal(similarity('', ''), 100);
  assert.equal(similarity('። ', ''), 100);
  assert.equal(similarity('ሰላም', ''), 0);
  assert.equal(similarity('', 'ሰላም'), 0);
});

test('similarity 为 0–100 整数且部分匹配给出中间值', () => {
  const s = similarity('ሰላም ነው', 'ሰላም ነህ');
  assert.ok(Number.isInteger(s));
  assert.ok(s > 0 && s < 100, `got ${s}`);
  assert.equal(similarity('abcd', 'abxd'), 75);
});

test('wordMatches 按目标句分词并逐词判断', () => {
  assert.deepEqual(wordMatches('ሰላም ነው', 'ሰላም'), [
    { w: 'ሰላም', ok: true },
    { w: 'ነው', ok: false }
  ]);
});

test('wordMatches 保留原词形（含标点），比较时归一化', () => {
  assert.deepEqual(wordMatches('ሰላም፣  ነው።', 'ነው ሰላም'), [
    { w: 'ሰላም፣', ok: true },
    { w: 'ነው።', ok: true }
  ]);
  assert.deepEqual(wordMatches('', 'ሰላም'), []);
  assert.deepEqual(wordMatches('ሰላም', ''), [{ w: 'ሰላም', ok: false }]);
});
