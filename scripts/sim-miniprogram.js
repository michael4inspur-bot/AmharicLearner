// 模拟微信运行环境，跑通小程序核心逻辑与云函数调用链路。用法：node scripts/sim-miniprogram.js
const path = require('path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..', 'miniprogram');
const fnRoot = path.join(__dirname, '..', 'cloudfunctions', 'api');
const { handle } = require(path.join(fnRoot, 'handler.js'));
const { createFakeDb } = require(path.join(fnRoot, 'test', 'fakeDb.js'));
const { createFakeDeepseek } = require(path.join(fnRoot, 'test', 'fakeDeepseek.js'));

const DIAG = { overall_level: '入门', score: 50, summary: '模拟诊断', strengths: ['坚持'], weaknesses: [], risks: [],
  recommendations: [], plan_changes: [], daily_minutes_suggestion: 30, next_7_days: [], encouragement: '继续' };
const db = createFakeDb();
const deepseek = createFakeDeepseek((messages, opts) => (opts && opts.json ? JSON.stringify(DIAG) : 'ሰላም! 模拟回复'));

const store = {};
global.wx = {
  getStorageSync: (k) => store[k],
  setStorageSync: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
  removeStorageSync: (k) => { delete store[k]; },
  showToast() {}, showModal() {}, setNavigationBarTitle() {}, navigateTo() {}, switchTab() {},
  navigateBack() {}, redirectTo() {}, setClipboardData() {},
  cloud: {
    init() {},
    callFunction({ data, success, fail }) {
      handle(data.action, data.data, { openid: 'sim-user', db, deepseek })
        .then((result) => success({ result }))
        .catch((e) => fail({ errMsg: e.message }));
    }
  }
};
const pages = [];
global.Page = (cfg) => pages.push(cfg);
global.App = (cfg) => { global.__app = cfg; };

// 先填云环境，再加载依赖 config 的模块
require(path.join(root, 'config.js')).cloudEnv = 'sim-env';

const progress = require(path.join(root, 'utils/progress.js'));
const quiz = require(path.join(root, 'utils/quiz.js'));
const plan = require(path.join(root, 'data/plan.js'));
const vocab = require(path.join(root, 'data/vocab.js'));
const api = require(path.join(root, 'utils/api.js'));
const sync = require(path.join(root, 'utils/sync.js'));

['index/index', 'lessons/lessons', 'lesson/lesson', 'review/review', 'quiz/quiz', 'plan/plan', 'coach/coach', 'fidel/fidel', 'profile/profile', 'search/search']
  .forEach((p) => require(path.join(root, 'pages', p + '.js')));
assert.equal(pages.length, 10, 'pages loaded');
require(path.join(root, 'app.js'));
global.__app.onLaunch();

async function main() {
  // 学习流程
  progress.learnUnit('u01');
  const due = progress.dueCards();
  assert.equal(due.length, 10, '每日新卡上限 10');
  progress.gradeCard(due[0].id, 5); progress.gradeCard(due[1].id, 1); progress.gradeCard(due[2].id, 3);
  assert.equal(progress.dueCards().length, 7);
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

  // 未配置云环境时的失败路径
  require(path.join(root, 'config.js')).cloudEnv = '';
  await assert.rejects(api.diagnose(s, {}), (e) => e.code === 'NO_ENV');

  console.log('OK: miniprogram simulation passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
