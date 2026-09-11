// 云数据库适配器。接口与 test/fakeDb.js 一致。
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const PROGRESS = 'progress';
const LOGS = 'ai_logs';
const TTS_CACHE = 'tts_cache';

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
  }
};
