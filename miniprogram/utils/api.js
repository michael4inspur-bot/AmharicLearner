// 后台请求封装：全部走微信云函数 api，按 action 分发。
const config = require('../config.js');

const MESSAGES = {
  NO_API_KEY: '管理员还没配置 DeepSeek 密钥',
  UPSTREAM: 'AI 服务暂时不可用，稍后再试',
  TIMEOUT: 'AI 响应超时，请重试'
};

function configured() {
  return !!config.cloudEnv;
}

function call(action, data) {
  if (!configured()) {
    const err = new Error('还没有配置云开发环境');
    err.code = 'NO_ENV';
    return Promise.reject(err);
  }
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'api',
      data: { action, data },
      success: (res) => {
        const r = res.result || {};
        if (r.ok) { resolve(r.data); return; }
        const err = new Error(MESSAGES[r.code] || r.error || '请求失败');
        err.code = r.code || 'UNKNOWN';
        err.raw = r.error;
        reject(err);
      },
      fail: (e) => {
        const msg = (e && e.errMsg) || '';
        const err = new Error(/timeout/i.test(msg) ? MESSAGES.TIMEOUT : `网络错误：${msg}`);
        err.code = /timeout/i.test(msg) ? 'TIMEOUT' : 'NETWORK';
        reject(err);
      }
    });
  });
}

module.exports = {
  configured,
  syncProgress: (progress) => call('progress.put', { progress }),
  fetchProgress: () => call('progress.get'),
  diagnose: (summary, planOutline) => call('ai.diagnose', { summary, planOutline }),
  adjustPlan: (summary, planOutline, diagnosis, request) => call('ai.adjustPlan', { summary, planOutline, diagnosis, request }),
  chat: (messages, summary) => call('ai.chat', { messages, summary }),
  aiHistory: () => call('ai.history')
};
