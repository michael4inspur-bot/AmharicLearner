// 云函数入口：取 openid，交给 handler，兜底异常（并记一条 error_logs）。
const cloud = require('wx-server-sdk');
const db = require('./db.js');
const deepseek = require('./deepseek.js');
const azure = require('./azure.js');
const storage = require('./storage.js');
const { handle } = require('./handler.js');

const ERROR_MESSAGE_CHARS = 300;
const ERROR_LOG_KEEP = 200;

/** 写一条错误日志并裁剪到最近 ERROR_LOG_KEEP 条；本身出错时静默忽略。 */
async function logError(openid, action, message) {
  try {
    await db.addErrorLog({
      date: new Date().toISOString(),
      openid,
      action: typeof action === 'string' ? action : String(action),
      message: String(message).slice(0, ERROR_MESSAGE_CHARS)
    });
    await db.pruneErrorLogs(ERROR_LOG_KEEP);
  } catch (e) {
    console.error('写 error_logs 失败', e);
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, code: 'BAD_REQUEST', error: '无法识别用户' };
  try {
    return await handle(event && event.action, event && event.data, { openid: OPENID, db, deepseek, azure, storage });
  } catch (err) {
    console.error(err);
    const message = (err && err.message) || '服务器错误';
    await logError(OPENID, event && event.action, message);
    return { ok: false, code: 'UPSTREAM', error: message };
  }
};
