// 内存实现，接口与 ../db.js 完全一致，供测试与小程序模拟脚本使用。
const AI_TYPES = ['diagnosis', 'plan', 'chat']; // countAiByDay 只统计这三类

function createFakeDb() {
  const progress = new Map();
  const logs = [];
  const ttsCache = new Map();
  const users = new Map();
  const settings = new Map();
  const errors = [];
  return {
    _logs: logs,
    _ttsCache: ttsCache,
    _users: users,
    _settings: settings,
    _errors: errors,
    async getProgress(openid) {
      return progress.has(openid) ? { ...progress.get(openid) } : null;
    },
    async putProgress(openid, doc) {
      progress.set(openid, { progress: doc.progress, updatedAt: doc.updatedAt });
    },
    async countAiSince(openid, sinceIso, types) {
      return logs.filter((l) => l.openid === openid && l.date >= sinceIso && (!types || types.includes(l.type))).length;
    },
    async addAiLog(entry) {
      logs.push({ ...entry, _id: String(logs.length + 1) });
    },
    async listAiLogs(openid, types, limit) {
      return logs
        .filter((l) => l.openid === openid && types.includes(l.type))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit)
        .map(({ type, date, request, result }) => ({ type, date, request, result }));
    },
    async getTtsCache(key) {
      return ttsCache.has(key) ? { ...ttsCache.get(key) } : null;
    },
    async putTtsCache(doc) {
      const { _id, ...rest } = doc;
      ttsCache.set(_id, { _id, ...rest });
    },
    async sumTtsCharsSince(sinceIso) {
      return logs
        .filter((l) => l.type === 'tts' && l.date >= sinceIso)
        .reduce((sum, l) => sum + (Number(l.result && l.result.chars) || 0), 0);
    },
    async listLogsSince(sinceIso, limit = 2000) {
      return logs
        .filter((l) => l.date >= sinceIso)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit)
        .map(({ openid, type, date, result }) => ({ openid, type, date, result }));
    },
    async pruneAiLogs(openid, { keep, chatBefore }) {
      for (let i = logs.length - 1; i >= 0; i--) {
        const l = logs[i];
        if (l.openid === openid && l.type === 'chat' && l.date < chatBefore) logs.splice(i, 1);
      }
      const kept = logs
        .filter((l) => l.openid === openid && (l.type === 'diagnosis' || l.type === 'plan'))
        .sort((a, b) => b.date.localeCompare(a.date));
      const drop = new Set(kept.slice(keep).map((l) => l._id));
      for (let i = logs.length - 1; i >= 0; i--) if (drop.has(logs[i]._id)) logs.splice(i, 1);
    },
    async getUser(openid) {
      return users.has(openid) ? { ...users.get(openid) } : null;
    },
    /** 合并写入：已有字段保留，patch 覆盖。 */
    async putUser(openid, patch) {
      users.set(openid, { ...(users.get(openid) || {}), ...patch, _id: openid });
    },
    async listUsers() {
      return [...users.values()].slice(0, 1000).map((u) => ({ ...u }));
    },
    async deleteUserData(openid) {
      progress.delete(openid);
      for (let i = logs.length - 1; i >= 0; i--) if (logs[i].openid === openid) logs.splice(i, 1);
    },
    async getSetting(id) {
      return settings.has(id) ? { ...settings.get(id) } : null;
    },
    async putSetting(id, doc) {
      const { _id, ...rest } = doc;
      settings.set(id, { _id: id, ...rest });
    },
    async addErrorLog(entry) {
      errors.push({ ...entry, _id: String(errors.length + 1) });
    },
    async listErrorLogs(limit = 20) {
      return [...errors]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, limit)
        .map(({ date, openid, action, message }) => ({ date, openid, action, message }));
    },
    async pruneErrorLogs(keep = 200) {
      const sorted = [...errors].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const drop = new Set(sorted.slice(keep).map((e) => e._id));
      for (let i = errors.length - 1; i >= 0; i--) if (drop.has(errors[i]._id)) errors.splice(i, 1);
    },
    /** 自 sinceIso 起 AI 类日志按 date 前 10 位（UTC 日期）分组计数。 */
    async countAiByDay(sinceIso) {
      const by = new Map();
      for (const l of logs) {
        if (!AI_TYPES.includes(l.type) || l.date < sinceIso) continue;
        const day = String(l.date).slice(0, 10);
        by.set(day, (by.get(day) || 0) + 1);
      }
      return [...by.entries()].map(([date, count]) => ({ date, count }));
    },
    async ttsCacheStats() {
      let chars = 0;
      for (const d of ttsCache.values()) chars += Number(d.chars) || 0;
      return { count: ttsCache.size, chars };
    },
    async listTtsCache(limit = 50) {
      return [...ttsCache.values()].slice(0, limit).map(({ _id, fileID }) => ({ _id, fileID }));
    },
    async removeTtsCache(ids) {
      for (const id of ids || []) ttsCache.delete(id);
    }
  };
}

module.exports = { createFakeDb };
