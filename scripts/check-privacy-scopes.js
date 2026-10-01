// 合规静态检查。跑在 npm test 里，拦住两类会导致微信审核驳回的代码回潮：
//   1. 需要在《用户隐私保护指引》里额外声明 scope 的组件能力；
//   2. AI / 深度合成相关的任何残留（个人主体未开放该类目）。
// 检查器本身被攻击过：早期版本只认双引号、只扫 wxml、只看 utils 目录，
// 用单引号、把调用挪到 pages/、改个变量名都能绕过。下面按"扫全部源码 + 宽松匹配"重写。
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..', 'miniprogram');
const fnRoot = path.join(__dirname, '..', 'cloudfunctions');

/** 递归收集指定后缀的文件 */
function walk(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p, exts);
    return exts.includes(path.extname(p)) ? [p] : [];
  });
}

const wxmlFiles = walk(root, ['.wxml']);
const srcFiles = [...walk(root, ['.js', '.wxml', '.json']), ...walk(fnRoot, ['.js'])]
  .filter((f) => !/[\\/]test[\\/]/.test(f) && !/package(-lock)?\.json$/.test(f));

function rel(f) { return path.relative(path.join(__dirname, '..'), f); }

// ---------- 1. 需要额外声明隐私 scope 的组件 ----------
// 引号用 ['"] 兼容单双引号；属性名与值之间允许空白。
const GATED = [
  [/type\s*=\s*['"]nickname['"]/, '<input type="nickname">（微信昵称 scope）'],
  [/open-type\s*=\s*['"]chooseAvatar['"]/, 'open-type="chooseAvatar"（微信头像 scope）'],
  [/open-type\s*=\s*['"]getUserInfo['"]/, 'open-type="getUserInfo"（用户信息 scope）'],
  [/open-type\s*=\s*['"]getPhoneNumber['"]/, 'open-type="getPhoneNumber"（手机号 scope）']
];

// 需要在指引里声明的隐私接口，出现在 .js 里同样要拦
const GATED_API = [
  [/wx\.getLocation|wx\.chooseLocation|wx\.onLocationChange/, '位置接口（需声明位置 scope）'],
  [/wx\.chooseImage|wx\.chooseMedia|wx\.saveImageToPhotosAlbum/, '相册接口（需声明相册 scope）'],
  [/wx\.getClipboardData/, '读剪贴板（需声明剪贴板 scope）'],
  [/wx\.startBluetoothDevicesDiscovery|wx\.getWifiList/, '蓝牙 / Wi-Fi 接口（需声明对应 scope）']
];

const scopeHits = [];
wxmlFiles.forEach((f) => {
  const s = fs.readFileSync(f, 'utf8');
  GATED.forEach(([re, label]) => { if (re.test(s)) scopeHits.push(`${rel(f)}: ${label}`); });
});
walk(root, ['.js']).forEach((f) => {
  const s = fs.readFileSync(f, 'utf8');
  GATED_API.forEach(([re, label]) => { if (re.test(s)) scopeHits.push(`${rel(f)}: ${label}`); });
});
assert.deepEqual(scopeHits, [], '用了需要额外声明隐私 scope 的能力：\n  ' + scopeHits.join('\n  '));

// ---------- 2. AI / 深度合成残留 ----------
// AI 教练（DeepSeek 诊断 / 计划调整 / 问答）已整体移除。个人主体未开放深度合成类目，
// 任何形式的回潮都要在提交前被拦住，包括换个 action 名、把调用挪到别的目录。
const AI_PATTERNS = [
  [/deepseek/i, 'DeepSeek 引用'],
  [/['"]ai\.[a-z]+['"]/i, "ai.* 云函数 action"],
  [/aiCoachEnabled/, '已废弃的 AI 开关'],
  [/pages\/coach\//, 'AI 教练页引用']
];
const aiHits = [];
srcFiles.forEach((f) => {
  const s = fs.readFileSync(f, 'utf8');
  // 允许注释里说明"已移除"，只看代码行
  const code = s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  AI_PATTERNS.forEach(([re, label]) => { if (re.test(code)) aiHits.push(`${rel(f)}: ${label}`); });
});
assert.deepEqual(aiHits, [], 'AI / 深度合成的代码回潮了（个人主体未开放此类目）：\n  ' + aiHits.join('\n  '));

assert.ok(!fs.existsSync(path.join(root, 'pages', 'coach')), 'AI 教练页目录又出现了');

// 用户看得见的「AI」字样。只查代码模式挡不住文案残留：删掉 AI 功能之后，
// 登录页的同意链接、隐私页标题、管理页统计里还留着 11 处「AI」，审核员一眼就能看到。
// 扫 wxml / json 全文，以及 js 里的字符串字面量（注释不算）。
const uiHits = [];
walk(root, ['.wxml', '.json']).forEach((f) => {
  if (/\bAI\b/.test(fs.readFileSync(f, 'utf8'))) uiHits.push(rel(f));
});
walk(root, ['.js']).forEach((f) => {
  const code = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const literals = code.match(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g) || [];
  if (literals.some((x) => /\bAI\b/.test(x))) uiHits.push(rel(f));
});
assert.deepEqual(uiHits, [], '用户可见文案里出现了「AI」（个人主体未开放深度合成类目）：\n  ' + uiHits.join('\n  '));

// ---------- 3. app.json ----------
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
assert.ok(!app.pages.some((p) => /coach/.test(p)), 'app.json 的 pages 里还有 AI 教练页');
assert.ok(!app.tabBar.list.some((t) => /coach/.test(t.pagePath)), 'app.json 的 tabBar 里还有 AI 教练');

// 自定义 tabBar 是真机上实际渲染的那一份，也要查
const tabBarSrc = fs.readFileSync(path.join(root, 'custom-tab-bar', 'index.js'), 'utf8');
assert.ok(!/pagePath:\s*['"][^'"]*coach/.test(tabBarSrc), '自定义 tabBar 里还有 AI 教练');

// __usePrivacyCheck__ 只有在后台配好《用户隐私保护指引》后才应打开。
// 注意 false 与不写都算关闭，早期版本把 false 也当成打开了（假阳性）。
assert.notEqual(app.__usePrivacyCheck__, true,
  'app.json 打开了 __usePrivacyCheck__；后台指引配好之前请保持关闭（见 README 合规说明）');

// ---------- 4. 奥罗莫语合成语音的标注与署名 ----------
const mustTag = ['lesson/lesson', 'review/review', 'quiz/quiz', 'speak/speak', 'search/search'];
mustTag.forEach((p) => {
  const f = path.join(root, 'pages', `${p}.wxml`);
  const src = fs.readFileSync(f, 'utf8');
  assert.ok(/wx:if\s*=\s*['"]\{\{\s*voiceNote\s*\}\}['"]/.test(src) && /\{\{\s*voiceNote\s*\}\}/.test(src), `${rel(f)} 的朗读入口旁缺少「合成音」标注（voiceNote）`);
});
// 小测页每个朗读喇叭（playCurrent）旁都要有标注，不只是听力题标题
const quizSrc = fs.readFileSync(path.join(root, 'pages', 'quiz', 'quiz.wxml'), 'utf8');
const quizSpeakers = (quizSrc.match(/playCurrent/g) || []).length;
const quizTags = (quizSrc.match(/class=['"]syn-tag['"]/g) || []).length;
assert.ok(quizTags >= quizSpeakers, `pages/quiz/quiz.wxml 有 ${quizSpeakers} 个朗读入口，只有 ${quizTags} 处「合成音」标注`);
const privacySrc = fs.readFileSync(path.join(root, 'utils', 'privacy.js'), 'utf8');
const aboutSrc = fs.readFileSync(path.join(root, 'pages', 'profile', 'profile.wxml'), 'utf8');
[['utils/privacy.js', privacySrc], ['pages/profile/profile.wxml', aboutSrc]].forEach(([name, src]) => {
  assert.ok(/MMS/.test(src) && /mms-tts-orm/.test(src) && /CC BY-NC 4\.0/.test(src), `${name} 缺少奥罗莫语语音模型署名（Meta MMS、facebook/mms-tts-orm、CC BY-NC 4.0）`);
});

// 麦克风用途：小程序隐私页、README 指引表、提审检查清单三处必须同一句话（奥罗莫语录音不上传也要写进去）
const { ITEMS } = require(path.join(root, 'utils', 'privacy.js'));
const mic = ITEMS.find((it) => /麦克风/.test(it.type));
assert.ok(mic && /阿姆哈拉语/.test(mic.use) && /奥罗莫语录音只在本机/.test(mic.use), 'privacy.js 的麦克风用途要分别写明阿姆哈拉语与奥罗莫语');
['README.md', '提审检查清单.md'].forEach((name) => {
  const doc = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  assert.ok(doc.includes(mic.use), `${name} 的麦克风用途与 privacy.js 不一致：应为「${mic.use}」`);
});
console.log(`OK: 合规静态检查通过（扫描 ${srcFiles.length} 个源文件）`);
