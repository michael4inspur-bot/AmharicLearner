// 内存实现，接口与 ../db.js 完全一致，供测试与小程序模拟脚本使用。
function createFakeDb() {
  const progress = new Map();
  const logs = [];
  return {
    _logs: logs,
    async getProgress(openid) {
      return progress.has(openid) ? { ...progress.get(openid) } : null;
    },
    async putProgress(openid, doc) {
      progress.set(openid, { progress: doc.progress, updatedAt: doc.updatedAt });
    },
    async countAiSince(openid, sinceIso) {
      return logs.filter((l) => l.openid === openid && l.date >= sinceIso).length;
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
    }
  };
}

module.exports = { createFakeDb };
