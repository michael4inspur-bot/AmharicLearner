// 生成选择题：题型混合（看原文选中文 / 看中文选原文 / 听音选中文），做提取练习。
const langs = require('../langs/index.js');

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
function buildQuiz(scope, n, progress, withAudio = true) {
  const vocab = langs.pack();
  const plan = vocab.plan;
  const hasRom = vocab.meta.hasRom;
  let pool;
  if (scope === 'all') {
    const learned = progress ? Object.keys(progress.unitsLearned || {}) : [];
    pool = (learned.length ? learned : vocab.units.map((u) => u.id)).flatMap((id) => (vocab.getUnit(id) || { items: [] }).items);
  } else if (scope.startsWith('week:')) {
    const w = plan.weeks[Number(scope.slice(5)) - 1];
    // 自选单元（extra）也要进题池，否则这 4 个单元共 93 个词 56 天内从不被小测覆盖
    const ids = w ? (w.extra ? [...w.units, w.extra] : w.units) : [];
    pool = ids.flatMap((id) => (vocab.getUnit(id) || { items: [] }).items);
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
    // 每 3 题中 1 题为听力题（听音选中文）。withAudio 为 false 时全部出成文字题：
    // 未登录用户用不了朗读，听力题题面是空的，根本答不了。
    const listen = withAudio && idx % 3 === 2;
    const amToZh = idx % 2 === 0;
    // 干扰项既要按 id 和中文去重，也要按原文去重：
    // 词库里有几组不同条目共用同一句原文，不去重就会出现两个文字完全相同的选项。
    const distractorPool = shuffle(pool.length >= 8 ? pool : all)
      .filter((d) => d.id !== it.id && d.zh !== it.zh && d.text !== it.text)
      .reduce((acc, d) => {
        if (acc.some((x) => x.text === d.text || x.zh === d.zh)) return acc;
        acc.push(d);
        return acc;
      }, [])
      .slice(0, 3);
    const label = (d) => (hasRom && d.rom ? `${d.text}  ${d.rom}` : d.text);
    const options = shuffle([it, ...distractorPool]).map((d) => ({
      id: d.id,
      text: listen || amToZh ? d.zh : label(d)
    }));
    const explain = `${it.text}${hasRom && it.rom ? ` (${it.rom})` : ''} ${it.zh}${it.note ? '｜' + it.note : ''}`;
    if (listen) {
      return {
        id: it.id,
        listen: true,
        audioText: it.text,
        prompt: '',
        promptText: '',
        promptRom: '',
        promptZh: '',
        answer: it.id,
        options,
        explain
      };
    }
    return {
      id: it.id,
      prompt: amToZh ? (hasRom && it.rom ? `${it.text}\n${it.rom}` : it.text) : it.zh,
      promptText: amToZh ? it.text : '',
      promptRom: amToZh && hasRom ? (it.rom || '') : '',
      promptZh: amToZh ? '' : it.zh,
      answer: it.id,
      options,
      explain
    };
  });
}

module.exports = { buildQuiz, shuffle };
