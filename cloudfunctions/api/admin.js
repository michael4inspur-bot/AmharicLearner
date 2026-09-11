// 用户资料、公告与管理动作（user.* / announcement.* / admin.*）纯逻辑。
// 不直接依赖 wx-server-sdk，外部依赖通过 ctx 注入。
// ctx = { openid, db, storage, now? }
const { getLimits, isAdmin } = require('./limits.js');
const { dayStartIso, monthStartIso } = require('./time.js');

const USER_STATUSES = ['active', 'paused', 'blocked'];
const AI_TYPES = ['diagnosis', 'plan', 'chat'];
const MAX_NICKNAME = 20;
const MAX_ANNOUNCEMENT = 500;
const ANNOUNCEMENT_ID = 'announcement';
const AI_DAILY_DAYS = 14; // admin.system 柱状图天数
const ERROR_LIST_LIMIT = 20;
const TODAY_LOG_LIMIT = 2000; // 合并当日用量时最多扫描的日志条数
const TTS_CLEAR_BATCH = 50;
const TTS_CLEAR_MAX_BATCHES = 200; // 保险：单次最多清理 10000 条
const DAY_MS = 24 * 60 * 60 * 1000;

function ok(data) { return { ok: true, data }; }
function fail(code, error) { return { ok: false, code, error }; }

/** 用户摘要文档 → 对外字段（无记录视为 active）。 */
function publicUser(openid, doc) {
  const u = doc || {};
  return {
    openid,
    nickname: typeof u.nickname === 'string' ? u.nickname : '',
    status: USER_STATUSES.includes(u.status) ? u.status : 'active'
  };
}

/** 校验非空字符串入参；返回字符串或 null。 */
function cleanId(raw) {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

async function setProfile(data, ctx) {
  const { openid, db } = ctx;
  if (typeof data.nickname !== 'string') return fail('BAD_REQUEST', 'nickname 必须是字符串');
  const nickname = data.nickname.trim();
  if (!nickname || nickname.length > MAX_NICKNAME) return fail('BAD_REQUEST', `昵称必须是 1–${MAX_NICKNAME} 个字符`);
  await db.putUser(openid, { nickname });
  return ok({ nickname });
}

async function me(ctx) {
  const { openid, db } = ctx;
  return ok(publicUser(openid, await db.getUser(openid)));
}

async function announcementGet(ctx) {
  const doc = await ctx.db.getSetting(ANNOUNCEMENT_ID);
  if (!doc || typeof doc.text !== 'string' || !doc.text) return ok({ text: '', updatedAt: null });
  return ok({ text: doc.text, updatedAt: doc.updatedAt || null });
}

async function setAnnouncement(data, ctx, now) {
  const { openid, db } = ctx;
  if (typeof data.text !== 'string') return fail('BAD_REQUEST', 'text 必须是字符串');
  const text = data.text.trim();
  if (text.length > MAX_ANNOUNCEMENT) return fail('BAD_REQUEST', `公告最多 ${MAX_ANNOUNCEMENT} 字`);
  const updatedAt = now.toISOString();
  await db.putSetting(ANNOUNCEMENT_ID, { text, updatedAt, by: openid });
  return ok({ text, updatedAt });
}

/** admin.users：users 集合 + 当日 ai_logs 计数，按 lastActive 倒序。 */
async function listUsers(ctx, now) {
  const { openid, db } = ctx;
  const [docs, logs] = await Promise.all([
    db.listUsers(),
    db.listLogsSince(dayStartIso(now), TODAY_LOG_LIMIT)
  ]);
  const today = new Map();
  for (const l of logs) {
    let t = today.get(l.openid);
    if (!t) {
      t = { ai: 0, tts: 0, stt: 0 };
      today.set(l.openid, t);
    }
    if (AI_TYPES.includes(l.type)) t.ai++;
    else if (l.type === 'tts') t.tts++;
    else if (l.type === 'stt') t.stt++;
  }
  const byId = new Map(docs.map((d) => [d._id, d]));
  if (!byId.has(openid)) byId.set(openid, { _id: openid }); // 管理员自己总能看到自己
  const users = [...byId.entries()].map(([id, d]) => ({
    ...publicUser(id, d),
    lastActive: d.lastActive || '',
    week: Number(d.week) || 0,
    streak: Number(d.streak) || 0,
    stars: Number(d.stars) || 0,
    today: today.get(id) || { ai: 0, tts: 0, stt: 0 },
    isSelf: id === openid
  }));
  users.sort((a, b) => b.lastActive.localeCompare(a.lastActive) || a.openid.localeCompare(b.openid));
  return ok({ users });
}

async function setStatus(data, ctx) {
  const { openid, db } = ctx;
  const target = cleanId(data.openid);
  if (!target) return fail('BAD_REQUEST', '缺少 openid');
  if (!USER_STATUSES.includes(data.status)) return fail('BAD_REQUEST', `status 非法: ${data.status}`);
  if (target === openid) return fail('BAD_REQUEST', '不能操作自己的账号');
  await db.putUser(target, { status: data.status });
  return ok({ openid: target, status: data.status });
}

async function deleteUser(data, ctx, now) {
  const { openid, db } = ctx;
  const target = cleanId(data.openid);
  if (!target) return fail('BAD_REQUEST', '缺少 openid');
  if (target === openid) return fail('BAD_REQUEST', '不能操作自己的账号');
  if (data.confirm !== true) return fail('BAD_REQUEST', '需要确认');
  const doc = await db.getUser(target);
  await db.deleteUserData(target);
  await db.putUser(target, {
    nickname: (doc && typeof doc.nickname === 'string') ? doc.nickname : '',
    status: 'blocked',
    deletedAt: now.toISOString(),
    lastActive: '',
    week: 0,
    streak: 0,
    stars: 0
  });
  return ok({ deleted: true });
}

/** 最近 AI_DAILY_DAYS 天的 UTC 日期（升序），与 countAiByDay 的分组口径一致。 */
function recentDays(now) {
  const days = [];
  for (let i = AI_DAILY_DAYS - 1; i >= 0; i--) days.push(new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10));
  return days;
}

async function system(ctx, now) {
  const { db } = ctx;
  const days = recentDays(now);
  const [monthUsed, rows, ttsCache, errors] = await Promise.all([
    db.sumTtsCharsSince(monthStartIso(now)),
    db.countAiByDay(`${days[0]}T00:00:00.000Z`),
    db.ttsCacheStats(),
    db.listErrorLogs(ERROR_LIST_LIMIT)
  ]);
  const counts = new Map(rows.map((r) => [r.date, r.count]));
  const aiDaily = days.map((date) => ({ date, count: counts.get(date) || 0 }));
  return ok({
    monthChars: { used: monthUsed, limit: getLimits().ttsMonthlyChars },
    aiToday: counts.get(days[days.length - 1]) || 0,
    aiDaily,
    ttsCache,
    errors
  });
}

async function clearTtsCache(data, ctx) {
  const { db, storage } = ctx;
  if (data.confirm !== true) return fail('BAD_REQUEST', '需要确认');
  let removed = 0;
  for (let i = 0; i < TTS_CLEAR_MAX_BATCHES; i++) {
    const batch = await db.listTtsCache(TTS_CLEAR_BATCH);
    if (!batch.length) break;
    const fileIDs = batch.map((d) => d.fileID).filter(Boolean);
    if (fileIDs.length) await storage.remove(fileIDs);
    await db.removeTtsCache(batch.map((d) => d._id));
    removed += batch.length;
  }
  return ok({ removed });
}

/**
 * user.* / announcement.* / admin.* 动作分发（admin.usage 由 handler.js 自行处理）。
 * @returns {Promise<{ok: boolean, data?: object, code?: string, error?: string}>}
 */
async function handleAdmin(action, data, ctx) {
  const now = ctx.now ? ctx.now() : new Date();
  data = data || {};
  switch (action) {
    case 'user.setProfile': return setProfile(data, ctx);
    case 'user.me': return me(ctx);
    case 'announcement.get': return announcementGet(ctx);
    default: break;
  }
  if (!action.startsWith('admin.')) return fail('BAD_REQUEST', `未知 action: ${action}`);
  if (!isAdmin(ctx.openid)) return fail('BAD_REQUEST', '无权限');
  switch (action) {
    case 'admin.users': return listUsers(ctx, now);
    case 'admin.setStatus': return setStatus(data, ctx);
    case 'admin.deleteUser': return deleteUser(data, ctx, now);
    case 'admin.system': return system(ctx, now);
    case 'admin.clearTtsCache': return clearTtsCache(data, ctx);
    case 'admin.setAnnouncement': return setAnnouncement(data, ctx, now);
    default: return fail('BAD_REQUEST', `未知 action: ${action}`);
  }
}

module.exports = { handleAdmin, USER_STATUSES, MAX_NICKNAME, MAX_ANNOUNCEMENT };
