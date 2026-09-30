// 云函数纯逻辑。不直接依赖 wx-server-sdk，所有外部依赖通过 ctx 注入。
// ctx = { openid, db, azure, storage, now? }
// 注：AI 教练（DeepSeek 诊断 / 计划调整 / 问答）已整体下线，微信个人主体未开放深度合成类目。
const { handleSpeech } = require('./speech.js');
const { handleAdmin, isAdminUser, isSignedIn } = require('./admin.js');
const { getLimits, isAdmin, DEFAULT_LIMITS } = require('./limits.js');
const { dayStartIso, monthStartIso } = require('./time.js');

const ADMIN_USAGE_DAYS = 7;
const ADMIN_LOG_LIMIT = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;
const GATED_PREFIXES = ['tts.', 'stt.']; // 非 active 账号不可用
const ADMIN_PREFIXES = ['user.', 'announcement.', 'admin.'];
const PROGRESS_LANGS = ['am', 'om'];

/** 进度的语言码：缺省为 am；不认识的返回 ''，由调用方回 BAD_REQUEST */
function progressLang(v) {
  if (v == null || v === '') return 'am';
  return PROGRESS_LANGS.includes(v) ? v : '';
}

/** 阿姆哈拉语沿用 _id = openid（老数据零迁移），其他语言为 openid:lang */
function progressId(openid, lang) {
  return lang === 'am' ? openid : `${openid}:${lang}`;
}

function ok(data) { return { ok: true, data }; }
function fail(code, error) { return { ok: false, code, error }; }

/** usage.get：当前用户今日各类用量与上限、全体本月 TTS 字符。 */
async function usageGet(ctx, now) {
  const { openid, db } = ctx;
  const limits = getLimits();
  const dayStart = dayStartIso(now);
  const [tts, stt, monthChars] = await Promise.all([
    db.countAiSince(openid, dayStart, ['tts']),
    db.countAiSince(openid, dayStart, ['stt']),
    db.sumTtsCharsSince(monthStartIso(now))
  ]);
  return ok({
    tts: { used: tts, limit: limits.tts },
    stt: { used: stt, limit: limits.stt },
    monthChars: { used: monthChars, limit: limits.ttsMonthlyChars },
    // 退出登录后不能靠这里把管理员入口带回来
    isAdmin: isSignedIn(await db.getUser(openid)) && (await isAdminUser(openid, db))
  });
}

/** admin.usage：最近 7 天按用户汇总，按语音次数降序。仅管理员可用。 */
async function adminUsage(ctx, now) {
  const { openid, db } = ctx;
  if (!(await isAdminUser(openid, db))) return fail('BAD_REQUEST', '无权限');
  const since = new Date(now.getTime() - ADMIN_USAGE_DAYS * DAY_MS).toISOString();
  const logs = await db.listLogsSince(since, ADMIN_LOG_LIMIT);
  const byUser = new Map();
  for (const l of logs) {
    let u = byUser.get(l.openid);
    if (!u) {
      u = { openid: l.openid, tts: 0, stt: 0, ttsChars: 0, lastActive: '' };
      byUser.set(l.openid, u);
    }
    if (l.type === 'tts') {
      u.tts++;
      u.ttsChars += Number(l.result && l.result.chars) || 0;
    } else if (l.type === 'stt') u.stt++;
    const date = String(l.date || '');
    if (date > u.lastActive) u.lastActive = date;
  }
  const users = [...byUser.values()]
    .map((u) => ({ ...u, lastActive: u.lastActive.slice(0, 10) }))
    .sort((a, b) => (b.tts + b.stt) - (a.tts + a.stt) || a.openid.localeCompare(b.openid));
  return ok({ users, since });
}

/** progress.put 成功后更新已注册用户的摘要；meta = {week, streak, stars}，缺省为 0。createdAt 仅首次写入。 */
async function putUserSummary(ctx, now, meta) {
  const { openid, db } = ctx;
  const m = meta || {};
  const existing = await db.getUser(openid);
  // 只更新已登录（注册）的用户；未注册的不在这里创建，否则进度同步会绕过登录门槛
  if (!isSignedIn(existing)) return;
  const patch = {
    lastActive: now.toISOString(),
    week: Number(m.week) || 0,
    streak: Number(m.streak) || 0,
    stars: Number(m.stars) || 0
  };
  if (!existing || !existing.createdAt) patch.createdAt = now.toISOString();
  await db.putUser(openid, patch);
}

async function handle(action, data, ctx) {
  const { openid, db } = ctx;
  const now = ctx.now ? ctx.now() : new Date();
  data = data || {};

  if (typeof action !== 'string') return fail('BAD_REQUEST', `未知 action: ${action}`);

  // 账号状态拦截：放在分发之前，speech.js 与 admin.js 都不必自行检查。
  const isGated = GATED_PREFIXES.some((p) => action.startsWith(p));
  const isProgress = action === 'progress.get' || action === 'progress.put';
  if (isGated || isProgress) {
    // 账号状态是管理便利，不是安全边界：users 集合缺失或数据库抖动时放行，
    // 否则一次读失败会让所有人的学习功能全部瘫痪。
    let user = null;
    let readFailed = false;
    try {
      user = await db.getUser(openid);
    } catch (err) {
      readFailed = true;
      console.error('读取账号状态失败，按正常账号放行', err);
    }
    const status = user && user.status;
    if (isGated && !readFailed) {
      if (!isSignedIn(user)) return fail('BAD_REQUEST', '请先在「我的」页完成微信登录');
      if (status === 'pending') return fail('BAD_REQUEST', '账号等待管理员批准');
      if (status && status !== 'active') return fail('BAD_REQUEST', '账号已被管理员暂停');
    }
    if (isProgress && status === 'blocked') return fail('BAD_REQUEST', '账号已停用');
  }

  if (action.startsWith('tts.') || action.startsWith('stt.')) return handleSpeech(action, data, ctx);
  // admin.usage 保留在本文件内（历史实现），其余 user./announcement./admin. 交给 admin.js
  if (action !== 'admin.usage' && ADMIN_PREFIXES.some((p) => action.startsWith(p))) return handleAdmin(action, data, ctx);

  switch (action) {
    case 'progress.get': {
      const lang = progressLang(data.lang);
      if (!lang) return fail('BAD_REQUEST', `lang 非法: ${data.lang}`);
      const doc = await db.getProgress(progressId(openid, lang));
      // 回显 lang：前端据此确认云函数已支持多语言，旧版云函数不会带这个字段
      return ok(doc ? { progress: doc.progress, updatedAt: doc.updatedAt, lang } : { progress: null, updatedAt: null, lang });
    }
    case 'progress.put': {
      if (!data.progress || typeof data.progress !== 'object') return fail('BAD_REQUEST', 'progress 必须是对象');
      const lang = progressLang(data.lang);
      if (!lang) return fail('BAD_REQUEST', `lang 非法: ${data.lang}`);
      const id = progressId(openid, lang);
      // 客户端可带上它上次读到的 updatedAt。云端更新过就拒绝，
      // 避免旧设备的快照静默覆盖新设备刚上传的进度。
      if (typeof data.baseUpdatedAt === 'string' && data.baseUpdatedAt) {
        const current = await db.getProgress(id);
        if (current && current.updatedAt && current.updatedAt > data.baseUpdatedAt) {
          return fail('CONFLICT', '云端有更新的进度，请先从云端恢复再上传');
        }
      }
      const updatedAt = now.toISOString();
      await db.putProgress(id, { progress: data.progress, updatedAt });
      // 摘要只服务于管理端列表，只看阿姆哈拉语；写失败不能让已经存好的进度上传变成失败
      if (lang === 'am') {
        try {
          await putUserSummary(ctx, now, data.meta);
        } catch (err) {
          console.error('写入用户摘要失败', err);
        }
      }
      return ok({ updatedAt, lang });
    }
    case 'usage.get':
      return usageGet(ctx, now);
    case 'admin.usage':
      return adminUsage(ctx, now);
    default:
      return fail('BAD_REQUEST', `未知 action: ${action}`);
  }
}

module.exports = { handle, dayStartIso };
