// 云函数纯逻辑。不直接依赖 wx-server-sdk，所有外部依赖通过 ctx 注入。
// ctx = { openid, db, deepseek, azure, storage, now? }
const prompts = require('./prompts.js');
const { handleSpeech } = require('./speech.js');

const DAILY_AI_LIMIT = 20;
const AI_LIMIT_TYPES = ['diagnosis', 'plan', 'chat']; // 每日 AI 上限只统计这三类，tts/stt 另计
const HISTORY_LIMIT = 30;
const CHAT_LOG_TTL_DAYS = 7;
const EAT_OFFSET_HOURS = 3; // 东非时间 UTC+3
const MAX_CHAT_MESSAGES = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

function ok(data) { return { ok: true, data }; }
function fail(code, error) { return { ok: false, code, error }; }

/** 东非时间当天 00:00 对应的 ISO 时刻 */
function dayStartIso(now) {
  const shifted = new Date(now.getTime() + EAT_OFFSET_HOURS * 3600 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - EAT_OFFSET_HOURS * 3600 * 1000).toISOString();
}

async function withAi(ctx, now, type, request, run) {
  const { openid, db, deepseek } = ctx;
  const used = await db.countAiSince(openid, dayStartIso(now), AI_LIMIT_TYPES);
  if (used >= DAILY_AI_LIMIT) {
    return fail('BAD_REQUEST', `今天的 AI 次数已用完（${DAILY_AI_LIMIT} 次），明天再来`);
  }
  let result;
  try {
    result = await run();
  } catch (err) {
    if (err && ['NO_API_KEY', 'TIMEOUT', 'UPSTREAM'].includes(err.code)) return fail(err.code, err.message);
    throw err;
  }
  await db.addAiLog({
    openid,
    type,
    date: now.toISOString(),
    request: String(request || '').slice(0, 500),
    result: type === 'chat' ? { reply: String(result.reply).slice(0, 500) } : result
  });
  await db.pruneAiLogs(openid, {
    keep: HISTORY_LIMIT,
    chatBefore: new Date(now.getTime() - CHAT_LOG_TTL_DAYS * DAY_MS).toISOString()
  });
  void deepseek;
  return ok(result);
}

async function handle(action, data, ctx) {
  const { openid, db, deepseek } = ctx;
  const now = ctx.now ? ctx.now() : new Date();
  data = data || {};

  if (typeof action !== 'string') return fail('BAD_REQUEST', `未知 action: ${action}`);
  if (action.startsWith('tts.') || action.startsWith('stt.')) return handleSpeech(action, data, ctx);

  switch (action) {
    case 'progress.get': {
      const doc = await db.getProgress(openid);
      return ok(doc ? { progress: doc.progress, updatedAt: doc.updatedAt } : { progress: null, updatedAt: null });
    }
    case 'progress.put': {
      if (!data.progress || typeof data.progress !== 'object') return fail('BAD_REQUEST', 'progress 必须是对象');
      const updatedAt = now.toISOString();
      await db.putProgress(openid, { progress: data.progress, updatedAt });
      return ok({ updatedAt });
    }
    case 'ai.diagnose': {
      if (!data.summary) return fail('BAD_REQUEST', '缺少 summary');
      return withAi(ctx, now, 'diagnosis', '', async () => {
        const text = await deepseek.chatCompletion(
          [
            { role: 'system', content: prompts.diagnosisSystemPrompt() },
            { role: 'user', content: prompts.buildDiagnosisUserMessage(data.summary, data.planOutline) }
          ],
          { json: true, temperature: 0.4, maxTokens: 2000 }
        );
        return deepseek.parseJsonReply(text);
      });
    }
    case 'ai.adjustPlan': {
      if (!data.summary) return fail('BAD_REQUEST', '缺少 summary');
      return withAi(ctx, now, 'plan', data.request, async () => {
        const text = await deepseek.chatCompletion(
          [
            { role: 'system', content: prompts.planAdjustSystemPrompt() },
            { role: 'user', content: prompts.buildPlanAdjustUserMessage(data.summary, data.planOutline, data.diagnosis, data.request) }
          ],
          { json: true, temperature: 0.5, maxTokens: 2000 }
        );
        return deepseek.parseJsonReply(text);
      });
    }
    case 'ai.chat': {
      if (!Array.isArray(data.messages) || data.messages.length === 0) return fail('BAD_REQUEST', 'messages 必须是非空数组');
      const history = data.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_CHAT_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
      if (history.length === 0) return fail('BAD_REQUEST', 'messages 中没有有效消息');
      const lastUser = [...history].reverse().find((m) => m.role === 'user');
      return withAi(ctx, now, 'chat', lastUser ? lastUser.content : '', async () => {
        const reply = await deepseek.chatCompletion(
          [{ role: 'system', content: prompts.tutorSystemPrompt(data.summary) }, ...history],
          { temperature: 0.7, maxTokens: 1200 }
        );
        return { reply };
      });
    }
    case 'ai.history': {
      const history = await db.listAiLogs(openid, ['diagnosis', 'plan'], HISTORY_LIMIT);
      return ok({ history });
    }
    default:
      return fail('BAD_REQUEST', `未知 action: ${action}`);
  }
}

module.exports = { handle, DAILY_AI_LIMIT, HISTORY_LIMIT, dayStartIso };
