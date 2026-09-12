// 云数据库适配器。接口与 test/fakeDb.js 一致。
const cloud = require('wx-server-sdk');
const { eatDayKey } = require('./time.js');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = _.aggregate;
const PAGE = 1000; // 云数据库单次 get 的 limit 上限
const PROGRESS = 'progress';
const LOGS = 'ai_logs';
const TTS_CACHE = 'tts_cache';
const USERS = 'users';
const SETTINGS = 'settings';
const ERRORS = 'error_logs';
const AI_TYPES = ['diagnosis', 'plan', 'chat']; // countAiByDay 只统计这三类
const PRUNE_BATCH = 100; // 单次裁剪最多删除的条数

/** 集合尚未在控制台创建时云数据库报 -502005，视为空集合而不是错误。 */
function isMissingCollection(err) {
  if (!err) return false;
  if (err.errCode === -502005) return true;
  return /collection not exists/i.test(String(err.errMsg || err.message || ''));
}

module.exports = {
  async getProgress(openid) {
    const r = await db.collection(PROGRESS).where({ _id: openid }).limit(1).get();
    const doc = r.data[0];
    return doc ? { progress: doc.progress, updatedAt: doc.updatedAt } : null;
  },
  async putProgress(openid, doc) {
    await db.collection(PROGRESS).doc(openid).set({ data: { progress: doc.progress, updatedAt: doc.updatedAt } });
  },
  /** types 省略时统计全部类型；给数组时只统计这些类型。 */
  async countAiSince(openid, sinceIso, types) {
    const where = { openid, date: _.gte(sinceIso) };
    if (Array.isArray(types)) where.type = _.in(types);
    const r = await db.collection(LOGS).where(where).count();
    return r.total;
  },
  async addAiLog(entry) {
    await db.collection(LOGS).add({ data: entry });
  },
  async listAiLogs(openid, types, limit) {
    const r = await db.collection(LOGS)
      .where({ openid, type: _.in(types) })
      .orderBy('date', 'desc')
      .limit(limit)
      .field({ type: true, date: true, request: true, result: true })
      .get();
    return r.data.map(({ type, date, request, result }) => ({ type, date, request, result }));
  },
  /** @returns {Promise<object|null>} tts_cache 文档（_id = key） */
  async getTtsCache(key) {
    const r = await db.collection(TTS_CACHE).where({ _id: key }).limit(1).get();
    return r.data[0] || null;
  },
  /** doc 含 _id（= key）、fileID、text、voice、rate、chars、createdAt */
  async putTtsCache(doc) {
    const { _id, ...data } = doc;
    await db.collection(TTS_CACHE).doc(_id).set({ data });
  },
  /** 自 sinceIso 起全体用户 tts 日志 result.chars 之和（聚合）。 */
  async sumTtsCharsSince(sinceIso) {
    const r = await db.collection(LOGS).aggregate()
      .match({ type: 'tts', date: _.gte(sinceIso) })
      .group({ _id: null, total: $.sum('$result.chars') })
      .end();
    return r.list[0] ? r.list[0].total : 0;
  },
  /**
   * 自 sinceIso 起全体用户的日志（按 date 倒序），最多 limit 条；超过单页上限时分页拉取。
   * @returns {Promise<Array<{openid: string, type: string, date: string, result: object}>>}
   */
  async listLogsSince(sinceIso, limit = 2000) {
    const out = [];
    while (out.length < limit) {
      const size = Math.min(PAGE, limit - out.length);
      const r = await db.collection(LOGS)
        .where({ date: _.gte(sinceIso) })
        .orderBy('date', 'desc')
        .skip(out.length)
        .limit(size)
        .field({ openid: true, type: true, date: true, result: true })
        .get();
      for (const { openid, type, date, result } of r.data) out.push({ openid, type, date, result });
      if (r.data.length < size) break;
    }
    return out;
  },
  async pruneAiLogs(openid, { keep, chatBefore }) {
    await db.collection(LOGS).where({ openid, type: 'chat', date: _.lt(chatBefore) }).remove();
    const extra = await db.collection(LOGS)
      .where({ openid, type: _.in(['diagnosis', 'plan']) })
      .orderBy('date', 'desc')
      .skip(keep)
      .limit(100)
      .field({ _id: true })
      .get();
    if (extra.data.length) {
      await db.collection(LOGS).where({ _id: _.in(extra.data.map((d) => d._id)) }).remove();
    }
  },
  /** @returns {Promise<object|null>} users 文档（_id = openid） */
  async getUser(openid) {
    try {
      const r = await db.collection(USERS).where({ _id: openid }).limit(1).get();
      return r.data[0] || null;
    } catch (err) {
      if (isMissingCollection(err)) return null;
      throw err;
    }
  },
  /** 合并写入：先读已有文档，再用 patch 覆盖后整体 set（doc.set 会替换整个文档）。 */
  async putUser(openid, patch) {
    const r = await db.collection(USERS).where({ _id: openid }).limit(1).get();
    const { _id, ...old } = r.data[0] || {};
    await db.collection(USERS).doc(openid).set({ data: { ...old, ...patch } });
  },
  /** @returns {Promise<Array<object>>} 全部用户摘要（最多 PAGE 条） */
  async listUsers() {
    const r = await db.collection(USERS).limit(PAGE).get();
    return r.data;
  },
  /** 删除某用户的 progress 文档与全部 ai_logs（where().remove() 服务端一次删多条）。 */
  async deleteUserData(openid) {
    await db.collection(PROGRESS).where({ _id: openid }).remove();
    await db.collection(LOGS).where({ openid }).remove();
  },
  /** @returns {Promise<object|null>} settings 文档 */
  async getSetting(id) {
    const r = await db.collection(SETTINGS).where({ _id: id }).limit(1).get();
    return r.data[0] || null;
  },
  async putSetting(id, doc) {
    const { _id, ...data } = doc;
    await db.collection(SETTINGS).doc(id).set({ data });
  },
  /** entry = {date, openid, action, message} */
  async addErrorLog(entry) {
    await db.collection(ERRORS).add({ data: entry });
  },
  async listErrorLogs(limit = 20) {
    const r = await db.collection(ERRORS)
      .orderBy('date', 'desc')
      .limit(limit)
      .field({ date: true, openid: true, action: true, message: true })
      .get();
    return r.data.map(({ date, openid, action, message }) => ({ date, openid, action, message }));
  },
  /** 只保留最新 keep 条错误日志。 */
  async pruneErrorLogs(keep = 200) {
    const extra = await db.collection(ERRORS)
      .orderBy('date', 'desc')
      .skip(keep)
      .limit(PRUNE_BATCH)
      .field({ _id: true })
      .get();
    if (extra.data.length) {
      await db.collection(ERRORS).where({ _id: _.in(extra.data.map((d) => d._id)) }).remove();
    }
  },
  /**
   * 自 sinceIso 起 AI 类日志按 date 前 10 位分组计数（聚合）。
   * @returns {Promise<Array<{date: string, count: number}>>}
   */
  /** 自 sinceIso 起的 AI 日志按东非日分组计数：[{date: 'YYYY-MM-DD', count}] */
  async countAiByDay(sinceIso) {
    const by = new Map();
    let skip = 0;
    for (;;) {
      const r = await db.collection(LOGS)
        .where({ type: _.in(AI_TYPES), date: _.gte(sinceIso) })
        .orderBy('date', 'asc')
        .skip(skip)
        .limit(PAGE)
        .field({ date: true })
        .get();
      for (const d of r.data) {
        const day = eatDayKey(d.date);
        by.set(day, (by.get(day) || 0) + 1);
      }
      if (r.data.length < PAGE) break;
      skip += PAGE;
    }
    return [...by.entries()].map(([date, count]) => ({ date, count }));
  },
  /** @returns {Promise<{count: number, chars: number}>} tts_cache 条数与字符合计 */
  async ttsCacheStats() {
    const c = await db.collection(TTS_CACHE).count();
    if (!c.total) return { count: 0, chars: 0 };
    const r = await db.collection(TTS_CACHE).aggregate()
      .group({ _id: null, chars: $.sum('$chars') })
      .end();
    return { count: c.total, chars: r.list[0] ? r.list[0].chars : 0 };
  },
  /** @returns {Promise<Array<{_id: string, fileID: string}>>} */
  async listTtsCache(limit = 50) {
    const r = await db.collection(TTS_CACHE).limit(limit).field({ _id: true, fileID: true }).get();
    return r.data.map(({ _id, fileID }) => ({ _id, fileID }));
  },
  async removeTtsCache(ids) {
    if (!ids || !ids.length) return;
    await db.collection(TTS_CACHE).where({ _id: _.in(ids) }).remove();
  }
};
