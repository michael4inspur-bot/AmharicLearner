'use strict';

// 发音评分纯函数：归一化、Levenshtein 相似度、逐词匹配。无外部依赖。

// 埃塞文字标点（፣ ። ፡）+ ASCII 标点（? ! , .）+ 所有空白
const STRIP_RE = /[፣።፡?!,.\s]+/gu;

/**
 * 归一化：去除标点与空白，做 NFC 归一。
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  if (typeof text !== 'string') return '';
  return text.normalize('NFC').replace(STRIP_RE, '');
}

/**
 * 标准动态规划 Levenshtein 距离（按 UTF-16 码元比较，埃塞文字均在 BMP 内）。
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // 删除
        curr[j - 1] + 1,    // 插入
        prev[j - 1] + cost  // 替换
      );
    }
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[n];
}

/**
 * 相似度 0–100 整数：两者归一化后 1 − 距离 / max(长度)。
 * 都空返回 100；一空一非空返回 0。
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na.length === 0 && nb.length === 0) return 100;
  if (na.length === 0 || nb.length === 0) return 0;
  const dist = levenshtein(na, nb);
  const ratio = 1 - dist / Math.max(na.length, nb.length);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * 目标句按空白分词，每词归一化后是否为识别文本归一化后的子串。
 * 返回项中的 w 保留原词形。
 * @param {string} target
 * @param {string} transcript
 * @returns {Array<{w: string, ok: boolean}>}
 */
function wordMatches(target, transcript) {
  if (typeof target !== 'string') return [];
  const nt = normalize(transcript);
  return target
    .split(/\s+/u)
    .filter((w) => w.length > 0)
    .map((w) => {
      const nw = normalize(w);
      return { w, ok: nw.length > 0 && nt.includes(nw) };
    });
}

module.exports = { normalize, similarity, wordMatches, levenshtein };
