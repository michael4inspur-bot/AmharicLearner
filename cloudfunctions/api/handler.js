// 云函数纯逻辑。不直接依赖 wx-server-sdk，所有外部依赖通过 ctx 注入。
// ctx = { openid, db, deepseek, azure, storage, now? }
const prompts = require('./prompts.js');
const { handleSpeech } = require('./speech.js');
const { getLimits, isAdmin, DEFAULT_LIMITS } = require('./limits.js');
const { dayStartIso, monthStartIso } = require('./time.js');

const DAILY_AI_LIMIT = DEFAULT_LIMITS.ai; // 默认值常量；实际上限每次调用 getLimits() 读取
const AI_LIMIT_TYPES = ['diagnosis', 'plan', 'chat']; // 每日 AI 上限只统计这三类，tts/stt 另计
const HISTORY_LIMIT = 30;
const CHAT_LOG_TTL_DAYS = 7;
const ADMIN_USAGE_DAYS = 7;
const ADMIN_LOG_LIMIT = 2000;
const MAX_CHAT_MESSAGES = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

function ok(data) { return { ok: true, data }; }
function fail(code, error) { return { ok: false, code, error }; }

async function withAi(ctx, now, type, request, run) {
  const { openid, db, deepseek } = ctx;
  const aiLimit = getLimits().ai;
  const used = await db.countAiSince(openid, dayStartIso(now), AI_LIMIT_TYPES);
  if (used >= aiLimit) {
    return fail('BAD_REQUEST', `今天的 AI 次数已用完（${aiLimit} 次），明天再来`);
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

/** usage.get：当前用户今日各类用量与上限、全体本月 TTS 字符。 */
async function usageGet(ctx, now) {
  const { openid, db } = ctx;
  const limits = getLimits();
  const dayStart = dayStartIso(now);
  const [ai, tts, stt, monthChars] = await Promise.all([
    db.countAiSince(openid, dayStart, AI_LIMIT_TYPES),
    db.countAiSince(openid, dayStart, ['tts']),
    db.countAiSince(openid, dayStart, ['stt']),
    db.sumTtsCharsSince(monthStartIso(now))
  ]);
  return ok({
    ai: { used: ai, limit: limits.ai },
    tts: { used: tts, limit: limits.tts },
    stt: { used: stt, limit: limits.stt },
    monthChars: { used: monthChars, limit: limits.ttsMonthlyChars },
    isAdmin: isAdmin(openid)
  });
}

/** admin.usage：最近 7 天按用户汇总，按 ai 次数降序。仅 ADMIN_OPENIDS 中的用户可用。 */
async function adminUsage(ctx, now) {
  const { openid, db } = ctx;
  if (!isAdmin(openid)) return fail('BAD_REQUEST', '无权限');
  const since = new Date(now.getTime() - ADMIN_USAGE_DAYS * DAY_MS).toISOString();
  const logs = await db.listLogsSince(since, ADMIN_LOG_LIMIT);
  const byUser = new Map();
  for (const l of logs) {
    let u = byUser.get(l.openid);
    if (!u) {
      u = { openid: l.openid, ai: 0, tts: 0, stt: 0, ttsChars: 0, lastActive: '' };
      byUser.set(l.openid, u);
    }
    if (AI_LIMIT_TYPES.includes(l.type)) u.ai++;
    else if (l.type === 'tts') {
      u.tts++;
      u.ttsChars += Number(l.result && l.result.chars) || 0;
    } else if (l.type === 'stt') u.stt++;
    const date = String(l.date || '');
    if (date > u.lastActive) u.lastActive = date;
  }
  const users = [...byUser.values()]
    .map((u) => ({ ...u, lastActive: u.lastActive.slice(0, 10) }))
    .sort((a, b) => b.ai - a.ai || a.openid.localeCompare(b.openid));
  return ok({ users, since });
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
    case 'usage.get':
      return usageGet(ctx, now);
    case 'admin.usage':
      return adminUsage(ctx, now);
    default:
      return fail('BAD_REQUEST', `未知 action: ${action}`);
  }
}

module.exports = { handle, DAILY_AI_LIMIT, HISTORY_LIMIT, dayStartIso };
