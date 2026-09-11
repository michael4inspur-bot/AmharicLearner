// 后台请求封装：自动登录（wx.login -> /api/auth/login），带 token 重试一次。
const SETTINGS_KEY = 'settings_v1';
const DEFAULT_BASE_URL = 'https://your-server.example.com/api';

function getSettings() {
  try { return { baseUrl: DEFAULT_BASE_URL, ...(wx.getStorageSync(SETTINGS_KEY) || {}) }; } catch (e) { return { baseUrl: DEFAULT_BASE_URL }; }
}
function saveSettings(s) {
  try { wx.setStorageSync(SETTINGS_KEY, { ...getSettings(), ...s }); } catch (e) { /* ignore */ }
}

function rawRequest(path, method, data, token) {
  const { baseUrl } = getSettings();
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl.replace(/\/$/, '') + path,
      method,
      data,
      timeout: 90000,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else {
          const err = new Error((res.data && res.data.error) || `请求失败 (${res.statusCode})`);
          err.status = res.statusCode;
          reject(err);
        }
      },
      fail: (e) => reject(new Error(e.errMsg || '网络错误'))
    });
  });
}

let loginPromise = null;
function login() {
  if (loginPromise) return loginPromise;
  loginPromise = new Promise((resolve, reject) => {
    wx.login({
      success: (r) => resolve(r.code),
      fail: () => resolve('dev')
    });
  })
    .then((code) => rawRequest('/auth/login', 'POST', { code }))
    .then((data) => { saveSettings({ token: data.token, userId: data.userId }); return data.token; })
    .finally(() => { loginPromise = null; });
  return loginPromise;
}

async function request(path, method = 'GET', data) {
  let { token } = getSettings();
  if (!token) token = await login();
  try {
    return await rawRequest(path, method, data, token);
  } catch (err) {
    if (err.status === 401) {
      token = await login();
      return rawRequest(path, method, data, token);
    }
    throw err;
  }
}

module.exports = {
  getSettings,
  saveSettings,
  health: () => rawRequest('/health', 'GET'),
  syncProgress: (progress) => request('/progress', 'PUT', { progress }),
  fetchProgress: () => request('/progress', 'GET'),
  diagnose: (summary, planOutline) => request('/ai/diagnose', 'POST', { summary, planOutline }),
  adjustPlan: (summary, planOutline, diagnosis, req) => request('/ai/adjust-plan', 'POST', { summary, planOutline, diagnosis, request: req }),
  chat: (messages, summary) => request('/ai/chat', 'POST', { messages, summary }),
  aiHistory: () => request('/ai/history', 'GET')
};
