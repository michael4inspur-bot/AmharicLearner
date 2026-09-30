// 生成奥罗莫语母语者校对表 docs/oromo-review.md。
// 用法：node scripts/gen-oromo-review.js          写文件
//       node scripts/gen-oromo-review.js --check  只比对，词库改了却没重新生成时失败（npm test 用）
const fs = require('fs');
const path = require('path');
const langs = require(path.join(__dirname, '..', 'miniprogram', 'langs', 'index.js'));

const OUT = path.join(__dirname, '..', 'docs', 'oromo-review.md');
const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function build() {
  const p = langs.pack('om');
  const lines = [
    '# 奥罗莫语校对表',
    '',
    '由 `node scripts/gen-oromo-review.js` 生成，请勿手改。请母语者逐行核对「奥罗莫语」一列的拼写与用词是否自然，在「意见」列写修改建议；中文意思不对也请指出。',
    '',
    '## 问候语（首页）',
    '',
    '| # | 奥罗莫语 | 中文 | 意见 |',
    '| --- | --- | --- | --- |',
    ...p.greetings.map((g, i) => `| ${i + 1} | ${cell(g.text)} | ${cell(g.zh)} |  |`),
    ''
  ];
  p.units.forEach((u) => {
    lines.push(`## ${u.id} ${cell(u.title)}`, '', '| id | 奥罗莫语 | 中文 | 备注 | 意见 |', '| --- | --- | --- | --- | --- |');
    u.items.forEach((it) => lines.push(`| ${it.id} | ${cell(it.text)} | ${cell(it.zh)} | ${cell(it.note)} |  |`));
    if (u.dialog && u.dialog.length) {
      lines.push('', '对话：', '', '| 说话人 | 奥罗莫语 | 中文 | 意见 |', '| --- | --- | --- | --- |');
      u.dialog.forEach((d) => lines.push(`| ${cell(d.who)} | ${cell(d.text)} | ${cell(d.zh)} |  |`));
    }
    lines.push('');
  });
  lines.push('## Qubee 拼写规则例词', '', '| 批次 | 规则 | 例词 | 中文 | 意见 |', '| --- | --- | --- | --- | --- |');
  p.alphabet.groups.forEach((g) => g.rules.forEach((r) => r.examples.forEach((ex) => {
    lines.push(`| ${g.group} | ${cell(r.pattern)} | ${cell(ex.text)} | ${cell(ex.zh)} |  |`);
  })));
  lines.push('');
  return lines.join('\n');
}

const text = build();
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== text) {
    console.error('docs/oromo-review.md 与词库不一致，请运行 node scripts/gen-oromo-review.js 重新生成');
    process.exit(1);
  }
  console.log('OK: 奥罗莫语校对表与词库一致');
} else {
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
}
