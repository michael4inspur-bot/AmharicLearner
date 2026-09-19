// 模拟微信运行环境，跑通小程序核心逻辑与云函数调用链路。用法：node scripts/sim-miniprogram.js
const path = require('path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..', 'miniprogram');
const fnRoot = path.join(__dirname, '..', 'cloudfunctions', 'api');
const { handle } = require(path.join(fnRoot, 'handler.js'));
const { createFakeDb } = require(path.join(fnRoot, 'test', 'fakeDb.js'));
const { createFakeDeepseek } = require(path.join(fnRoot, 'test', 'fakeDeepseek.js'));
const { createFakeAzure } = require(path.join(fnRoot, 'test', 'fakeAzure.js'));
const { createFakeStorage } = require(path.join(fnRoot, 'test', 'fakeStorage.js'));

const DIAG = { overall_level: '入门', score: 50, summary: '模拟诊断', strengths: ['坚持'], weaknesses: [], risks: [],
  recommendations: [], plan_changes: [], daily_minutes_suggestion: 30, next_7_days: [], encouragement: '继续' };
const db = createFakeDb({ registered: false }); // 严格：必须先登录（注册）才能用 AI / 语音
let simOpenid = 'sim-user';
const deepseek = createFakeDeepseek((messages, opts) => (opts && opts.json ? JSON.stringify(DIAG) : 'ሰላም! 模拟回复'));
const azure = createFakeAzure({ synth: () => Buffer.from('mp3'), recog: () => ({ status: 'Success', text: 'ሰላም' }) });
const storage = createFakeStorage();

const store = {};
const localFiles = new Set(); // downloadFile 成功写入的本地路径，供 accessSync 判断存在
global.wx = {
  env: { USER_DATA_PATH: '/tmp/sim' },
  getStorageSync: (k) => store[k],
  setStorageSync: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
  removeStorageSync: (k) => { delete store[k]; },
  showToast() {}, showModal(o) { global.__modal = o; }, showActionSheet() {}, setNavigationBarTitle() {}, navigateTo(o) { global.__nav = (global.__nav || []).concat((o && o.url) || ''); }, switchTab() {},
  navigateBack() {}, redirectTo() {}, setClipboardData() {},
  authorize({ success }) { if (success) success(); },
  requirePrivacyAuthorize({ success, fail }) { global.__privacyCalls = (global.__privacyCalls || 0) + 1; if (global.__privacyReject) return fail({ errMsg: 'requirePrivacyAuthorize:fail user reject' }); success(); },
  openPrivacyContract() {},
  createInnerAudioContext() {
    const ctx = { src: '', played: 0, play() { this.played += 1; }, stop() {}, onEnded() {}, onError() {}, destroy() {} };
    global.__audioCtx = ctx;
    return ctx;
  },
  downloadFile({ url, filePath, success }) {
    localFiles.add(filePath);
    success({ statusCode: 200, tempFilePath: filePath, filePath, url });
  },
  getFileSystemManager() {
    return {
      mkdirSync() {},
      accessSync(p) { if (!localFiles.has(p)) throw new Error('nofile'); }
    };
  },
  getNetworkType({ success }) { success({ networkType: global.__net || 'wifi' }); },
  getUpdateManager() { return global.__um; },
  getRecorderManager() {
    return { start() {}, stop() {}, onStop() {}, onError() {} };
  },
  cloud: {
    init() {},
    callFunction({ data, success, fail }) {
      handle(data.action, data.data, { openid: simOpenid, db, deepseek, azure, storage })
        .then((result) => success({ result }))
        .catch((e) => fail({ errMsg: e.message }));
    },
    uploadFile({ cloudPath, success, fail }) {
      storage.upload(cloudPath, Buffer.alloc(16))
        .then((fileID) => success({ fileID }))
        .catch((e) => fail && fail({ errMsg: e.message }));
    }
  }
};
// 假的版本更新管理器：记录回调，测试里手动触发
const umCbs = {};
global.__um = {
  onCheckForUpdate(cb) { umCbs.check = cb; },
  onUpdateReady(cb) { umCbs.ready = cb; },
  onUpdateFailed(cb) { umCbs.fail = cb; },
  applyUpdate() { global.__applied = true; }
};

const pages = [];
global.Page = (cfg) => { cfg.getTabBar = () => ({ setData() {}, select() {} }); pages.push(cfg); };
global.Component = (cfg) => { global.__components = (global.__components || []).concat(cfg); };
global.getApp = () => ({ globalData: {} });
global.getCurrentPages = () => [];
global.App = (cfg) => { global.__app = cfg; };

// 先填云环境，再加载依赖 config 的模块
require(path.join(root, 'config.js')).cloudEnv = 'sim-env';

const progress = require(path.join(root, 'utils/progress.js'));
const quiz = require(path.join(root, 'utils/quiz.js'));
const plan = require(path.join(root, 'data/plan.js'));
const vocab = require(path.join(root, 'data/vocab.js'));
const api = require(path.join(root, 'utils/api.js'));
const sync = require(path.join(root, 'utils/sync.js'));
const audio = require(path.join(root, 'utils/audio.js'));

['index/index', 'lessons/lessons', 'lesson/lesson', 'review/review', 'quiz/quiz', 'plan/plan', 'coach/coach', 'fidel/fidel', 'profile/profile', 'search/search', 'speak/speak', 'admin/admin', 'login/login', 'privacy/privacy']
  .forEach((p) => require(path.join(root, 'pages', p + '.js')));
assert.equal(pages.length, 14, 'pages loaded');
// 自定义 tabBar：AI 教练下线后不应出现在底部导航
require(path.join(root, 'custom-tab-bar/index.js'));
const tabBar = global.__components[global.__components.length - 1];
const tabPaths = tabBar.data.list.map((t) => t.pagePath);
assert.equal(tabPaths.indexOf('/pages/coach/coach'), -1, 'AI 教练不在底部导航里');
assert.equal(tabPaths.length, 4, '底部导航剩 4 个 Tab');
assert.deepEqual(tabPaths, ['/pages/index/index', '/pages/lessons/lessons', '/pages/review/review', '/pages/profile/profile']);

const update = require(path.join(root, 'utils/update.js'));
require(path.join(root, 'app.js'));
global.__app.onLaunch();

// 版本更新：启动即开始检查
assert.equal(update.status(), 'checking', '启动后进入检查中');
umCbs.check({ hasUpdate: true });
assert.equal(update.status(), 'downloading', '发现新版本');
umCbs.ready();
assert.equal(update.status(), 'ready', '新版下载完成');
assert.ok(global.__modal && /重启/.test(global.__modal.content), '下载完成后弹框提示重启');
global.__modal.success({ confirm: true });
assert.equal(global.__applied, true, '用户确认后重启到新版');
// 关于页「检查更新」：新版已就绪时再问一次
global.__modal = null;
assert.match(update.checkNow(), /重启/, '按钮汇报当前状态');
assert.ok(global.__modal, '已就绪时按钮直接弹重启框');

async function main() {
  // 学习流程
  progress.learnUnit('u01');
  const due = progress.dueCards();
  assert.equal(due.length, 15, '每日新卡上限 15');
  progress.gradeCard(due[0].id, 5); progress.gradeCard(due[1].id, 1); progress.gradeCard(due[2].id, 3);
  assert.equal(progress.dueCards().length, 12);
  const q = quiz.buildQuiz('u01', 10, progress.load());
  assert.equal(q.length, 10);
  assert.ok(q[0].options.some((o) => o.id === q[0].answer));
  progress.recordQuiz('u01', 8, 10);
  progress.addMinutes(12);
  progress.completeMission('w1');
  const s = progress.summary();
  assert.equal(s.streak, 1);
  assert.equal(plan.planOutline().weeks.length, 8);
  plan.weeks.forEach((w) => w.units.forEach((id) => assert.ok(vocab.getUnit(id), 'unit ' + id)));

  // 工作沟通主线：16 个单元，自选单元可取、第 5 天出现且为 optional，大纲含 extra 与 33 分钟
  assert.equal(vocab.units.length, 16, '16 个单元');
  plan.weeks.forEach((w) => { if (w.extra) assert.ok(vocab.getUnit(w.extra), 'extra unit ' + w.extra); });
  assert.ok(plan.getDayTasks(2, 5).some((t) => t.optional === true && t.unit === 'u13'), '第 2 周第 5 天含自选 u13');
  assert.equal(plan.planOutline().weeks[1].extra, 'u13', '大纲第 2 周 extra 为 u13');
  assert.equal(plan.planOutline().dailyMinutes, 33, '每日 33 分钟');

  // 今日页
  const indexPage = pages[0];
  indexPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  indexPage.data = {};
  indexPage.refresh();
  assert.ok(indexPage.data.tasks.length >= 2);

  // 搜索页
  const searchPage = pages[9];
  searchPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  searchPage.data = { q: '', results: [], recent: [] };
  searchPage.search('多少钱');
  assert.equal(searchPage.data.results[0].am, 'ስንት ነው?');

  // 云函数链路：同步
  assert.equal(api.configured(), true);
  assert.equal(await sync.syncNow(), true, '首次同步应上传');
  assert.equal(await sync.syncNow(), false, '未变化不重复上传');
  const fetched = await api.fetchProgress();
  assert.equal(fetched.progress.unitsLearned.u01, progress.load().unitsLearned.u01);

  // 登录门槛：未登录不能用 AI / 语音；微信登录（注册）后可用；第一个登录者自动成为管理员
  await assert.rejects(api.diagnose(s, plan.planOutline()), (e) => /登录/.test(e.message), '未登录被拒');
  await assert.rejects(api.ttsGet('ሰላም', 'female', 'normal'), (e) => /登录/.test(e.message), '未登录不能朗读');
  const me0 = await api.me();
  assert.equal(me0.registered, false);
  // 首页：未登录用户进入时不得被引导去登录（微信审核要求先体验后授权）
  const home = pages[0];
  home.data = { ...home.data };
  home.setData = function (d) { Object.assign(this.data, d); };
  global.__nav = [];
  home.loadNotices();
  assert.equal(global.__nav.filter((u) => /login/.test(u)).length, 0, '首页不跳登录页');
  assert.equal(home.data.needNickname, false, '未登录用户首页不提示填昵称');

  // 登录页：隐私同意默认不勾选，不勾选不登记、不调授权接口
  const loginPage = pages[12];
  loginPage.data = { ...loginPage.data, configured: true };
  loginPage.setData = function (d) { Object.assign(this.data, d); };
  assert.equal(loginPage.data.agreed, false, '隐私同意默认不勾选');
  await loginPage.login();
  assert.match(loginPage.data.error, /勾选/, '未勾选时提示用户先勾选');
  assert.equal(global.__privacyCalls, undefined, '未勾选不触发隐私授权');
  assert.equal((await api.me()).registered, false, '未勾选不登记');

  // 用户主动勾选后才能登录；拒绝微信隐私授权仍然不登记
  loginPage.onAgree({ detail: { value: ['1'] } });
  assert.equal(loginPage.data.agreed, true, '勾选后可登录');
  global.__privacyReject = true;
  await loginPage.login();
  assert.equal(global.__privacyCalls, 1, '勾选后才调用 requirePrivacyAuthorize');
  assert.ok(/隐私/.test(loginPage.data.error), '拒绝隐私授权时提示');
  assert.equal((await api.me()).registered, false, '拒绝隐私授权后未登记');
  global.__privacyReject = false;
  const reg = await api.register('李工');
  assert.equal(reg.registered, true);
  assert.equal(reg.nickname, '李工');
  assert.equal(reg.isAdmin, true, '环境变量没配管理员时，第一个登录的人成为管理员');
  const me1 = await api.me();
  assert.equal(me1.isAdmin, true);

  // 云函数链路：AI
  const diag = await api.diagnose(s, plan.planOutline());
  assert.equal(diag.score, 50);
  // 小程序端已移除 AI 问答（微信个人主体未开放深度合成类目）；云函数接口保留，直接验证
  const chatRes = await handle('ai.chat', { messages: [{ role: 'user', content: '你好怎么说' }], summary: s }, { openid: simOpenid, db, deepseek, azure, storage });
  const chat = chatRes.data;
  assert.match(chat.reply, /ሰላም/);
  const hist = await api.aiHistory();
  assert.equal(hist.history.length, 1);
  assert.equal(hist.history[0].type, 'diagnosis');

  // 教练页 diagnose() 走完整路径
  const coach = pages[6];
  coach.setData = function (d) { this.data = { ...this.data, ...d }; };
  coach.data = { selfReport: '', diagnosis: null, adjustment: null, loading: '', request: '' };
  await coach.diagnose();
  assert.equal(coach.data.diagnosis.score, 50);
  assert.equal(coach.data.loading, '');

  // 语音：朗读走云端合成 + 本地缓存
  const deepseekCallsBefore = deepseek.calls.length;
  await audio.speak('ሰላም');
  assert.ok(global.__audioCtx, 'InnerAudioContext created');
  assert.equal(global.__audioCtx.played, 1, '首次朗读播放一次');
  assert.equal(azure.synthCalls.length, 1, '首次朗读调用 Azure 合成');
  assert.equal(azure.synthCalls[0].text, 'ሰላም');
  await audio.speak('ሰላም');
  assert.equal(global.__audioCtx.played, 2, '第二次朗读仍播放（单例累计）');
  assert.equal(azure.synthCalls.length, 1, '第二次朗读走本地缓存，不再合成');
  assert.equal(deepseek.calls.length, deepseekCallsBefore, '朗读不触发 DeepSeek');
  assert.equal(storage._files.size, 1, 'tts 音频已上传云存储');

  // 语音：小测每 3 题含 1 题听力题
  const q9 = quiz.buildQuiz('u01', 9, progress.load());
  assert.equal(q9.length, 9);
  assert.equal(q9[2].listen, true, '第 3 题为听力题');
  assert.ok(q9[2].audioText, '听力题带朗读文本');
  assert.equal(q9[2].promptAm, '', '听力题题面不显示阿姆哈拉语');
  assert.ok(!q9[0].listen && !q9[1].listen, '前两题非听力题');
  [5, 8].forEach((i) => assert.equal(q9[i].listen, true, `第 ${i + 1} 题为听力题`));

  // 语音：跟读评分链路（上传 → stt.score → 删除文件）
  const fileID = await new Promise((resolve, reject) => wx.cloud.uploadFile({
    cloudPath: 'stt/sim.wav', filePath: '/tmp/sim/rec.wav', success: (r) => resolve(r.fileID), fail: reject
  }));
  assert.ok(storage._files.has(fileID), '录音已上传');
  const scored = await api.sttScore(fileID, 'ሰላም');
  assert.equal(scored.score, 100, '识别一致得 100 分');
  assert.equal(scored.transcript, 'ሰላም');
  assert.deepEqual(scored.words, [{ w: 'ሰላም', ok: true }]);
  assert.equal(azure.recogCalls.length, 1, '调用一次 Azure 识别');
  assert.equal(storage._files.has(fileID), false, '评分后录音文件已删除');

  // 语音：跟读页可加载并展示词句
  const speakPage = pages[10];
  speakPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  speakPage.data = { item: null, canRecord: true, recording: false, tempFilePath: '', loading: false, result: null, scoreClass: '' };
  speakPage.onLoad({ id: vocab.getUnit('u01').items[0].id });
  assert.equal(speakPage.data.item.id, vocab.getUnit('u01').items[0].id, '跟读页加载词句');

  // 新学工作场景单元（放在同步断言之后，避免影响"未变化不重复上传"）
  progress.learnUnit('u14');
  assert.ok(progress.load().unitsLearned.u14, 'u14 已学');

  // 管理端：昵称、公告、用户列表、系统面板、摘要同步
  simOpenid = 'colleague';
  await assert.rejects(api.adminUsers(), (e) => /无权限/.test(e.message), '非管理员被拒');
  const reg2 = await api.register('王工');
  assert.equal(reg2.isAdmin, false, '第二个登录者不是管理员');
  simOpenid = 'sim-user';
  const adminList = await api.adminUsers();
  assert.equal(adminList.users.length, 2, '管理员能看到两个用户');
  const meRow = adminList.users.find((u) => u.isSelf);
  assert.ok(meRow, '列表含本人');
  assert.equal(meRow.nickname, '李工');
  await api.adminSetAnnouncement('周五实战');
  const ann = await api.announcement();
  assert.equal(ann.text, '周五实战');
  const sys = await api.adminSystem();
  assert.equal(sys.aiDaily.length, 14);
  assert.ok(typeof sys.ttsCache.count === 'number');
  progress.addMinutes(1); // 触发进度变化后同步，带 meta
  assert.equal(await sync.syncNow(), true, '进度变化后再次上传');
  const userDoc = db._users.get('sim-user');
  assert.ok(userDoc, 'users 摘要已写入');
  assert.equal(userDoc.stars, progress.load().stars || 0, '摘要 stars 与本地一致');

  // 用量与配额
  const usage = await api.usageGet();
  assert.ok(usage.ai && typeof usage.ai.used === 'number' && usage.ai.limit === 20, 'usage.get 结构');
  assert.equal(usage.isAdmin, true, '引导产生的管理员身份在 usage.get 里可见');
  simOpenid = 'colleague';
  await assert.rejects(api.adminUsage(), (e) => /无权限/.test(e.message));
  simOpenid = 'sim-user';
  const team = await api.adminUsage();
  assert.ok(team.users.some((u) => u.openid === 'sim-user'));
  // 环境变量名单一旦配置则优先于数据库引导
  process.env.ADMIN_OPENIDS = 'someone-else';
  assert.equal((await api.me()).isAdmin, false, '环境变量指定了别人，引导管理员失效');
  delete process.env.ADMIN_OPENIDS;

  // 网络：断网时预检直接提示；连接失败归成一句网络提示
  global.__net = 'none';
  await assert.rejects(api.diagnose({}, {}), (e) => e.code === 'OFFLINE' && /没有网络/.test(e.message));
  global.__net = 'wifi';
  const realCall0 = wx.cloud.callFunction;
  wx.cloud.callFunction = ({ fail }) => fail({ errMsg: 'cloud.callFunction:fail Error: errCode: -601001 | errMsg: request:fail -2:net::ERR_NAME_NOT_RESOLVED' });
  await assert.rejects(api.diagnose({}, {}), (e) => e.code === 'NETWORK' && /网络连接失败/.test(e.message));
  wx.cloud.callFunction = realCall0;

  // 云函数失败信息归一成一句可照做的提示
  const realCall = wx.cloud.callFunction;
  wx.cloud.callFunction = ({ fail }) => fail({ errMsg: 'cloud.callFunction:fail Error: errCode: -504003 | errMsg: Invoking task timed out after 3 seconds (callId: x) (trace: y)' });
  await assert.rejects(api.diagnose({}, {}), (e) => e.code === 'TIMEOUT' && /超时时间调到 60 秒/.test(e.message) && e.message.length < 60);
  wx.cloud.callFunction = ({ fail }) => fail({ errMsg: 'cloud.callFunction:fail Error: errCode: -504002 | errMsg: FUNCTION_NOT_FOUND' });
  await assert.rejects(api.diagnose({}, {}), (e) => e.code === 'NOT_DEPLOYED');
  wx.cloud.callFunction = realCall;

  // 未配置云环境时的失败路径
  require(path.join(root, 'config.js')).cloudEnv = '';
  await assert.rejects(api.diagnose(s, {}), (e) => e.code === 'NO_ENV');

  console.log('OK: miniprogram simulation passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
