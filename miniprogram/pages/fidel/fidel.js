const fidel = require('../../data/fidel.js');
const progress = require('../../utils/progress.js');
const quiz = require('../../utils/quiz.js');
const points = require('../../utils/points.js');

Page({
  data: { group: 1, rows: [], orderLabels: fidel.ORDER_LABELS, mode: 'table', q: null, qScore: 0, qIdx: 0, qTotal: 10, qPicked: null, done: false, pct: 0, earned: 0 },
  onLoad(q) { this.setGroup(Number(q.group) || 1); this.enterAt = Date.now(); },
  onUnload() {
    const min = Math.round((Date.now() - this.enterAt) / 60000);
    if (min > 0) progress.addMinutes(Math.min(min, 20));
  },
  setGroup(g) {
    const table = fidel.buildTable();
    const rows = g === 0 ? table : table.filter((c) => c.group === g);
    const p = progress.load();
    this.setData({ group: g, rows, done: !!p.fidelGroupsDone[g], mode: 'table' });
  },
  pickGroup(e) { this.setGroup(Number(e.currentTarget.dataset.g)); },
  startQuiz() {
    const pool = this.data.rows.flatMap((c) => c.forms.map((f) => ({ ch: f.ch, rom: f.rom })));
    this.pool = quiz.shuffle(pool);
    this.setData({ mode: 'quiz', qIdx: 0, qScore: 0 });
    this.nextQ();
  },
  nextQ() {
    const { qIdx, qTotal } = this.data;
    if (qIdx >= qTotal) {
      const pct = Math.round((this.data.qScore / qTotal) * 100);
      let earned = 0;
      if (pct >= 70 && this.data.group > 0) {
        // 只在本次首次通过该批时加星
        const firstPass = !progress.load().fidelGroupsDone[this.data.group];
        progress.completeFidelGroup(this.data.group);
        if (firstPass) { earned = points.award('fidel'); points.celebrate(); }
      }
      this.setData({ mode: 'result', pct, earned, done: pct >= 70 });
      return;
    }
    const target = this.pool[qIdx % this.pool.length];
    const others = quiz.shuffle(this.pool.filter((x) => x.rom !== target.rom)).slice(0, 3);
    const options = quiz.shuffle([target, ...others]);
    this.setData({ q: { ch: target.ch, rom: target.rom, options }, qPicked: null });
  },
  pickQ(e) {
    if (this.data.qPicked) return;
    const rom = e.currentTarget.dataset.rom;
    const ok = rom === this.data.q.rom;
    this.setData({ qPicked: rom, qScore: this.data.qScore + (ok ? 1 : 0) });
    setTimeout(() => { this.setData({ qIdx: this.data.qIdx + 1 }); this.nextQ(); }, ok ? 500 : 1200);
  },
  backTable() { this.setData({ mode: 'table' }); }
});
