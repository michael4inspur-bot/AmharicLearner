// 微信登录：code -> openid。未配置 AppID 时走匿名开发模式。
import { config } from './config.js';

export async function codeToOpenId(code) {
  const { appId, secret } = config.wx;
  if (!appId || !secret || !code || code === 'dev') {
    return { openid: null, devMode: true };
  }
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', secret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');
  const res = await fetch(url);
  const data = await res.json();
  if (!data.openid) {
    const err = new Error(`微信登录失败: ${data.errmsg || data.errcode}`);
    err.status = 401;
    throw err;
  }
  return { openid: data.openid, devMode: false };
}
