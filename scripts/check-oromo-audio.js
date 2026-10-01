// 校验奥罗莫语音频包：每条待朗读文本两种语速都有文件；没有多余文件；总大小在云函数代码包可接受范围内。
const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { collect } = require('./om-texts.js');

const DIR = path.join(__dirname, '..', 'cloudfunctions', 'api', 'audio-om');
const RATES = ['normal', 'slow'];
const MAX_TOTAL = 15 * 1024 * 1024;
const key = (rate, text) => crypto.createHash('sha1').update(`om|${rate}|${text}`).digest('hex');

assert.ok(fs.existsSync(path.join(DIR, 'manifest.json')), '缺少 audio-om/manifest.json，请运行 python scripts/gen-oromo-audio.py');
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
const texts = collect();
const expected = new Set();
texts.forEach((t) => RATES.forEach((r) => {
  const name = `${key(r, t)}.mp3`;
  expected.add(name);
  assert.equal(manifest[`${r}|${t}`], name, `manifest 缺少或不一致：${r}|${t}（请重新运行 gen-oromo-audio.py）`);
  const st = fs.statSync(path.join(DIR, name));
  assert.ok(st.size > 500, `音频文件太小，可能损坏：${name}（${t}）`);
}));
assert.equal(Object.keys(manifest).length, expected.size, 'manifest 里有已不存在的文本，请运行 gen-oromo-audio.py --prune');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.mp3'));
const orphans = files.filter((f) => !expected.has(f));
assert.deepEqual(orphans, [], '有多余的音频文件，请运行 gen-oromo-audio.py --prune');
const total = files.reduce((s, f) => s + fs.statSync(path.join(DIR, f)).size, 0);
assert.ok(total <= MAX_TOTAL, `音频包 ${(total / 1048576).toFixed(1)}MB 超过 15MB，请把码率降到 24kbps`);
// 署名与许可说明随音频一起部署（非 mp3 文件，上面的文件检查只看 .mp3，云函数只按 manifest 取文件）
const notice = fs.readFileSync(path.join(DIR, 'NOTICE.txt'), 'utf8');
assert.ok(/mms-tts-orm/.test(notice) && /CC BY-NC 4\.0/.test(notice) && notice.includes('https://creativecommons.org/licenses/by-nc/4.0/'), 'audio-om/NOTICE.txt 缺少模型、许可或许可链接');
console.log(`OK: 奥罗莫语音频 ${texts.length} 条 × 2 种语速，共 ${(total / 1048576).toFixed(1)}MB`);
