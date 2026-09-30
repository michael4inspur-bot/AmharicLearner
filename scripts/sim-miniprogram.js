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

const progress = require(path.join(root, 'utils/progress.js'));
const quiz = require(path.join(root, 'utils/quiz.js'));
const langs = require(path.join(root, 'langs/index.js'));
const vocab = langs.pack('am');
const plan = vocab.plan;
const api = require(path.join(root, 'utils/api.js'));
const sync = require(path.join(root, 'utils/sync.js'));
const audio = require(path.join(root, 'utils/audio.js'));

const PAGE_NAMES = ['index/index', 'lessons/lessons', 'lesson/lesson', 'review/review', 'quiz/quiz', 'plan/plan', 'fidel/fidel', 'profile/profile', 'search/search', 'speak/speak', 'admin/admin', 'login/login', 'privacy/privacy'];
PAGE_NAMES.forEach((p) => require(path.join(root, 'pages', p + '.js')));
/** 按页面名取 Page 配置，避免下标随页面增删错位 */
const pageOf = (name) => pages[PAGE_NAMES.indexOf(name)];
assert.equal(pages.length, 13, 'pages loaded');
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
  // 多语言：注册一个最小的测试语言包，验证进度与云端文档按语言分开
  const amPack = langs.pack('am');
  const omUnit = { id: 'om-u01', week: 1, title: '测试单元', items: [
    { id: 'om-u01-01', text: 'Akkam', zh: '你好', unit: 'om-u01' },
    { id: 'om-u01-02', text: 'Galatoomi', zh: '谢谢', unit: 'om-u01' }
  ], dialog: [] };
  langs.register('om', {
    ...amPack,
    meta: { ...amPack.meta, code: 'om', script: 'latin', hasRom: false },
    units: [omUnit],
    getUnit: (id) => (id === 'om-u01' ? omUnit : undefined),
    getItem: (id) => omUnit.items.find((it) => it.id === id),
    allItems: () => omUnit.items.slice(),
    unitsForWeek: (w) => (w === 1 ? [omUnit] : [])
  });
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
  langs.set('om');
  progress.learnUnit('om-u01');
  assert.equal(await sync.syncNow(), false, '云端不支持多语言时不上传');
  assert.ok(!oldCloudActions.includes('progress.put'), '一次 progress.put 都没发');
  wx.cloud.callFunction = realCallOld;

  // 新版云函数：奥罗莫语进度写到 openid:om，阿姆哈拉语文档不受影响
  assert.ok(progress.load().srs['om-u01-01'], '奥罗莫语进度在奥罗莫语存储里');
  assert.equal(await sync.syncNow(), true, '云端支持后上传');
  const omDoc = await db.getProgress(`${simOpenid}:om`);
  assert.ok(omDoc && omDoc.progress.srs['om-u01-01'], '云端奥罗莫语文档');
  const amDoc = await db.getProgress(simOpenid);
  assert.ok(!amDoc.progress.srs['om-u01-01'], '阿姆哈拉语文档没混进奥罗莫语');
  const omFetched = await api.fetchProgress('om');
  assert.equal(omFetched.lang, 'om');
  assert.ok(omFetched.progress.unitsLearned['om-u01']);

  // 切回阿姆哈拉语，原进度完好
  langs.set('am');
  assert.equal(JSON.stringify(progress.load().unitsLearned), amUnitsBefore, '切回后阿姆哈拉语进度不变');
  assert.ok(!progress.load().srs['om-u01-01']);
  assert.ok(wx.getStorageSync('progress_om_v1').srs['om-u01-01'], '奥罗莫语进度存在自己的键下');


  // 语音：朗读走云端合成 + 本地缓存
  global.__modal = null;
  audio.stop(); // 页面 onHide 时会在还没播过任何音频的情况下调用
  await audio.speak('ሰላም');
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
  const scored = await api.sttScore(fileID, 'ሰላም');
  assert.equal(scored.score, 100, '识别一致得 100 分');
  assert.equal(scored.transcript, 'ሰላም');
  assert.deepEqual(scored.words, [{ w: 'ሰላም', ok: true }]);
  assert.equal(azure.recogCalls.length, 1, '调用一次 Azure 识别');
  assert.equal(storage._files.has(fileID), false, '评分后录音文件已删除');

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

  console.log('OK: miniprogram simulation passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
