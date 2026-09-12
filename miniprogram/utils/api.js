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
        // 友好文案 + 服务端的真实原因，方便自己排查（几个同事内部用，可见性比措辞重要）
        const friendly = MESSAGES[r.code];
        const detail = r.error && r.error !== friendly ? String(r.error).slice(0, 120) : '';
        const err = new Error(friendly ? (detail ? `${friendly}\n（${detail}）` : friendly) : (r.error || '请求失败'));
        err.code = r.code || 'UNKNOWN';
        err.raw = r.error;
        reject(err);
      },
      fail: (e) => {
        // 云函数本身的失败信息很长（含 callId、trace），原样弹出没法读，按类型归成一句话
        const msg = String((e && e.errMsg) || '');
        let text = `网络错误：${msg.slice(0, 100)}`;
        let code = 'NETWORK';
        if (/-504003|TIME_LIMIT_EXCEEDED|timed out|timeout/i.test(msg)) {
          text = '云函数执行超时。请在云开发控制台把 api 函数的超时时间调到 60 秒。';
          code = 'TIMEOUT';
        } else if (/-504002|FUNCTION_NOT_FOUND|not exist/i.test(msg)) {
          text = '找不到云函数 api。请在开发者工具里右键 cloudfunctions/api，选「上传并部署」。';
          code = 'NOT_DEPLOYED';
        } else if (/-501007|INVALID_ENV|env/i.test(msg) && /not exist|invalid/i.test(msg)) {
          text = '云环境 id 不对。请核对 miniprogram/config.js 里的 cloudEnv。';
          code = 'BAD_ENV';
        }
        const err = new Error(text);
        err.code = code;
        err.raw = msg;
        reject(err);
      }
    });
  });
}

module.exports = {
  configured,
  syncProgress: (progress, meta) => call('progress.put', { progress, meta }),
  fetchProgress: () => call('progress.get'),
  diagnose: (summary, planOutline) => call('ai.diagnose', { summary, planOutline }),
  adjustPlan: (summary, planOutline, diagnosis, request) => call('ai.adjustPlan', { summary, planOutline, diagnosis, request }),
  chat: (messages, summary) => call('ai.chat', { messages, summary }),
  aiHistory: () => call('ai.history'),
  ttsGet: (text, voice, rate) => call('tts.get', { text, voice, rate }),
  ttsBatch: (items, voice, rate) => call('tts.batch', { items, voice, rate }),
  sttScore: (fileID, target) => call('stt.score', { fileID, target }),
  usageGet: () => call('usage.get'),
  adminUsage: () => call('admin.usage'),
  setProfile: (nickname) => call('user.setProfile', { nickname }),
  me: () => call('user.me'),
  announcement: () => call('announcement.get'),
  adminUsers: () => call('admin.users'),
  adminSetStatus: (openid, status) => call('admin.setStatus', { openid, status }),
  adminDeleteUser: (openid) => call('admin.deleteUser', { openid, confirm: true }),
  adminSystem: () => call('admin.system'),
  adminClearTtsCache: () => call('admin.clearTtsCache', { confirm: true }),
  adminSetAnnouncement: (text) => call('admin.setAnnouncement', { text })
};
