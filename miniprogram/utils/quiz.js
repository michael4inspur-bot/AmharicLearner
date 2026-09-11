// 生成选择题：题型混合（看阿姆哈拉语选中文 / 看中文选阿姆哈拉语 / 听音选中文），做提取练习。
const vocab = require('../data/vocab.js');
const plan = require('../data/plan.js');

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {string} scope 单元 id | 'all' | 'week:N'
 * @param {number} n 题数
 * @param {object} progress 进度（用于优先出错题）
 */
function buildQuiz(scope, n, progress) {
  let pool;
  if (scope === 'all') {
    const learned = progress ? Object.keys(progress.unitsLearned || {}) : [];
    pool = (learned.length ? learned : vocab.units.map((u) => u.id)).flatMap((id) => (vocab.getUnit(id) || { items: [] }).items);
  } else if (scope.startsWith('week:')) {
    const w = plan.weeks[Number(scope.slice(5)) - 1];
    pool = (w ? w.units : []).flatMap((id) => vocab.getUnit(id).items);
    if (!pool.length) pool = vocab.allItems();
  } else {
    const u = vocab.getUnit(scope);
    pool = u ? u.items : vocab.allItems();
  }
  if (pool.length < 4) pool = vocab.allItems();

  // 错得多的词优先出现
  const weighted = pool.map((it) => {
    const card = progress && progress.srs && progress.srs[it.id];
    return { it, w: 1 + (card ? (card.lapses || 0) * 2 : 0) + Math.random() };
  });
  weighted.sort((a, b) => b.w - a.w);
  const chosen = weighted.slice(0, Math.min(n, pool.length)).map((x) => x.it);
  const all = vocab.allItems();

  return chosen.map((it, idx) => {
    // 每 3 题中 1 题为听力题（听音选中文）；其余按看阿选中 / 看中选阿交替
    const listen = idx % 3 === 2;
    const amToZh = idx % 2 === 0;
    const distractorPool = shuffle(pool.length >= 8 ? pool : all).filter((d) => d.id !== it.id && d.zh !== it.zh).slice(0, 3);
    const options = shuffle([it, ...distractorPool]).map((d) => ({
      id: d.id,
      text: listen || amToZh ? d.zh : `${d.am}  ${d.rom}`
    }));
    const explain = `${it.am} (${it.rom}) ${it.zh}${it.note ? '｜' + it.note : ''}`;
    if (listen) {
      return {
        id: it.id,
        listen: true,
        audioText: it.am,
        prompt: '',
        promptAm: '',
        promptRom: '',
        promptZh: '',
        answer: it.id,
        options,
        explain
      };
    }
    return {
      id: it.id,
      prompt: amToZh ? `${it.am}\n${it.rom}` : it.zh,
      promptAm: amToZh ? it.am : '',
      promptRom: amToZh ? it.rom : '',
      promptZh: amToZh ? '' : it.zh,
      answer: it.id,
      options,
      explain
    };
  });
}

module.exports = { buildQuiz, shuffle };
