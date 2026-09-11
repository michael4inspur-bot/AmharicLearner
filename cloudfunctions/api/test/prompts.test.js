const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDiagnosisUserMessage, buildPlanAdjustUserMessage, diagnosisSystemPrompt, tutorSystemPrompt
} = require('../prompts.js');
const { parseJsonReply, chatCompletion, DeepSeekError } = require('../deepseek.js');

test('诊断 user 消息包含摘要与计划大纲', () => {
  const msg = buildDiagnosisUserMessage({ streak: 3 }, { weeks: [{ week: 1 }] });
  assert.match(msg, /"streak":3/);
  assert.match(msg, /"week":1/);
  assert.match(diagnosisSystemPrompt(), /overall_level/);
});

test('计划调整 user 消息包含学员诉求', () => {
  const msg = buildPlanAdjustUserMessage({}, {}, null, '想先学谈判用语');
  assert.match(msg, /想先学谈判用语/);
});

test('教练 system 提示包含进度摘要', () => {
  assert.match(tutorSystemPrompt({ streak: 9 }), /"streak":9/);
});

test('parseJsonReply 容忍代码块与前后文字', () => {
  assert.deepEqual(parseJsonReply('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonReply('好的：{"b":[1,2]} 完'), { b: [1, 2] });
  assert.throws(() => parseJsonReply('没有 json'), (e) => e instanceof DeepSeekError && e.code === 'UPSTREAM');
});

test('未配置密钥时 chatCompletion 抛 NO_API_KEY', async () => {
  const saved = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    await assert.rejects(chatCompletion([{ role: 'user', content: 'hi' }]), (e) => e.code === 'NO_API_KEY');
  } finally {
    if (saved !== undefined) process.env.DEEPSEEK_API_KEY = saved;
  }
});
