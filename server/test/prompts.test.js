import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDiagnosisUserMessage, buildPlanAdjustUserMessage, diagnosisSystemPrompt } from '../src/prompts.js';
import { parseJsonReply } from '../src/deepseek.js';

test('diagnosis prompt embeds summary and plan outline', () => {
  const msg = buildDiagnosisUserMessage({ streak: 3 }, { weeks: [{ week: 1 }] });
  assert.match(msg, /"streak":3/);
  assert.match(msg, /"week":1/);
  assert.match(diagnosisSystemPrompt(), /overall_level/);
});

test('plan adjust prompt includes user request when provided', () => {
  const msg = buildPlanAdjustUserMessage({}, {}, null, '想先学谈判用语');
  assert.match(msg, /想先学谈判用语/);
});

test('parseJsonReply tolerates code fences and surrounding text', () => {
  assert.deepEqual(parseJsonReply('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonReply('好的，结果如下：{"b":[1,2]} 完'), { b: [1, 2] });
});
