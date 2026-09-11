// 云函数入口：取 openid，交给 handler，兜底异常。
const cloud = require('wx-server-sdk');
const db = require('./db.js');
const deepseek = require('./deepseek.js');
const azure = require('./azure.js');
const storage = require('./storage.js');
const { handle } = require('./handler.js');

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, code: 'BAD_REQUEST', error: '无法识别用户' };
  try {
    return await handle(event && event.action, event && event.data, { openid: OPENID, db, deepseek, azure, storage });
  } catch (err) {
    console.error(err);
    return { ok: false, code: 'UPSTREAM', error: (err && err.message) || '服务器错误' };
  }
};
