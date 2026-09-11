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
const db = createFakeDb();
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
  showToast() {}, showModal() {}, setNavigationBarTitle() {}, navigateTo() {}, switchTab() {},
  navigateBack() {}, redirectTo() {}, setClipboardData() {},
  authorize({ success }) { if (success) success(); },
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
  getRecorderManager() {
    return { start() {}, stop() {}, onStop() {}, onError() {} };
  },
  cloud: {
    init() {},
    callFunction({ data, success, fail }) {
      handle(data.action, data.data, { openid: 'sim-user', db, deepseek, azure, storage })
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
const pages = [];
global.Page = (cfg) => { cfg.getTabBar = () => ({ setData() {} }); pages.push(cfg); };
global.Component = () => {};
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

['index/index', 'lessons/lessons', 'lesson/lesson', 'review/review', 'quiz/quiz', 'plan/plan', 'coach/coach', 'fidel/fidel', 'profile/profile', 'search/search', 'speak/speak']
  .forEach((p) => require(path.join(root, 'pages', p + '.js')));
assert.equal(pages.length, 11, 'pages loaded');
require(path.join(root, 'app.js'));
global.__app.onLaunch();

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

  // 云函数链路：AI
  const diag = await api.diagnose(s, plan.planOutline());
  assert.equal(diag.score, 50);
  const chat = await api.chat([{ role: 'user', content: '你好怎么说' }], s);
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

  // 用量与配额
  const usage = await api.usageGet();
  assert.ok(usage.ai && typeof usage.ai.used === 'number' && usage.ai.limit === 20, 'usage.get 结构');
  assert.equal(usage.isAdmin, false);
  await assert.rejects(api.adminUsage(), (e) => /无权限/.test(e.message));
  process.env.ADMIN_OPENIDS = 'sim-user';
  const team = await api.adminUsage();
  assert.equal(team.users.length, 1);
  assert.equal(team.users[0].openid, 'sim-user');
  delete process.env.ADMIN_OPENIDS;

  // 未配置云环境时的失败路径
  require(path.join(root, 'config.js')).cloudEnv = '';
  await assert.rejects(api.diagnose(s, {}), (e) => e.code === 'NO_ENV');

  console.log('OK: miniprogram simulation passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
