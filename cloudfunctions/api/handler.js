// 云函数纯逻辑。不直接依赖 wx-server-sdk，所有外部依赖通过 ctx 注入。
// ctx = { openid, db, deepseek, now? }

function ok(data) { return { ok: true, data }; }
function fail(code, error) { return { ok: false, code, error }; }

async function handle(action, data, ctx) {
  const { openid, db } = ctx;
  const now = ctx.now ? ctx.now() : new Date();
  data = data || {};

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
    default:
      return fail('BAD_REQUEST', `未知 action: ${action}`);
  }
}

module.exports = { handle };
