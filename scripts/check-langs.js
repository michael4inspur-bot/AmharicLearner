// 语言包数据校验：结构、id 唯一、字段完整。纳入 npm test。用法：node scripts/check-langs.js
const path = require('path');
const assert = require('node:assert/strict');

const langs = require(path.join(__dirname, '..', 'miniprogram', 'langs', 'index.js'));
const config = require(path.join(__dirname, '..', 'miniprogram', 'config.js'));
// 校验所有语言包（含试用版），不受 config.showBetaLangs 的提审开关影响；结尾恢复原值
const showBetaShipped = config.showBetaLangs;
config.showBetaLangs = true;

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
  ['hasRom', 'scoring', 'beta', 'audio'].forEach((k) => assert.equal(typeof meta[k], 'boolean', at(`meta.${k}`)));
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
  assert.ok(typeof p.alphabet.name === 'string' && p.alphabet.name, at('alphabet.name'));
  assert.ok(/^\/pages\/\w+\/\w+$/.test(p.alphabet.page), at('alphabet.page'));
  p.plan.weeks.forEach((w) => assert.ok(Number.isInteger(w.alphabetGroup) && w.alphabetGroup >= 1 && w.alphabetGroup <= 5, at(`第 ${w.week} 周 alphabetGroup`)));
  for (let wk = 1; wk <= p.plan.weeks.length; wk += 1) {
    for (let d = 1; d <= 7; d += 1) {
      p.plan.getDayTasks(wk, d).forEach((t) => assert.notEqual(t.type, 'fidel', at('任务类型已统一为 alphabet')));
    }
  }
  // 对话任务说明不能提这门语言没有的东西（转写 / 跟读评分）
  for (let wk = 1; wk <= 7; wk += 1) {
    p.plan.getDayTasks(wk, 5).concat(p.plan.getDayTasks(wk, 6)).filter((t) => t.type === 'dialog').forEach((t) => {
      if (!meta.hasRom) assert.ok(!/转写/.test(t.desc), at(`第 ${wk} 周对话任务提到转写：${t.desc}`));
      if (!meta.scoring) assert.ok(!/评分/.test(t.desc), at(`第 ${wk} 周对话任务提到评分：${t.desc}`));
    });
  }
  ['phone', 'site', 'formal'].forEach((k) => assert.ok(p.getUnit(p.badgeUnits[k]), at(`badgeUnits.${k}`)));
  assert.ok(Array.isArray(p.greetings) && p.greetings.length >= 3, at('greetings 至少 3 条：首页按下标 1、2 取早上好 / 下午好'));
  p.greetings.forEach((g, i) => checkText(g, `greetings[${i}]`));
  if (meta.script === 'latin') {
    assert.equal(p.alphabet.groups.length, 5, at('Qubee 规则恰好 5 批'));
    p.alphabet.groups.forEach((g, i) => {
      assert.equal(g.group, i + 1, at(`第 ${i + 1} 批 group 编号`));
      assert.ok(g.rules.length >= 3, at(`第 ${g.group} 批至少 3 条规则`));
      g.rules.forEach((r) => {
        assert.ok(r.pattern && r.zh && r.examples.length >= 2, at(`第 ${g.group} 批规则 ${r.pattern} 不完整`));
        r.examples.forEach((ex) => checkText(ex, `Qubee 例词 ${ex.text}`));
        // 规则里列出的每个字母（组合）都要有例词，如 'l m n r s w y'
        if (/^[a-z]+( [a-z]+)+$/.test(r.pattern)) {
          r.pattern.split(' ').forEach((l) => assert.ok(r.examples.some((ex) => ex.text.toLowerCase().includes(l)),
            at(`第 ${g.group} 批规则 ${r.pattern} 的 ${l} 没有例词`)));
        }
        // 例词取自词库且中文一致，词库外的只有 alphabet.js 开头注明的两个
        const vocabZh = new Map(p.allItems().map((it) => [it.text, it.zh]));
        r.examples.forEach((ex) => {
          if (['Hara', 'Baddaa'].includes(ex.text)) return;
          assert.equal(vocabZh.get(ex.text), ex.zh, at(`Qubee 例词 ${ex.text} 不在词库里或中文不一致`));
        });
      });
    });
    [0, 1, 5].forEach((g) => {
      const qs = p.alphabet.buildQuiz(g, 10);
      assert.ok(qs.length >= 5, at(`第 ${g} 批小测题数`));
      qs.forEach((q) => {
        assert.equal(q.options.length, 4, at('每题 4 个选项'));
        assert.equal(new Set(q.options).size, 4, at('选项不重复'));
        assert.ok(q.options.includes(q.answer), at('选项含答案'));
      });
    });
    assert.ok(p.plan.principles.length >= 8, at('学习原则'));
    assert.ok(p.plan.weeks.every((w) => w.mission && w.milestone && w.theme), at('每周有主题、任务、里程碑'));
  }
});

// 阿姆哈拉语对话任务说明保持原文
assert.deepEqual(langs.pack('am').plan.getDayTasks(1, 5).filter((t) => t.type === 'dialog').map((t) => t.desc),
  ['本周单元的对话，读到不看转写，再用跟读页评分', '第二个单元的对话，同样读到不看转写']);

// 注册表行为
assert.deepEqual(langs.view('am'), { L: langs.meta('am').strings, tc: 'am', hasRom: true, audio: true });
assert.equal(langs.current(), langs.DEFAULT, '没有存储时是缺省语言');
assert.equal(langs.set('xx'), false, '未注册的语言不能切换');
assert.equal(langs.current(), langs.DEFAULT);

// 注册表：持久化、订阅、未注册语言
const store = {};
global.wx = { getStorageSync: (k) => store[k], setStorageSync: (k, v) => { store[k] = v; } };
assert.equal(langs.set(langs.DEFAULT), true);
assert.equal(store.lang_v1, langs.DEFAULT, '切到当前语言也写入 lang_v1');
assert.throws(() => langs.pack('nope'), /未注册的语言：nope/, '未注册的语言码报错，不静默回退');
const seenCodes = [];
const off = langs.onChange((c) => seenCodes.push(c));
langs.register('zz', langs.pack(langs.DEFAULT));
langs.set('zz');
langs.set('zz');
assert.deepEqual(seenCodes, ['zz'], '语言真的变化才通知，且只通知一次');
assert.equal(store.lang_v1, 'zz');
off();
langs.set(langs.DEFAULT);
assert.deepEqual(seenCodes, ['zz'], '取消订阅后不再通知');

// 试用版语言整体隐藏：showBetaLangs = false 时入口列表只剩正式语言，存着的试用版语言回退到缺省语言
store.lang_v1 = 'om';
assert.equal(langs.set('om'), true, '试用版显示时可以切到奥罗莫语');
assert.equal(langs.current(), 'om');
config.showBetaLangs = false;
try {
  // 上面注册的测试语言 zz 复用阿姆哈拉语包（meta.code 也是 am），去重后比较
  assert.deepEqual([...new Set(langs.list().map((m) => m.code))], ['am'], '隐藏试用版后入口只有阿姆哈拉语');
  assert.equal(langs.current(), langs.DEFAULT, '已选的奥罗莫语隐藏后回退到缺省语言');
  assert.equal(store.lang_v1, 'om', '回退不改存储，重新显示后回到用户选的语言');
  assert.equal(langs.set('om'), false, '隐藏的语言不能切换');
  assert.equal(langs.current(), langs.DEFAULT);
  assert.equal(langs.pack('om').meta.code, 'om', '按语言码取包不受影响（校对表、按语言同步）');
} finally {
  config.showBetaLangs = true;
}
assert.equal(langs.current(), 'om', '重新显示试用版后回到存储里的奥罗莫语');
assert.ok(langs.list().some((m) => m.code === 'om'));
langs.set(langs.DEFAULT);
delete global.wx;
config.showBetaLangs = showBetaShipped;

console.log(`OK: 语言包校验通过（${metas.map((m) => m.code).join(', ')}）`);
