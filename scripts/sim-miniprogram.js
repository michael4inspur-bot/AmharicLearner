// 模拟微信运行环境，跑通小程序核心逻辑与云函数调用链路。用法：node scripts/sim-miniprogram.js
const path = require('path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..', 'miniprogram');
const fnRoot = path.join(__dirname, '..', 'cloudfunctions', 'api');
const { handle } = require(path.join(fnRoot, 'handler.js'));
const { createFakeDb } = require(path.join(fnRoot, 'test', 'fakeDb.js'));
const { createFakeAzure } = require(path.join(fnRoot, 'test', 'fakeAzure.js'));
const { createFakeStorage } = require(path.join(fnRoot, 'test', 'fakeStorage.js'));

const db = createFakeDb({ registered: false }); // 严格：必须先登录（注册）才能用 AI / 语音
let simOpenid = 'sim-user';
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
    // 与真机一致：没设置过 src 就 stop，基础库会通过 onError 报 audioInstance is not set
    const ctx = { src: '', played: 0, stops: 0, destroyed: false, play() { this.played += 1; global.__audioPlays = (global.__audioPlays || 0) + 1; }, stop() { this.stops += 1; if (!this.src && this._onError) this._onError({ errMsg: 'operateAudio:fail audioInstance is not set', errCode: -1 }); }, onEnded() {}, onError(cb) { this._onError = cb; }, destroy() { this.destroyed = true; } };
    global.__audioCtxs = (global.__audioCtxs || []).concat(ctx);
    global.__audioCtx = ctx;
    return ctx;
  },
  downloadFile({ url, filePath, success }) {
    localFiles.add(filePath);
    success({ statusCode: 200, tempFilePath: filePath, filePath, url });
  },
  setInnerAudioOption(o) { global.__audioOption = o; },
  getFileSystemManager() {
    return {
      mkdirSync() {},
      accessSync(p) { if (!localFiles.has(p)) throw new Error('nofile'); }
    };
  },
  getNetworkType({ success }) { success({ networkType: global.__net || 'wifi' }); },
  getUpdateManager() { return global.__um; },
  stopPullDownRefresh() { global.__pullStops = (global.__pullStops || 0) + 1; },
  getRecorderManager() {
    return { start() {}, stop() {}, onStop() {}, onError() {} };
  },
  cloud: {
    init() {},
    callFunction({ data, success, fail }) {
      global.__calls = (global.__calls || []).concat(data.action);
      // 阿姆哈拉语绝不探测 tts.caps（旧云函数照常可用）；整个模拟过程累计，结尾断言为 0
      if (data.action === 'tts.caps' && langs.current() === 'am') global.__amCaps = (global.__amCaps || 0) + 1;
      handle(data.action, data.data, { openid: simOpenid, db, azure, storage })
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
// 模拟会走奥罗莫语（试用版）流程：不受提审开关 showBetaLangs 影响
require(path.join(root, 'config.js')).showBetaLangs = true;

const progress = require(path.join(root, 'utils/progress.js'));
const quiz = require(path.join(root, 'utils/quiz.js'));
const langs = require(path.join(root, 'langs/index.js'));
const vocab = langs.pack('am');
const plan = vocab.plan;
const api = require(path.join(root, 'utils/api.js'));
const sync = require(path.join(root, 'utils/sync.js'));
const audio = require(path.join(root, 'utils/audio.js'));

const PAGE_NAMES = ['index/index', 'lessons/lessons', 'lesson/lesson', 'review/review', 'quiz/quiz', 'plan/plan', 'fidel/fidel', 'qubee/qubee', 'profile/profile', 'search/search', 'speak/speak', 'admin/admin', 'login/login', 'privacy/privacy'];
PAGE_NAMES.forEach((p) => require(path.join(root, 'pages', p + '.js')));
/** 按页面名取 Page 配置，避免下标随页面增删错位 */
const pageOf = (name) => pages[PAGE_NAMES.indexOf(name)];
assert.equal(pages.length, 14, 'pages loaded');
// 自定义 tabBar：AI 教练下线后不应出现在底部导航
require(path.join(root, 'custom-tab-bar/index.js'));
const tabBar = global.__components[global.__components.length - 1];
const tabPaths = tabBar.data.list.map((t) => t.pagePath);
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
  assert.equal(progress.streak(), 1);
  assert.equal(plan.planOutline().weeks.length, 8);
  plan.weeks.forEach((w) => w.units.forEach((id) => assert.ok(vocab.getUnit(id), 'unit ' + id)));

  // 工作沟通主线：16 个单元，自选单元可取、第 5 天出现且为 optional，大纲含 extra 与 33 分钟
  assert.equal(vocab.units.length, 16, '16 个单元');
  plan.weeks.forEach((w) => { if (w.extra) assert.ok(vocab.getUnit(w.extra), 'extra unit ' + w.extra); });
  assert.ok(plan.getDayTasks(2, 5).some((t) => t.optional === true && t.unit === 'u13'), '第 2 周第 5 天含自选 u13');
  assert.equal(plan.planOutline().weeks[1].extra, 'u13', '大纲第 2 周 extra 为 u13');
  assert.equal(plan.planOutline().dailyMinutes, 33, '每日 33 分钟');
  assert.ok(plan.getDayTasks(1, 1).some((t) => t.type === 'alphabet' && t.group === 1 && /Fidel 字母表 第 1 批/.test(t.title)), '字母任务按语言包命名');
  assert.equal(vocab.alphabet.page, '/pages/fidel/fidel');

  // 今日页
  const indexPage = pageOf('index/index');
  indexPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  indexPage.data = {};
  indexPage.refresh();
  assert.ok(indexPage.data.tasks.length >= 2);

  // 搜索页
  const searchPage = pageOf('search/search');
  searchPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  searchPage.data = { q: '', results: [], recent: [] };
  searchPage.search('多少钱');
  assert.equal(searchPage.data.results[0].text, 'ስንት ነው?');

  // 界面文案来自语言包，不写死在模板里
  const L = langs.meta('am').strings;
  searchPage.onLoad();
  assert.equal(searchPage.data.L.searchPlaceholder, L.searchPlaceholder, '搜索页文案来自语言包');
  assert.equal(searchPage.data.tc, 'am', '埃塞文字用 .am 字体类');
  const reviewPage = pageOf('review/review');
  reviewPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  reviewPage.data = { ...reviewPage.data };
  reviewPage.onShow();
  assert.equal(reviewPage.data.L.modeShort, '看阿');
  assert.equal(reviewPage.data.mode, 'text', '复习默认模式改名为 text');

  // 同步：未登记不上传（用户还没勾选隐私同意）
  assert.equal(api.configured(), true);
  assert.equal(await sync.syncNow(), false, '未登记不上传学习数据');

  // 登录门槛：未登录不能用 AI / 语音；微信登录（注册）后可用；第一个登录者自动成为管理员
  await assert.rejects(api.ttsBatch([{ id: 'a', text: 'ሰላም' }], 'female', 'normal'), (e) => /登录/.test(e.message), '未登录被拒');
  await assert.rejects(api.ttsGet('ሰላም', 'female', 'normal'), (e) => /登录/.test(e.message), '未登录不能朗读');
  // 未登录点朗读：弹出带「去登录」的提示，而不是一句看不懂的「语音暂时不可用」
  global.__modal = null;
  await audio.speak('ሰላም');
  assert.ok(global.__modal, '未登录点朗读会给出提示');
  assert.match(global.__modal.title, /登录/, '提示说明是登录问题');
  assert.equal(global.__modal.confirmText, '去登录', '提示带去登录入口');

  // 未登录做小测：不能出听力题（题面是空的），也不能自动弹登录框
  global.__modal = null;
  const offlineQuiz = quiz.buildQuiz('u01', 10, progress.load(), false);
  assert.equal(offlineQuiz.filter((q) => q.listen).length, 0, '未登录时小测没有听力题');
  offlineQuiz.forEach((q) => assert.ok(q.prompt, '每道题都有题面'));
  await audio.speak('ሰላም', { silent: true });
  assert.equal(global.__modal, null, '自动播放失败不弹登录框');
  // 干扰项不得出现文字完全相同的选项
  quiz.buildQuiz('all', 10, progress.load(), true).forEach((q) => {
    const texts = q.options.map((o) => o.text);
    assert.equal(new Set(texts).size, texts.length, '选项文字互不相同');
  });

  // 跟读页：录音之前就提示要登录，而不是录完上传才被拒
  const speakEarly = pageOf('speak/speak');
  speakEarly.data = { ...speakEarly.data };
  speakEarly.setData = function (d) { Object.assign(this.data, d); };
  speakEarly.onShow();
  assert.equal(speakEarly.data.needLogin, true, '未登录时跟读页提前提示');

  // 未登记时改昵称只存本地，不得在云端凭空建账号
  const profPage = pageOf('profile/profile');
  profPage.data = { ...profPage.data, registered: false };
  profPage.setData = function (d) { Object.assign(this.data, d); };
  global.__calls = [];
  profPage.onNickname({ detail: { value: '临时昵称' } });
  assert.equal(global.__calls.indexOf('user.setProfile'), -1, '未登记不同步昵称到云端');
  const me0 = await api.me();
  assert.equal(me0.registered, false);
  // 首页：未登录用户进入时不得被引导去登录（微信审核要求先体验后授权）
  const home = pageOf('index/index');
  home.data = { ...home.data };
  home.setData = function (d) { Object.assign(this.data, d); };
  global.__nav = [];
  home.loadNotices();
  assert.equal(global.__nav.filter((u) => /login/.test(u)).length, 0, '首页不跳登录页');
  assert.equal(home.data.needNickname, false, '未登录用户首页不提示填昵称');

  // 首页下拉刷新：刷新数据并汇报版本状态，结束后必须关掉下拉动画
  global.__modal = null;
  await home.onPullDownRefresh();
  assert.equal(global.__pullStops, 1, '下拉刷新结束后调用 stopPullDownRefresh');
  assert.ok(global.__modal && /重启/.test(global.__modal.content), '新版已就绪时下拉刷新弹出重启确认');

  // 登录页：隐私同意默认不勾选，不勾选不登记、不调授权接口
  const loginPage = pageOf('login/login');
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
  // 引导管理员需要显式开关，否则提审时第一个打开的人（可能是审核员）会成为管理员
  process.env.ALLOW_ADMIN_BOOTSTRAP = '1';
  const reg = await api.register('李工');
  assert.equal(reg.registered, true);
  assert.equal(reg.nickname, '李工');
  assert.equal(reg.isAdmin, true, '显式开启引导时，第一个登录的人成为管理员');
  const me1 = await api.me();
  assert.equal(me1.isAdmin, true);

  // 登记之后才开始同步；空进度永远不上传（否则换设备一开一关就覆盖云端）
  wx.setStorageSync('profile_v1', { ...(wx.getStorageSync('profile_v1') || {}), registered: true, openid: simOpenid });
  assert.equal(await sync.syncNow(), true, '登记后首次同步应上传');
  assert.equal(await sync.syncNow(), false, '未变化不重复上传');
  const fetched = await api.fetchProgress();
  assert.equal(fetched.progress.unitsLearned.u01, progress.load().unitsLearned.u01);
  // 云端快照缺 stars/badges 时，恢复不得把本机已得的星星和徽章清零
  const withStars = { ...progress.load(), stars: 120, badges: { 'first-words': '2026-09-29' } };
  progress.replace(withStars);
  progress.replace({ ...progress.load(), stars: undefined, badges: undefined });
  assert.equal(progress.load().stars, 120, '云端没有 stars 时保留本机星星');
  assert.ok(progress.load().badges['first-words'], '云端没有 badges 时保留本机徽章');
  // 畸形快照不能让页面崩
  progress.replace({ logs: null, srs: null, quizScores: {}, startDate: 'bad' });
  assert.equal(progress.streak(), 0, '畸形进度不抛错');
  assert.equal(progress.dueCards().length, 0);
  assert.ok(progress.srsStats());
  progress.replace(withStars);

  const realProgress = progress.load();
  progress.reset();
  assert.equal(progress.isEmpty(), true, '重置后是空进度');
  assert.equal(await sync.syncNow(), false, '空进度不上传，不会覆盖云端');
  progress.replace(realProgress);
  // 多语言：用已注册的奥罗莫语包，验证进度与云端文档按语言分开
  const omWord = langs.pack('om').getUnit('om-u01').items[0].text;
  assert.equal(progress.keyOf('am'), 'progress_v1', '阿姆哈拉语沿用老键名');
  assert.equal(progress.keyOf('om'), 'progress_om_v1');
  const amUnitsBefore = JSON.stringify(progress.load().unitsLearned);

  // 旧版云函数不回显 lang：不能把奥罗莫语进度传上去（会写进阿姆哈拉语文档）
  const realCallOld = wx.cloud.callFunction;
  const oldCloudActions = [];
  wx.cloud.callFunction = ({ data, success }) => {
    oldCloudActions.push(data.action);
    success({ result: { ok: true, data: data.action === 'progress.get' ? { progress: null, updatedAt: null } : { updatedAt: 'x' } } });
  };
  // 没有语音的语言（用测试语言 xx 代替：奥罗莫语已有语音）：朗读 / 预取不发任何 tts 请求，只在主动点时提示即将上线
  langs.register('xx', { ...langs.pack('om'), meta: { ...langs.meta('om'), code: 'xx', audio: false } });
  langs.set('xx');
  const ttsCalls = [];
  const cfBefore = wx.cloud.callFunction;
  wx.cloud.callFunction = (o) => { if (/^tts\./.test(o.data.action)) ttsCalls.push(o.data.action); return cfBefore(o); };
  const toasts = [];
  const realToast = wx.showToast;
  wx.showToast = (o) => { toasts.push(o.title); };
  await audio.speak(omWord);
  assert.equal(toasts.length, 1, '主动点一次提示一次');
  assert.match(toasts[0], /发音即将上线/);
  await audio.speak(omWord, { silent: true });
  assert.equal(toasts.length, 1, 'silent 不提示');
  audio.prefetch([{ id: 'x', text: omWord }]);
  await new Promise((r) => setTimeout(r, 20));
  wx.showToast = realToast;
  wx.cloud.callFunction = cfBefore;
  assert.deepEqual(ttsCalls, [], '没有语音的语言不发任何 tts 请求');
  assert.equal(langs.view().audio, false);
  assert.ok(!quiz.buildQuiz('om-u01', 10, progress.load(), langs.meta().audio).some((q) => q.listen), '没有语音的语言不出听音题');
  langs.set('om');
  langs.unregister('xx');
  progress.learnUnit('om-u01');
  assert.equal(await sync.syncNow(), false, '云端不支持多语言时不上传');
  assert.ok(!oldCloudActions.includes('progress.put'), '一次 progress.put 都没发');
  wx.cloud.callFunction = realCallOld;

  // 新版云函数：奥罗莫语进度写到 openid:om，阿姆哈拉语文档不受影响
  assert.equal(await sync.syncNow(), false, '刚探测过不支持，10 分钟内不再探测');
  assert.equal(await sync.cloudSupports('om', { force: true }), true, 'force 立即重新探测');
  assert.ok(progress.load().srs['om-u01-01'], '奥罗莫语进度在奥罗莫语存储里');
  assert.equal(await sync.syncNow(), true, '云端支持后上传');
  const omDoc = await db.getProgress(`${simOpenid}:om`);
  assert.ok(omDoc && omDoc.progress.srs['om-u01-01'], '云端奥罗莫语文档');
  const amDoc = await db.getProgress(simOpenid);
  assert.ok(!amDoc.progress.srs['om-u01-01'], '阿姆哈拉语文档没混进奥罗莫语');
  const omFetched = await api.fetchProgress('om');
  assert.equal(omFetched.lang, 'om');
  assert.ok(omFetched.progress.unitsLearned['om-u01']);

  // 进度对象绑定到它所属的语言：切换语言后再保存，也不会写进另一种语言
  const omHeld = progress.load();
  langs.set('am');
  omHeld.stars = 7;
  progress.save(omHeld, 'om');
  assert.notEqual(progress.load().stars, 7, '阿姆哈拉语进度没被写入');
  assert.equal(progress.load('om').stars, 7, '奥罗莫语进度按指定语言保存');
  langs.set('om');
  // 切后台时两种语言都同步
  progress.addMinutes(1);
  langs.set('am');
  progress.addMinutes(1);
  const flushed = await sync.flushPending();
  assert.ok(flushed.length >= 2 && flushed.every((r) => r === true), '切后台时所有有改动的语言都上传');

  // 切回阿姆哈拉语，原进度完好
  langs.set('am');
  assert.equal(JSON.stringify(progress.load().unitsLearned), amUnitsBefore, '切回后阿姆哈拉语进度不变');
  assert.ok(!progress.load().srs['om-u01-01']);
  assert.ok(wx.getStorageSync('progress_om_v1').srs['om-u01-01'], '奥罗莫语进度存在自己的键下');

  // 进行中的上传结束后，期间新增的改动还要再传一次
  langs.set('am');
  progress.addMinutes(1);
  // 第一次 progress.put 发出（内容按发出时的快照）之后，上传还没结束时进度又改了
  const cfResync = wx.cloud.callFunction;
  let changedMidFlight = false;
  wx.cloud.callFunction = (o) => {
    if (o.data.action === 'progress.put' && !changedMidFlight) {
      changedMidFlight = true;
      const snapshot = { ...o, data: JSON.parse(JSON.stringify(o.data)) };
      progress.addMinutes(1);
      return cfResync(snapshot);
    }
    return cfResync(o);
  };
  assert.equal(await sync.syncNow(), true);
  await new Promise((r) => setTimeout(r, 20)); // 不依赖 3 秒的延迟同步：靠结束后的再同步
  wx.cloud.callFunction = cfResync;
  assert.ok(changedMidFlight, '上传期间改过进度');
  const amCloud = await db.getProgress(simOpenid);
  assert.equal(JSON.stringify(amCloud.progress.logs), JSON.stringify(progress.load().logs), '上传期间的改动也传上去了');
  // 探测只有拿到答复才进入退避：网络失败后立刻再探测要重新发 progress.get
  langs.register('zz', { ...langs.pack('om'), meta: { ...langs.meta('om'), code: 'zz' } });
  const cfProbe = wx.cloud.callFunction;
  let probeGets = 0;
  wx.cloud.callFunction = (o) => {
    if (o.data.action === 'progress.get') { probeGets += 1; o.fail({ errMsg: 'request:fail timeout' }); return; }
    cfProbe(o);
  };
  assert.equal(await sync.cloudSupports('zz'), false, '网络失败按不支持处理');
  assert.equal(await sync.cloudSupports('zz'), false);
  assert.equal(probeGets, 2, '网络失败不进入退避：立刻再探测会再发一次 progress.get');
  wx.cloud.callFunction = cfProbe;
  langs.unregister('zz');
  // 只有一种语言可选时隐藏切换入口
  const langSwitch2 = require(path.join(root, 'utils/lang-switch.js'));
  assert.equal(langSwitch2.available(), true);
  const cfg = require(path.join(root, 'config.js'));
  cfg.showBetaLangs = false;
  assert.equal(langSwitch2.available(), false, '奥罗莫语隐藏后不显示切换入口');
  cfg.showBetaLangs = true;
  // 第 8 周全表自测打开全部批次
  assert.equal(langs.pack('am').plan.getDayTasks(8, 6).find((t) => t.type === 'alphabet').group, 0);

  // 全表自测（group 0）：字母页保持 0 并显示全部批次；缺省 / 非法值回到第 1 批
  assert.equal(langs.current(), 'am');
  const fidelPage = pageOf('fidel/fidel');
  const mkFidel = () => Object.assign(Object.create(fidelPage), { data: { ...fidelPage.data }, setData(d) { this.data = { ...this.data, ...d }; } });
  const fd0 = mkFidel();
  fd0.onLoad({ group: '0' });
  assert.equal(fd0.data.group, 0, 'Fidel 页 group=0 不被改成 1');
  assert.deepEqual([...new Set(fd0.data.rows.map((c) => c.group))].sort(), [1, 2, 3, 4, 5], 'Fidel 全表覆盖 1..5 批');
  const fd3 = mkFidel();
  fd3.onLoad({ group: '3' });
  assert.equal(fd3.data.group, 3);
  ['', 'x', '9', '-1', '1.5'].forEach((bad) => { const f = mkFidel(); f.onLoad({ group: bad }); assert.equal(f.data.group, 1, `非法 group「${bad}」回到第 1 批`); });
  const fdNone = mkFidel();
  fdNone.onLoad({});
  assert.equal(fdNone.data.group, 1, '缺省 group 回到第 1 批');
  // 首页全表自测任务：只过 1-4 批不算完成，5 批全过才算
  const homeDec = Object.create(pageOf('index/index'));
  const fullTask = langs.pack('am').plan.getDayTasks(8, 6).find((t) => t.type === 'alphabet');
  const freshP = { unitsLearned: {}, quizScores: [], missions: {}, reflections: {}, fidelGroupsDone: { 1: true, 2: true, 3: true, 4: true } };
  assert.equal(homeDec.decorate(fullTask, freshP, { due: 0, total: 0 }).done, false, '只过 1-4 批：全表自测未完成');
  freshP.fidelGroupsDone[5] = true;
  assert.equal(homeDec.decorate(fullTask, freshP, { due: 0, total: 0 }).done, true, '5 批全过：全表自测完成');
  const batch2 = { ...fullTask, group: 2 };
  assert.equal(homeDec.decorate(batch2, { ...freshP, fidelGroupsDone: { 2: true } }, { due: 0, total: 0 }).done, true, '单批任务仍按该批判断');

  // Qubee 字母页：只从奥罗莫语进入；通过小测只写奥罗莫语进度
  const qubeePage = pageOf('qubee/qubee');
  const mkQubee = () => Object.assign(Object.create(qubeePage), { data: { ...qubeePage.data }, setData(d) { this.data = { ...this.data, ...d }; } });
  const realBack = wx.navigateBack;
  let backs = 0;
  wx.navigateBack = () => { backs += 1; };
  const realRedirect = wx.redirectTo;
  const redirects = [];
  wx.redirectTo = (o) => { redirects.push(o.url); };
  const realPages = global.getCurrentPages;
  global.getCurrentPages = () => [{}, {}];
  const qbAm = mkQubee();
  qbAm.onLoad({ group: '1' });
  assert.equal(backs, 1, '阿姆哈拉语下打开 Qubee 页直接返回');
  assert.equal(qbAm.data.groups.length, 0, '返回前不加载数据');
  assert.deepEqual(redirects, [], '有上一页时返回，不跳转');
  // 从分享 / 最近使用直接打开（页面栈只有这一页）：返回不了，跳到当前语言自己的字母页
  global.getCurrentPages = () => [{}];
  const qbAmFirst = mkQubee();
  qbAmFirst.onLoad({ group: '1' });
  assert.equal(backs, 1, '栈底页不调用 navigateBack');
  assert.deepEqual(redirects, ['/pages/fidel/fidel'], '栈底页跳到 Fidel 字母表');
  assert.equal(qbAmFirst.data.groups.length, 0);
  global.getCurrentPages = realPages;
  wx.redirectTo = realRedirect;
  langs.set('om');
  const qb = mkQubee();
  qb.onLoad({ group: '2' });
  assert.equal(backs, 1, '奥罗莫语下正常打开');
  assert.equal(qb.data.groups.length, 5);
  assert.equal(qb.data.group, 2);
  assert.equal(qb.data.sections.length, 1, '单批只显示本批规则');
  assert.equal(qb.data.sections[0].group, 2);
  assert.equal(qb.data.tc, 'latin');
  qb.pickGroup({ currentTarget: { dataset: { g: '0' } } });
  assert.equal(qb.data.sections.length, 5, '「全部」显示 5 批');
  const qb0 = mkQubee();
  qb0.onLoad({ group: '0' });
  assert.equal(qb0.data.group, 0, 'Qubee 页 group=0 不被改成 1');
  assert.equal(qb0.data.sections.length, 5, 'Qubee 全表显示 5 批');
  const qbBad = mkQubee();
  qbBad.onLoad({ group: '9' });
  assert.equal(qbBad.data.group, 1, '非法 group 回到第 1 批');
  const qbNone = mkQubee();
  qbNone.onLoad({});
  assert.equal(qbNone.data.group, 1, '缺省 group 回到第 1 批');
  qb.pickGroup({ currentTarget: { dataset: { g: '1' } } });
  qb.startQuiz();
  assert.equal(qb.data.mode, 'quiz');
  assert.equal(qb.data.qTotal, 10);
  assert.ok(qb.data.q.options.includes(qb.data.q.answer));
  const omStarsBefore = progress.load('om').stars || 0;
  const amGroupsBefore = JSON.stringify(progress.load('am').fidelGroupsDone);
  qb.setData({ qScore: 10, qIdx: 10 });
  qb.showQ();
  assert.equal(qb.data.mode, 'result');
  assert.equal(qb.data.pct, 100);
  assert.ok(qb.data.earned > 0, '首次通过加星');
  assert.ok(progress.load('om').fidelGroupsDone[1], '奥罗莫语第 1 批已通过');
  assert.equal(JSON.stringify(progress.load('am').fidelGroupsDone), amGroupsBefore, '阿姆哈拉语字母进度不变');
  assert.equal(progress.load('om').stars, omStarsBefore + qb.data.earned);
  qb.startQuiz();
  qb.setData({ qScore: 10, qIdx: 10 });
  qb.showQ();
  assert.equal(qb.data.earned, 0, '再次通过不重复加星');
  qb.backRules();
  assert.equal(qb.data.mode, 'rules');
  qb.enterAt = Date.now();
  qb.onUnload();
  wx.navigateBack = realBack;
  langs.set('am');

  // 语言切换入口：首页标签 → 选奥罗莫语 → 各页按奥罗莫语显示
  const langSwitch = require(path.join(root, 'utils/lang-switch.js'));
  assert.equal(langSwitch.label(langs.meta('om')), 'Afaan Oromoo 奥罗莫语（试用版）');
  const realSheet = wx.showActionSheet;
  wx.showActionSheet = ({ itemList, success }) => { global.__sheet = itemList; success({ tapIndex: itemList.findIndex((t) => /Oromoo/.test(t)) }); };
  // 用 Object.create 包一层：setData 合并进各自的 data，不污染共享的页面配置
  const mkPage = (name, data) => Object.assign(Object.create(pageOf(name)), { data: { ...(data || pageOf(name).data) }, setData(d) { this.data = { ...this.data, ...d }; } });
  assert.equal(langs.current(), 'am');
  const amGroupsSnap = JSON.stringify(progress.load('am').fidelGroupsDone);
  const homeSw = mkPage('index/index', {});
  homeSw.onShow();
  assert.match(homeSw.data.langLabel, /阿姆哈拉语/);
  homeSw.switchLang();
  assert.equal(langs.current(), 'om', '首页切到奥罗莫语');
  assert.equal(global.__sheet.length, 2);
  assert.match(homeSw.data.langLabel, /奥罗莫语（试用版）/, '切换后首页立即刷新');
  assert.equal(homeSw.data.tc, 'latin');
  assert.ok(homeSw.data.tasks.some((t) => t.type === 'alphabet'), '今日任务来自奥罗莫语计划');
  assert.equal(homeSw.data.alphabetName, 'Qubee 字母');

  // 课程 → 学单元 → 复习 → 小测（无听力题、选项没有转写）→ 搜索 → Qubee
  const lessonPage = mkPage('lesson/lesson', {});
  lessonPage.onLoad({ id: 'om-u03' });
  assert.equal(lessonPage.data.unit.id, 'om-u03');
  assert.equal(lessonPage.data.hasRom, false);
  assert.equal(lessonPage.data.audio, true, '奥罗莫语有语音后课文页显示喇叭');
  progress.learnUnit('om-u03');
  const omDue = progress.dueCards();
  assert.ok(omDue.length > 0 && omDue.every((c) => c.id.startsWith('om-')), '复习队列只有奥罗莫语卡片');
  // 复习页（tabBar 常驻实例）：换语言后本次学习的计数从零开始，不接着另一种语言的「第 N 张」
  const rv = mkPage('review/review');
  rv.onShow();
  assert.ok(rv.data.current && rv.data.current.id.startsWith('om-'));
  rv.grade({ currentTarget: { dataset: { g: '4' } } });
  rv.grade({ currentTarget: { dataset: { g: '1' } } });
  assert.equal(rv.data.done, 2);
  assert.equal(rv.data.sessionCorrect, 1);
  assert.equal(rv.data.sessionWrong, 1);
  langs.set('am');
  rv.onShow();
  assert.equal(rv.data.done, 0, '换语言后已答数清零');
  assert.equal(rv.data.sessionCorrect, 0, '换语言后答对数清零');
  assert.equal(rv.data.sessionWrong, 0, '换语言后答错数清零');
  assert.equal(rv.data.sessionTotal, rv.data.queue.length, '总数只算当前语言的队列');
  langs.set('om');
  const omQuiz = quiz.buildQuiz('om-u03', 10, progress.load(), false);
  assert.equal(omQuiz.filter((q) => q.listen).length, 0);
  omQuiz.forEach((q) => { assert.equal(q.promptRom, ''); q.options.forEach((o) => assert.ok(!/  /.test(o.text), '选项不拼接转写')); });
  const omSearch = mkPage('search/search', { q: '', results: [], recent: [] });
  omSearch.onLoad();
  omSearch.search('你好');
  assert.ok(omSearch.data.results.length > 0 && omSearch.data.results.every((r) => r.id.startsWith('om-')), '搜索只搜当前语言');
  const qubee = mkPage('qubee/qubee');
  qubee.onLoad({ group: '3' });
  assert.ok(!progress.load().fidelGroupsDone[3], '第 3 批起初未通过');
  assert.notEqual(qubee.data.done, true);
  qubee.startQuiz();
  qubee.questions.forEach((qq) => { qubee.data.q = qq; qubee.data.qScore += 1; });
  qubee.data.qIdx = qubee.data.qTotal;
  qubee.finish();
  assert.equal(qubee.data.done, true);
  assert.ok(progress.load().fidelGroupsDone[3], 'Qubee 第 3 批记在奥罗莫语进度里');
  // 徽章弹框：按钮文字 ≤ 4 个字（微信 showModal 的 confirmText 限制），不用语言包里的长夸奖语
  const points = require(path.join(root, 'utils/points.js'));
  global.__modal = null;
  progress.completeMission('w1');
  assert.ok(points.celebrate().some((b) => b.id === 'first-words'), '奥罗莫语完成第 1 周任务得徽章');
  assert.equal(global.__modal.confirmText, '好的', '徽章弹框按钮是「好的」');
  assert.ok(global.__modal.confirmText.length <= 4);
  // 跟读页：没有语音的语言打开旧链接直接返回，不加载词句（奥罗莫语有语音，能进入对比模式，见后面）
  langs.register('xx', { ...langs.pack('om'), meta: { ...langs.meta('om'), code: 'xx', audio: false } });
  langs.set('xx');
  const realBackSp = wx.navigateBack;
  let spBacks = 0;
  wx.navigateBack = () => { spBacks += 1; };
  const omSpeak = mkPage('speak/speak');
  omSpeak.onLoad({ id: 'om-u03-01' });
  wx.navigateBack = realBackSp;
  assert.equal(spBacks, 1, '没有语音的语言打开跟读页直接返回');
  assert.equal(omSpeak.data.item, null, '不加载词句');
  assert.ok(!omSpeak.recorder, '不初始化录音器');
  langs.set('om');
  langs.unregister('xx');

  // 「我的」页也能切回阿姆哈拉语，阿姆哈拉语进度完好
  wx.showActionSheet = ({ itemList, success }) => success({ tapIndex: itemList.findIndex((t) => /阿姆哈拉语/.test(t)) });
  const meSw = mkPage('profile/profile');
  meSw.switchLang();
  assert.equal(langs.current(), 'am');
  assert.match(meSw.data.langLabel, /阿姆哈拉语/);
  assert.ok(!progress.load().unitsLearned['om-u03'], '阿姆哈拉语进度没有混入奥罗莫语');
  assert.equal(JSON.stringify(progress.load('am').fidelGroupsDone), amGroupsSnap, '阿姆哈拉语字母进度没被 Qubee 小测改动');
  wx.showActionSheet = realSheet;

  // 奥罗莫语朗读：免登录、带 lang、缓存键独立；旧云函数（不认识 tts.caps）时不发 tts 请求
  langs.set('om');
  const omText = langs.pack('om').getUnit('om-u01').items[0].text;
  const omText2 = langs.pack('om').getUnit('om-u01').items[1].text;
  assert.notEqual(omText, omText2);
  const savedProfile = wx.getStorageSync('profile_v1');
  wx.setStorageSync('profile_v1', { ...(savedProfile || {}), registered: false });
  const sent = [];
  const cf0 = wx.cloud.callFunction;
  wx.cloud.downloadFile = ({ fileID, success }) => { const p = `/tmp/sim/${fileID.split('/').pop()}`; localFiles.add(p); success({ statusCode: 200, tempFilePath: p }); };
  // 旧云函数：tts.caps 报「未知 action」→ 不发 tts.get，提示云函数版本过旧（只缓存「支持」，所以放在新云函数之前）
  wx.cloud.callFunction = (o) => {
    sent.push(o.data);
    if (o.data.action === 'tts.caps') { o.success({ result: { ok: false, code: 'BAD_REQUEST', error: '未知 action: tts.caps' } }); return; }
    return cf0(o);
  };
  global.__modal = null;
  await audio.speak(omText2);
  assert.ok(sent.some((d) => d.action === 'tts.caps'), '旧云函数：先探测 tts.caps');
  assert.equal(sent.filter((d) => /^tts\.(get|batch)$/.test(d.action)).length, 0, '旧云函数不认识 lang：不发 tts.get');
  assert.ok(global.__modal && /云函数版本过旧/.test(global.__modal.content), '提示云函数版本过旧');
  audio.prefetch([{ id: 'p', text: omText2 }]);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(sent.filter((d) => /^tts\.(get|batch)$/.test(d.action)).length, 0, '旧云函数：预取也不发 tts.batch');
  // 上面的等待期间，页面上挂起的「我的」刷新会把登记状态写回去：重新置为未登录
  wx.setStorageSync('profile_v1', { ...(savedProfile || {}), registered: false });
  // 网络类错误（不是「版本过旧」）：不发 tts.get，也不能误报云函数版本过旧，显示错误本身的文案
  const omText3 = langs.pack('om').getUnit('om-u01').items[2].text;
  wx.cloud.callFunction = (o) => {
    sent.push(o.data);
    if (o.data.action === 'tts.caps') { o.fail({ errMsg: 'cloud.callFunction:fail request:fail' }); return; }
    return cf0(o);
  };
  sent.length = 0;
  global.__modal = null;
  await audio.speak(omText3);
  assert.ok(sent.some((d) => d.action === 'tts.caps'), '网络失败：探测过 tts.caps');
  assert.equal(sent.filter((d) => /^tts\.(get|batch)$/.test(d.action)).length, 0, '网络失败：不发 tts.get');
  assert.ok(global.__modal && global.__modal.content, '网络失败：弹出错误提示');
  assert.ok(!/云函数版本过旧/.test(global.__modal.content), '网络失败不能误报云函数版本过旧');
  sent.length = 0;
  global.__modal = null;
  // 新云函数
  wx.cloud.callFunction = (o) => { sent.push(o.data); return cf0(o); };
  await audio.speak(omText);
  const omCall = sent.find((d) => d.action === 'tts.get');
  assert.ok(omCall, '未登录也能朗读奥罗莫语');
  assert.equal(omCall.data.lang, 'om');
  assert.ok(sent.some((d) => d.action === 'tts.caps'), '先确认云函数支持奥罗莫语');
  assert.match(global.__audioCtx.src, /\/tmp\/sim\//, '播放下载到本地的文件');
  assert.equal(langs.meta('om').audioVersion, 1, '奥罗莫语音频版本');
  assert.ok(wx.getStorageSync('audio_cache_v1')[`om|v1|normal|${omText}`], '奥罗莫语本地缓存键带语言前缀与音频版本');
  assert.equal(audio.cacheKey('ሰላም', 'female', 'normal', 'am'), 'female|normal|ሰላም', '阿姆哈拉语缓存键不变');
  assert.equal(audio.cacheKey('ሰላም', 'female', 'normal'), 'female|normal|ሰላም', '不带语言时按阿姆哈拉语');
  // 换成真人录音后把 audioVersion 加 1：旧的本地文件不再命中，重新下载
  const omMeta = langs.meta('om');
  omMeta.audioVersion = 2;
  assert.equal(audio.cacheKey(omText, 'female', 'normal', 'om'), `om|v2|normal|${omText}`, 'audioVersion 变了缓存键跟着变');
  sent.length = 0;
  await audio.speak(omText);
  assert.equal(sent.filter((d) => d.action === 'tts.get').length, 1, 'audioVersion 加 1 后重新取音频');
  assert.ok(wx.getStorageSync('audio_cache_v1')[`om|v2|normal|${omText}`]);
  omMeta.audioVersion = 1;
  sent.length = 0;
  await audio.speak(omText);
  assert.equal(sent.filter((d) => d.action === 'tts.get').length, 0, '第二次走本地缓存');
  // 混合部署：tts.caps 被新实例回答，tts.get / tts.batch 却落到旧实例（回包不带 lang，用阿姆哈拉语声音合成）→ 不播、不缓存
  const omOld = langs.pack('om').getUnit('om-u01').items[5].text;
  const stripLang = (o) => {
    sent.push(o.data);
    if (!/^tts\.(get|batch)$/.test(o.data.action)) return cf0(o);
    return cf0({ ...o, success: (res) => { const r = res.result; if (r && r.ok) delete r.data.lang; o.success(res); } });
  };
  wx.cloud.callFunction = stripLang;
  sent.length = 0;
  global.__modal = null;
  const playsOld = global.__audioPlays || 0;
  await audio.speak(omOld);
  assert.ok(sent.some((d) => d.action === 'tts.get'), '混合部署：发了 tts.get');
  assert.ok(!wx.getStorageSync('audio_cache_v1')[audio.cacheKey(omOld, 'female', 'normal', 'om')], '回包没有 lang：不缓存');
  assert.equal(global.__audioPlays || 0, playsOld, '回包没有 lang：不播放');
  assert.ok(global.__modal && /云函数版本过旧/.test(global.__modal.content), '回包没有 lang：提示云函数版本过旧');
  global.__modal = null;
  await audio.speak(omOld, { silent: true });
  assert.equal(global.__modal, null, '静默朗读不弹框');
  audio.prefetch([{ id: 'x', text: omOld }]);
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(sent.some((d) => d.action === 'tts.batch'), '混合部署：发了 tts.batch');
  assert.ok(!wx.getStorageSync('audio_cache_v1')[audio.cacheKey(omOld, 'female', 'normal', 'om')], '预取回包没有 lang：不缓存');
  wx.cloud.callFunction = (o) => { sent.push(o.data); return cf0(o); };
  audio.prefetch([{ id: 'x', text: omOld }]);
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(wx.getStorageSync('audio_cache_v1')[audio.cacheKey(omOld, 'female', 'normal', 'om')], '新云函数：预取正常缓存');
  wx.setStorageSync('profile_v1', { ...(savedProfile || {}), registered: false });
  const omQuiz2 = quiz.buildQuiz('om-u01', 9, progress.load(), langs.meta().audio);
  assert.ok(omQuiz2.some((q) => q.listen), '奥罗莫语有语音后出听力题');
  // 未登录：奥罗莫语小测页出听力题（免登录）；阿姆哈拉语仍然不出
  const omQuizPage = mkPage('quiz/quiz', {});
  omQuizPage.onLoad({ scope: 'om-u01' });
  assert.ok(omQuizPage.data.questions.some((q) => q.listen), '未登录的奥罗莫语小测页有听力题');
  // 静默朗读（自动播放）：奥罗莫语免登录照常请求；阿姆哈拉语未登录仍直接放弃
  sent.length = 0;
  await audio.speak(langs.pack('om').getUnit('om-u01').items[3].text, { silent: true });
  const silentOm = sent.find((d) => d.action === 'tts.get');
  assert.ok(silentOm, '未登录的奥罗莫语静默朗读也发 tts.get');
  assert.equal(silentOm.data.lang, 'om');
  langs.set('am');
  const amQuizPage = mkPage('quiz/quiz', {});
  amQuizPage.onLoad({ scope: 'u01' });
  assert.equal(amQuizPage.data.questions.filter((q) => q.listen).length, 0, '未登录的阿姆哈拉语小测页没有听力题');
  sent.length = 0;
  await audio.speak('ጤና ይስጥልኝ ሰላም ነው', { silent: true });
  assert.equal(sent.filter((d) => /^tts\./.test(d.action)).length, 0, '未登录的阿姆哈拉语静默朗读不发任何 tts 请求');
  langs.set('om');
  wx.cloud.callFunction = cf0;
  delete wx.cloud.downloadFile;
  wx.setStorageSync('profile_v1', savedProfile);
  assert.equal(langs.view().voiceChoice, false, '奥罗莫语只有一种声音，不显示男声/女声');
  langs.set('am');
  assert.equal(langs.view().voiceChoice, true);

  // 跟读对比：奥罗莫语不评分，对比完成每词每天 1 颗星，不调 stt.score
  langs.set('om');
  const omCmpPage = Object.create(pageOf('speak/speak'));
  omCmpPage.data = { ...pageOf('speak/speak').data };
  omCmpPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  omCmpPage.onLoad({ id: 'om-u01-01' });
  omCmpPage.onShow();
  assert.equal(omCmpPage.data.item.id, 'om-u01-01', '奥罗莫语能进跟读页');
  assert.equal(omCmpPage.data.scoring, false);
  assert.equal(omCmpPage.data.needLogin, false, '不评分就不需要登录提示');
  const sttCalls = [];
  const cf1 = wx.cloud.callFunction;
  wx.cloud.callFunction = (o) => { if (o.data.action === 'stt.score') sttCalls.push(o); return cf1(o); };
  const starsBefore = progress.load().stars || 0;
  const todayMin = () => (progress.load().logs[progress.todayStr()] || {}).minutes || 0;
  const minBefore = todayMin();
  omCmpPage.data.tempFilePath = '/tmp/sim/rec.wav';
  omCmpPage.practiceCompare();
  assert.equal(todayMin() - minBefore, 1, '第一次对比记 1 分钟');
  assert.equal((progress.load().stars || 0) - starsBefore, 1, '第一次对比 +1 星');
  assert.equal(omCmpPage.data.practice.first, true);
  omCmpPage.practiceCompare();
  assert.equal((progress.load().stars || 0) - starsBefore, 1, '同一个词当天不重复给星');
  assert.equal(todayMin() - minBefore, 1, '同一个词反复点对比不重复记学习时长');
  assert.equal(omCmpPage.data.practice.first, false);
  omCmpPage.score();
  assert.equal(sttCalls.length, 0, '奥罗莫语绝不调用 stt.score');
  if (omCmpPage.compareTimer) clearTimeout(omCmpPage.compareTimer);
  wx.cloud.callFunction = cf1;
  langs.set('am');
  global.__audioPlays = 0; // 下面的语音测试从零计数
  storage._files.clear();
  global.__modal = null;

  // 语音：朗读走云端合成 + 本地缓存
  global.__modal = null;
  audio.stop(); // 页面 onHide 时会在还没播过任何音频的情况下调用
  const amSent = [];
  const cfAm = wx.cloud.callFunction;
  wx.cloud.callFunction = (o) => { amSent.push(o.data.action); return cfAm(o); };
  await audio.speak('ሰላም');
  wx.cloud.callFunction = cfAm;
  assert.ok(amSent.includes('tts.get'), '阿姆哈拉语朗读发 tts.get');
  assert.ok(!amSent.includes('tts.caps'), '阿姆哈拉语朗读从不探测 tts.caps（旧云函数照常可用）');
  assert.ok(global.__audioCtx, 'InnerAudioContext created');
  assert.equal(global.__modal, null, '第一次朗读不能误报 audioInstance is not set');
  assert.equal(global.__audioCtx.stops, 0, '新播放器设置 src 之前不调用 stop');
  assert.deepEqual(global.__audioOption, { obeyMuteSwitch: false }, 'iPhone 静音开关打开时也能朗读');
  assert.equal(global.__audioPlays, 1, '首次朗读播放一次');
  assert.equal(azure.synthCalls.length, 1, '首次朗读调用 Azure 合成');
  assert.equal(azure.synthCalls[0].text, 'ሰላም');
  await audio.speak('ሰላም');
  assert.equal(global.__audioPlays, 2, '第二次朗读仍播放');
  assert.ok(global.__audioCtxs[global.__audioCtxs.length - 2].destroyed, '上一个播放器已销毁，不会越积越多');
  assert.equal(azure.synthCalls.length, 1, '第二次朗读走本地缓存，不再合成');
  assert.equal(storage._files.size, 1, 'tts 音频已上传云存储');

  // 语音：小测每 3 题含 1 题听力题
  const q9 = quiz.buildQuiz('u01', 9, progress.load());
  assert.equal(q9.length, 9);
  assert.equal(q9[2].listen, true, '第 3 题为听力题');
  assert.ok(q9[2].audioText, '听力题带朗读文本');
  assert.equal(q9[2].promptText, '', '听力题题面不显示阿姆哈拉语');
  assert.ok(!q9[0].listen && !q9[1].listen, '前两题非听力题');
  [5, 8].forEach((i) => assert.equal(q9[i].listen, true, `第 ${i + 1} 题为听力题`));

  // 语音：跟读评分链路（上传 → stt.score → 删除文件）
  const fileID = await new Promise((resolve, reject) => wx.cloud.uploadFile({
    cloudPath: `stt/${simOpenid}/sim.wav`, filePath: '/tmp/sim/rec.wav', success: (r) => resolve(r.fileID), fail: reject
  }));
  assert.ok(storage._files.has(fileID), '录音已上传');
  const sttSent = [];
  const cfStt = wx.cloud.callFunction;
  wx.cloud.callFunction = (o) => { if (o.data.action === 'stt.score') sttSent.push(o.data.data); return cfStt(o); };
  const scored = await api.sttScore(fileID, 'ሰላም');
  assert.equal(sttSent[0].lang, 'am', 'stt.score 带当前语言');
  assert.equal(scored.score, 100, '识别一致得 100 分');
  assert.equal(scored.transcript, 'ሰላም');
  assert.deepEqual(scored.words, [{ w: 'ሰላም', ok: true }]);
  assert.equal(azure.recogCalls.length, 1, '调用一次 Azure 识别');
  assert.equal(storage._files.has(fileID), false, '评分后录音文件已删除');
  // 当前语言是奥罗莫语时（例如旧页面直接调了评分），云端按 lang 拒绝，且已上传的录音当场删除
  langs.set('om');
  const omFile = await new Promise((resolve, reject) => wx.cloud.uploadFile({
    cloudPath: `stt/${simOpenid}/om.wav`, filePath: '/tmp/sim/rec.wav', success: (r) => resolve(r.fileID), fail: reject
  }));
  await assert.rejects(api.sttScore(omFile, 'Akkam'), (e) => /暂不支持发音评分/.test(e.message), '奥罗莫语 stt.score 被云端拒绝');
  assert.equal(sttSent[1].lang, 'om');
  assert.equal(storage._files.has(omFile), false, '被拒的奥罗莫语录音也已删除');
  assert.equal(azure.recogCalls.length, 1, '奥罗莫语不调 Azure 识别');
  langs.set('am');
  wx.cloud.callFunction = cfStt;

  // 语音：跟读页可加载并展示词句
  const speakPage = pageOf('speak/speak');
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
  assert.equal(sys.usageDaily.length, 14);
  assert.ok(typeof sys.ttsCache.count === 'number');
  progress.addMinutes(1); // 触发进度变化后同步，带 meta
  assert.equal(await sync.syncNow(), true, '进度变化后再次上传');
  const userDoc = db._users.get('sim-user');
  assert.ok(userDoc, 'users 摘要已写入');
  assert.equal(userDoc.stars, progress.load().stars || 0, '摘要 stars 与本地一致');

  // 用量与配额
  const usage = await api.usageGet();
  assert.ok(usage.tts && typeof usage.tts.used === 'number' && usage.tts.limit === 300, 'usage.get 结构');
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
  await assert.rejects(api.ttsGet("ሰላም", "female", "normal"), (e) => e.code === 'OFFLINE' && /没有网络/.test(e.message));
  global.__net = 'wifi';
  const realCall0 = wx.cloud.callFunction;
  wx.cloud.callFunction = ({ fail }) => fail({ errMsg: 'cloud.callFunction:fail Error: errCode: -601001 | errMsg: request:fail -2:net::ERR_NAME_NOT_RESOLVED' });
  await assert.rejects(api.ttsGet("ሰላም", "female", "normal"), (e) => e.code === 'NETWORK' && /网络连接失败/.test(e.message));
  wx.cloud.callFunction = realCall0;

  // 云函数失败信息归一成一句可照做的提示
  const realCall = wx.cloud.callFunction;
  wx.cloud.callFunction = ({ fail }) => fail({ errMsg: 'cloud.callFunction:fail Error: errCode: -504003 | errMsg: Invoking task timed out after 3 seconds (callId: x) (trace: y)' });
  await assert.rejects(api.ttsGet("ሰላም", "female", "normal"), (e) => e.code === 'TIMEOUT' && /超时时间调到 60 秒/.test(e.message) && e.message.length < 60);
  wx.cloud.callFunction = ({ fail }) => fail({ errMsg: 'cloud.callFunction:fail Error: errCode: -504002 | errMsg: FUNCTION_NOT_FOUND' });
  await assert.rejects(api.ttsGet("ሰላም", "female", "normal"), (e) => e.code === 'NOT_DEPLOYED');
  wx.cloud.callFunction = realCall;

  // 我的页：已登录显示账号卡与退出按钮；退出后云端与本地都回到未登录，管理员入口隐藏、同步停止
  const account = require(path.join(root, 'utils/account.js'));
  simOpenid = 'sim-user';
  wx.setStorageSync('profile_v1', { ...(wx.getStorageSync('profile_v1') || {}), registered: true, openid: simOpenid, isAdmin: true, status: 'active' });
  const me2 = pageOf('profile/profile');
  me2.data = { ...me2.data, cloudReady: true, registered: true, isAdmin: true, openid: simOpenid };
  me2.setData = function (d) { Object.assign(this.data, d); };
  global.__modal = null;
  me2.logout();
  assert.ok(global.__modal && /退出/.test(global.__modal.title), '退出前先确认');
  await global.__modal.success({ confirm: true });
  assert.equal(me2.data.registered, false, '退出后页面显示未登录');
  assert.equal(me2.data.isAdmin, false, '退出后隐藏管理员入口');
  assert.equal(account.isRegistered(), false, '本地登录态已清');
  assert.equal((await api.me()).registered, false, '云端也记下了退出');
  await assert.rejects(api.ttsGet('ሰላም', 'female', 'normal'), (e) => /登录/.test(e.message), '退出后朗读要求重新登录');
  progress.addMinutes(1);
  assert.equal(await sync.syncNow(), false, '退出后不再上传进度');
  // 重新登录即恢复
  const again = await api.register();
  assert.equal(again.registered, true, '重新登录恢复');
  assert.equal(again.isAdmin, true, '管理员身份随登录恢复');

  // 朗读失败要说出真实原因：云端的详细错误拼上细节后很长，以前会被退回成「语音暂时不可用」
  const realCall2 = wx.cloud.callFunction;
  wx.cloud.callFunction = ({ success }) => success({ result: { ok: false, code: 'UPSTREAM', error: 'Azure 返回 401：订阅密钥无效或与所选区域不匹配，请检查 AZURE_SPEECH_KEY 与 AZURE_SPEECH_REGION' } });
  global.__modal = null;
  await audio.speak('ሰላም ጤና ይስጥልኝ');
  assert.ok(global.__modal, '朗读失败弹出说明');
  assert.match(global.__modal.content, /401/, '弹框里有云端的真实原因');
  assert.match(global.__modal.content, /AZURE_SPEECH_KEY/, '长细节没有被截掉');
  wx.cloud.callFunction = realCall2;

  // 真机上不能直接播临时链接（要配合法域名，只有开了调试的手机能播）：必须先走云存储下载，播本地文件
  wx.cloud.downloadFile = ({ fileID, success }) => {
    global.__cloudDownloads = (global.__cloudDownloads || []).concat(fileID);
    const temp = `/tmp/sim/cloud-${global.__cloudDownloads.length}.mp3`;
    localFiles.add(temp);
    success({ statusCode: 200, tempFilePath: temp });
  };
  global.__modal = null;
  await audio.speak('ወደ ቀኝ ታጠፍ');
  assert.equal(global.__cloudDownloads.length, 1, '朗读先走云存储下载');
  assert.match(global.__audioCtx.src, /^\/tmp\/sim\/cloud-1\.mp3$/, '播放的是下载到本地的文件，而不是临时链接');
  assert.equal(global.__modal, null, '成功时不弹框');
  // 本地文件播不了（如开发者工具里的 audioInstance is not set）→ 自动换在线链接，不弹框
  global.__audioCtx._onError({ errMsg: 'operateAudio:fail audioInstance is not set', errCode: -1 });
  assert.ok(global.__audioCtx.src && !/cloud-/.test(global.__audioCtx.src), '本地文件失败后改播在线链接');
  assert.equal(global.__modal, null, '换源成功前不弹框');
  // 在线链接也失败 → 弹框同时列出两步的原因
  global.__audioCtx._onError({ errMsg: 'MediaError', errCode: 10002 });
  assert.match(global.__modal.content, /本地文件播放出错：operateAudio:fail audioInstance is not set/, '列出本地文件的错误');
  assert.match(global.__modal.content, /在线链接播放出错：MediaError/, '列出在线链接的错误');
  // 本地缓存文件坏了 → 删掉缓存，重新从云端取
  global.__modal = null;
  await audio.speak('ቀጥ ብለህ ሂድ');
  const dl0 = global.__cloudDownloads.length;
  const cachedSrc = global.__audioCtx.src;
  await audio.speak('ቀጥ ብለህ ሂድ');
  assert.equal(global.__cloudDownloads.length, dl0, '命中本地缓存，不重新下载');
  assert.equal(global.__audioCtx.src, cachedSrc, '播放缓存文件');
  global.__audioCtx._onError({ errMsg: 'decode error' });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(global.__cloudDownloads.length, dl0 + 1, '缓存文件坏了会重新下载');
  assert.match(global.__audioCtx.src, /cloud-/, '重新下载后播放本地文件');
  assert.notEqual(global.__audioCtx.src, cachedSrc, '换成新下载的文件');
  assert.equal(global.__modal, null, '恢复成功不弹框');

  // 云存储下载失败（如权限设成仅创建者可读写）→ 退回播临时链接；再播不了时弹框要带上下载失败的原因
  wx.cloud.downloadFile = ({ fail }) => fail({ errMsg: 'cloud.downloadFile:fail -403003 permission denied' });
  await audio.speak('ወደ ግራ ታጠፍ');
  assert.ok(global.__audioCtx.src && !/cloud-/.test(global.__audioCtx.src), '下载失败时退回在线链接');
  global.__audioCtx._onError({ errMsg: 'MediaError', errCode: 10002 });
  assert.match(global.__modal.content, /MediaError/, '弹框有播放器错误');
  assert.match(global.__modal.content, /403003/, '弹框同时给出云存储下载失败的原因');
  delete wx.cloud.downloadFile;

  // 未配置云环境时的失败路径
  require(path.join(root, 'config.js')).cloudEnv = '';
  await assert.rejects(api.ttsGet("ሰላም", "female", "normal"), (e) => e.code === 'NO_ENV');

  const fs = require('fs');
  const HARD = /阿姆哈拉语怎么说|在心里说出阿姆哈拉语|看阿<|ጥሩ ስራ|በጣም ጥሩ|ችግር የለም|ሰላም!/;
  ['quiz/quiz', 'review/review', 'search/search', 'login/login', 'fidel/fidel', 'index/index', 'lesson/lesson', 'speak/speak', 'profile/profile', 'lessons/lessons', 'plan/plan', 'qubee/qubee'].forEach((p) => {
    const wxml = fs.readFileSync(path.join(root, 'pages', p + '.wxml'), 'utf8');
    // fidel 页自己的标题「Fidel 字母表」是阿姆哈拉语专属页的名字，对它单独跳过这一项
    const re = new RegExp(HARD.source + (p === 'fidel/fidel' ? '' : '|Fidel 字母表<') + '|Fidel 字母 第');
    assert.ok(!re.test(wxml), `${p}.wxml 里还有写死的语言文案`);
  });

  // 「我的」页的清空按钮与云端同步说明写明是哪种语言（进度按语言分开）
  const profileWxml = fs.readFileSync(path.join(root, 'pages', 'profile/profile.wxml'), 'utf8');
  assert.ok(profileWxml.includes('清空{{L.langName}}进度'), '清空按钮写明当前语言');
  assert.ok(/当前语言：' \+ L\.langName/.test(profileWxml), '云端同步说明写明当前语言');

  assert.equal(global.__amCaps || 0, 0, '阿姆哈拉语在整个模拟过程中从未发过 tts.caps');
  console.log('OK: miniprogram simulation passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
