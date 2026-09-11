// 云数据库适配器。接口与 test/fakeDb.js 一致。
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const PROGRESS = 'progress';
const LOGS = 'ai_logs';

module.exports = {
  async getProgress(openid) {
    const r = await db.collection(PROGRESS).where({ _id: openid }).limit(1).get();
    const doc = r.data[0];
    return doc ? { progress: doc.progress, updatedAt: doc.updatedAt } : null;
  },
  async putProgress(openid, doc) {
    await db.collection(PROGRESS).doc(openid).set({ data: { progress: doc.progress, updatedAt: doc.updatedAt } });
  },
  async countAiSince(openid, sinceIso) {
    const r = await db.collection(LOGS).where({ openid, date: _.gte(sinceIso) }).count();
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
