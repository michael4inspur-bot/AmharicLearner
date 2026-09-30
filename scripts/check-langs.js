// 语言包数据校验：结构、id 唯一、字段完整。纳入 npm test。用法：node scripts/check-langs.js
const path = require('path');
const assert = require('node:assert/strict');

const langs = require(path.join(__dirname, '..', 'miniprogram', 'langs', 'index.js'));

const STRING_KEYS = ['langName', 'askSay', 'thinkSay', 'modeShort', 'praise', 'praiseHigh', 'praiseMid', 'praiseLow',
  'searchPlaceholder', 'searchHint', 'copyHint', 'loginHello', 'loginSub', 'about'];
const ETHIOPIC = /[ሀ-᎟ⶀ-⷟꬀-꬯]/;

const seen = new Set();
function unique(id, where) {
  assert.ok(!seen.has(id), `id 重复：${id}（${where}）`);
  seen.add(id);
}

const metas = langs.list();
assert.ok(metas.length >= 1, '至少一个语言包');
assert.equal(metas[0].code, langs.DEFAULT, '第一个语言包是缺省语言');

metas.forEach((meta) => {
  const code = meta.code;
  const p = langs.pack(code);
  const at = (s) => `${code}: ${s}`;
  ['name', 'native'].forEach((k) => assert.ok(typeof meta[k] === 'string' && meta[k], at(`meta.${k}`)));
  assert.ok(['ethiopic', 'latin'].includes(meta.script), at('meta.script'));
  ['hasRom', 'scoring', 'beta'].forEach((k) => assert.equal(typeof meta[k], 'boolean', at(`meta.${k}`)));
  assert.ok(Array.isArray(meta.voices) && meta.voices.length >= 1, at('meta.voices'));
  STRING_KEYS.forEach((k) => assert.ok(typeof meta.strings[k] === 'string' && meta.strings[k], at(`meta.strings.${k}`)));

  assert.equal(p.units.length, 16, at('16 个单元'));
  const prefix = code === langs.DEFAULT ? '' : `${code}-`;
  const checkText = (x, where) => {
    assert.ok(typeof x.text === 'string' && x.text.trim(), at(`${where} 缺 text`));
    assert.ok(!('am' in x), at(`${where} 残留 am 字段`));
    assert.ok(typeof x.zh === 'string' && x.zh.trim(), at(`${where} 缺 zh`));
    if (meta.hasRom) assert.ok(typeof x.rom === 'string' && x.rom.trim(), at(`${where} 缺 rom`));
    if (meta.script === 'latin') assert.ok(!ETHIOPIC.test(x.text), at(`${where} 拉丁文字语言里混入了埃塞文字：${x.text}`));
  };
  p.units.forEach((u) => {
    assert.ok(u.id.startsWith(prefix), at(`单元 id 前缀 ${u.id}`));
    unique(u.id, code);
    u.items.forEach((it) => {
      assert.ok(it.id.startsWith(prefix), at(`词条 id 前缀 ${it.id}`));
      unique(it.id, code);
      checkText(it, it.id);
    });
    (u.dialog || []).forEach((d, i) => checkText(d, `${u.id} 对话第 ${i + 1} 行`));
  });
  p.plan.weeks.forEach((w) => {
    w.units.forEach((id) => assert.ok(p.getUnit(id), at(`第 ${w.week} 周单元 ${id} 不存在`)));
    if (w.extra) assert.ok(p.getUnit(w.extra), at(`第 ${w.week} 周自选单元 ${w.extra} 不存在`));
  });
  ['phone', 'site', 'formal'].forEach((k) => assert.ok(p.getUnit(p.badgeUnits[k]), at(`badgeUnits.${k}`)));
  assert.ok(Array.isArray(p.greetings) && p.greetings.length >= 1, at('greetings'));
  p.greetings.forEach((g, i) => checkText(g, `greetings[${i}]`));
});

// 注册表行为
assert.deepEqual(langs.view('am'), { L: langs.meta('am').strings, tc: 'am', hasRom: true });
assert.equal(langs.current(), langs.DEFAULT, '没有存储时是缺省语言');
assert.equal(langs.set('xx'), false, '未注册的语言不能切换');
assert.equal(langs.current(), langs.DEFAULT);

console.log(`OK: 语言包校验通过（${metas.map((m) => m.code).join(', ')}）`);
