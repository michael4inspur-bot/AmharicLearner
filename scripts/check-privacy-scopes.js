// 静态检查：小程序不得使用需要在「用户隐私保护指引」里额外声明 scope 的组件能力。
// 背景：<input type="nickname"> 会调用 showNicknameAccessory，后台没声明「微信昵称」scope 时
// 渲染层直接报 errno 112，模拟器随后失去响应。昵称本来就是用户自己填的，不需要微信昵称控件。
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..', 'miniprogram');

// 组件属性 -> 需要声明的隐私 scope
const GATED = [
  [/type\s*=\s*"nickname"/, '<input type="nickname">（微信昵称 scope）'],
  [/open-type\s*=\s*"chooseAvatar"/, 'open-type="chooseAvatar"（微信头像 scope）'],
  [/open-type\s*=\s*"getUserInfo"/, 'open-type="getUserInfo"（用户信息 scope）'],
  [/open-type\s*=\s*"getPhoneNumber"/, 'open-type="getPhoneNumber"（手机号 scope）']
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (p.endsWith('.wxml') ? [p] : []);
  });
}

const hits = [];
walk(root).forEach((f) => {
  const s = fs.readFileSync(f, 'utf8');
  GATED.forEach(([re, label]) => { if (re.test(s)) hits.push(`${path.relative(root, f)}: ${label}`); });
});
assert.deepEqual(hits, [], '使用了需要额外声明隐私 scope 的组件：\n  ' + hits.join('\n  '));

// __usePrivacyCheck__ 只有在后台已配置《用户隐私保护指引》后才应打开，
// 否则开发者工具和体验版会因为指引缺失而报错。默认保持关闭。
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
assert.equal(app.__usePrivacyCheck__, undefined,
  'app.json 打开了 __usePrivacyCheck__；后台指引配好之前请保持关闭（见 README 第 5 节）');

// 微信审核：AI 问答属于深度合成技术，个人主体尚未开放该类目。
// 小程序端不得再出现对话入口；云函数 ai.chat 保留，换成企业主体后可直接恢复。
const chatHits = [];
walk(root).forEach((f) => {
  const s = fs.readFileSync(f, 'utf8');
  if (/tab\s*===?\s*'chat'|问教练|quickAsk/.test(s)) chatHits.push(path.relative(root, f));
});
fs.readdirSync(path.join(root, 'utils')).forEach((name) => {
  const s = fs.readFileSync(path.join(root, 'utils', name), 'utf8');
  if (/ai\.chat/.test(s)) chatHits.push('utils/' + name);
});
assert.deepEqual(chatHits, [], 'AI 问答入口又回到小程序端了（微信个人主体未开放此类目）：\n  ' + chatHits.join('\n  '));

console.log('OK: 隐私 scope 与 AI 问答静态检查通过');
