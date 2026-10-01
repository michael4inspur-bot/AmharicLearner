// Qubee 字母页（奥罗莫语）：批次标签 → 本批拼写规则与例词 → 10 题小测 → 结果。交互与 pages/fidel 一致。
const langs = require('../../langs/index.js');
const progress = require('../../utils/progress.js');
const points = require('../../utils/points.js');

const PASS_PCT = 70;
const QUIZ_SIZE = 10;

Page({
  data: { group: 1, groups: [], sections: [], mode: 'rules', q: null, qIdx: 0, qTotal: QUIZ_SIZE, qScore: 0, qPicked: null, pct: 0, earned: 0, done: false },
  onLoad(q) {
    // 进度按当前语言读写：只能从奥罗莫语入口进入，旧链接在别的语言下打开时直接返回，避免写错语言。
    // 从分享 / 最近使用直接打开时页面栈只有这一页，返回不了，改为跳到当前语言自己的字母页
    if (langs.current() !== 'om') {
      if (getCurrentPages().length <= 1) wx.redirectTo({ url: langs.pack().alphabet.page });
      else wx.navigateBack();
      return;
    }
    const qb = langs.pack('om').alphabet;
    this.qb = qb;
    this.setData({ ...langs.view('om'), groups: qb.groups.map((g) => ({ group: g.group, title: g.title })) });
    const raw = q && q.group;
    const g = raw === undefined || raw === '' ? NaN : Number(raw); // 0 = 全部批次；缺省 / 非法值才回到第 1 批
    this.setGroup(Number.isInteger(g) && g >= 0 && g <= 5 ? g : 1);
    this.enterAt = Date.now();
  },
  onUnload() {
    if (!this.enterAt) return;
    const min = Math.round((Date.now() - this.enterAt) / 60000);
    if (min > 0) progress.addMinutes(Math.min(min, 20));
  },
  setGroup(g) {
    const list = g === 0 ? this.qb.groups : this.qb.groups.filter((x) => x.group === g);
    const p = progress.load();
    this.setData({ group: g, sections: list, mode: 'rules', done: !!p.fidelGroupsDone[g] });
  },
  pickGroup(e) { this.setGroup(Number(e.currentTarget.dataset.g)); },
  startQuiz() {
    this.questions = this.qb.buildQuiz(this.data.group, QUIZ_SIZE);
    this.setData({ mode: 'quiz', qIdx: 0, qScore: 0, qTotal: this.questions.length });
    this.showQ();
  },
  showQ() {
    const { qIdx, qTotal } = this.data;
    if (qIdx >= qTotal) { this.finish(); return; }
    this.setData({ q: this.questions[qIdx], qPicked: null });
  },
  pickQ(e) {
    if (this.data.qPicked) return;
    const pick = e.currentTarget.dataset.opt;
    const ok = pick === this.data.q.answer;
    this.setData({ qPicked: pick, qScore: this.data.qScore + (ok ? 1 : 0) });
    setTimeout(() => { this.setData({ qIdx: this.data.qIdx + 1 }); this.showQ(); }, ok ? 500 : 1200);
  },
  finish() {
    const pct = Math.round((this.data.qScore / Math.max(1, this.data.qTotal)) * 100);
    let earned = 0;
    if (pct >= PASS_PCT && this.data.group > 0) {
      // 只在本次首次通过该批时加星
      const firstPass = !progress.load().fidelGroupsDone[this.data.group];
      progress.completeAlphabetGroup(this.data.group);
      if (firstPass) { earned = points.award('alphabet'); points.celebrate(); }
    }
    this.setData({ mode: 'result', pct, earned, done: pct >= PASS_PCT });
  },
  backRules() { this.setData({ mode: 'rules' }); }
});
