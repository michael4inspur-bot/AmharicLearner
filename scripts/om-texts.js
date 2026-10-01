// 奥罗莫语全部待朗读文本：词条、对话、首页问候语、Qubee 例词。生成音频与校验共用。
const path = require('path');
const langs = require(path.join(__dirname, '..', 'miniprogram', 'langs', 'index.js'));

function collect() {
  const p = langs.pack('om');
  const set = new Set();
  const add = (t) => { const s = String(t == null ? '' : t).trim(); if (s) set.add(s); };
  p.units.forEach((u) => { u.items.forEach((it) => add(it.text)); (u.dialog || []).forEach((d) => add(d.text)); });
  p.greetings.forEach((g) => add(g.text));
  p.alphabet.groups.forEach((g) => g.rules.forEach((r) => r.examples.forEach((ex) => add(ex.text))));
  return [...set].sort((a, b) => a.localeCompare(b));
}

if (require.main === module) process.stdout.write(JSON.stringify(collect()));

module.exports = { collect };
