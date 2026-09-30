# 多语言骨架（第二版 PR 1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把小程序从「只有阿姆哈拉语」改造成「按语言包取数据、按语言分开存进度」的结构，此时仍只有阿姆哈拉语，用户可见行为不变。

**Architecture:** 新增 `miniprogram/langs/` 语言包注册表，页面与工具模块只通过它取词库、计划、字母表和界面文案；词条原文字段 `am` 统一改名 `text`。本地进度与云端进度按语言分开存储：阿姆哈拉语沿用原有键名与文档 id（零迁移），其他语言用带语言码的键。云函数 `progress.*` 增加 `lang` 参数并回显，前端对非阿姆哈拉语先确认云端支持再上传，防止旧版云函数把别的语言写进阿姆哈拉语文档。

**Tech Stack:** 微信小程序（WXML/WXSS/JS）、微信云函数（Node.js 20）、`node:test`、`scripts/sim-miniprogram.js` 端到端模拟。

**Spec:** `docs/superpowers/specs/2026-09-30-afan-oromo-design.md`（本计划实现其中第 7 节的 PR 1：2.1、2.2、2.3，以及第 4 节的文案抽取；字母页改名、奥罗莫语内容、语音、跟读分别在 PR 2–4 的计划里）

## Global Constraints

- 阿姆哈拉语的本地进度键仍为 `progress_v1`，云端进度文档仍为 `_id = openid`；老用户数据零迁移。
- 其他语言：本地键 `progress_<code>_v1`，云端文档 `_id = <openid>:<code>`。
- 语言码只接受 `am`、`om`；缺省 `am`。云函数收到其他值返回 `BAD_REQUEST`。
- 当前语言存本地存储 `lang_v1`。
- 词条与对话行原文字段一律叫 `text`，拉丁转写 `rom` 可选；不得残留 `am` 字段。
- 用户摘要（管理端列表）只由 `lang === 'am'` 的 `progress.put` 写入。
- `npm test` 全部通过才能提交；提交信息结尾带：
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ
  ```
- 只在分支 `claude/amharic-learning-wechat-app-phqk1c` 上开发与推送。

---

### Task 1: 云函数 progress 按语言分文档

**Files:**
- Modify: `cloudfunctions/api/handler.js`（顶部常量区；`case 'progress.get'` / `case 'progress.put'`，约 115–137 行）
- Modify: `cloudfunctions/api/db.js:127-130`（`deleteUserData`）
- Modify: `cloudfunctions/api/test/fakeDb.js:83-86`（`deleteUserData`）
- Test: `cloudfunctions/api/test/handler.progress.test.js`、`cloudfunctions/api/test/handler.admin.test.js`

**Interfaces:**
- Produces:
  - `progress.get` 入参 `{ lang?: 'am' | 'om' }`，返回 `{ progress, updatedAt, lang }`
  - `progress.put` 入参 `{ progress, meta?, baseUpdatedAt?, lang? }`，返回 `{ updatedAt, lang }`
  - 非法 `lang` → `{ ok: false, code: 'BAD_REQUEST' }`
  - `db.deleteUserData(openid)` 同时删除 `openid` 与 `openid:om` 两个进度文档

- [ ] **Step 1: 写失败的测试**

在 `cloudfunctions/api/test/handler.progress.test.js` 中，把第 2 个测试的期望改为带 `lang`：

```js
test('progress.get 无记录时返回 progress null', async () => {
  const res = await handle('progress.get', {}, ctx('u1', createFakeDb()));
  assert.deepEqual(res, { ok: true, data: { progress: null, updatedAt: null, lang: 'am' } });
});
```

把第 3 个测试的最后一行改为：

```js
  assert.deepEqual(got.data, { progress: { streak: 3 }, updatedAt: '2026-09-11T10:00:00.000Z', lang: 'am' });
```

在文件末尾追加：

```js
test('progress 按语言分文档：om 写到 openid:om，am 不受影响', async () => {
  const db = createFakeDb();
  const c = ctx('u1', db);
  await handle('progress.put', { progress: { v: 'am' } }, c);
  const put = await handle('progress.put', { progress: { v: 'om' }, lang: 'om' }, c);
  assert.equal(put.ok, true);
  assert.equal(put.data.lang, 'om');
  assert.equal((await db.getProgress('u1')).progress.v, 'am', '阿姆哈拉语文档没被覆盖');
  assert.equal((await db.getProgress('u1:om')).progress.v, 'om');
  const got = await handle('progress.get', { lang: 'om' }, c);
  assert.deepEqual(got.data, { progress: { v: 'om' }, updatedAt: '2026-09-11T10:00:00.000Z', lang: 'om' });
});

test('progress 的 lang 非法时返回 BAD_REQUEST', async () => {
  const c = ctx('u1', createFakeDb());
  assert.equal((await handle('progress.get', { lang: 'xx' }, c)).code, 'BAD_REQUEST');
  assert.equal((await handle('progress.put', { progress: {}, lang: 'fr' }, c)).code, 'BAD_REQUEST');
});

test('冲突检测按语言各自进行', async () => {
  const db = createFakeDb();
  const c = ctx('u1', db);
  const first = await handle('progress.put', { progress: { v: 1 }, lang: 'om' }, c);
  await db.putProgress('u1', { progress: { v: 'am-new' }, updatedAt: '2099-01-01T00:00:00.000Z' });
  const again = await handle('progress.put', { progress: { v: 2 }, lang: 'om', baseUpdatedAt: first.data.updatedAt }, c);
  assert.equal(again.ok, true, '阿姆哈拉语文档更新不影响奥罗莫语的冲突判断');
});

test('只有阿姆哈拉语的上传更新用户摘要', async () => {
  const db = createFakeDb();
  await db.putUser('u1', { _id: 'u1', status: 'active', createdAt: '2026-09-01T00:00:00.000Z' });
  const c = ctx('u1', db);
  await handle('progress.put', { progress: {}, meta: { week: 3, streak: 2, stars: 50 }, lang: 'om' }, c);
  assert.equal((await db.getUser('u1')).week, undefined, 'om 上传不写摘要');
  await handle('progress.put', { progress: {}, meta: { week: 3, streak: 2, stars: 50 } }, c);
  assert.equal((await db.getUser('u1')).week, 3);
});
```

在 `cloudfunctions/api/test/handler.admin.test.js` 的用例「admin.deleteUser：进度与日志被删，users 文档变 blocked 且保留昵称」（约 170 行）里：
- 在第 173 行 `await db.putProgress('u2', …)` 下面加一行：
  ```js
    await db.putProgress('u2:om', { progress: { streak: 1 }, updatedAt: NOW });
  ```
- 在第 179 行 `assert.equal(await db.getProgress('u2'), null);` 下面加一行：
  ```js
    assert.equal(await db.getProgress('u2:om'), null, '奥罗莫语进度一并删除');
  ```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test cloudfunctions/api/test/handler.progress.test.js cloudfunctions/api/test/handler.admin.test.js`
Expected: FAIL（返回值缺 `lang`；`u1:om` 读不到；`lang: 'xx'` 返回 ok；奥罗莫语进度没被删）

- [ ] **Step 3: 实现**

`cloudfunctions/api/handler.js` 顶部常量区（`ADMIN_PREFIXES` 下一行）加：

```js
const PROGRESS_LANGS = ['am', 'om'];

/** 进度的语言码：缺省为 am；不认识的返回 ''，由调用方回 BAD_REQUEST */
function progressLang(v) {
  if (v == null || v === '') return 'am';
  return PROGRESS_LANGS.includes(v) ? v : '';
}

/** 阿姆哈拉语沿用 _id = openid（老数据零迁移），其他语言为 openid:lang */
function progressId(openid, lang) {
  return lang === 'am' ? openid : `${openid}:${lang}`;
}
```

把 `case 'progress.get'` 与 `case 'progress.put'` 整体替换为：

```js
    case 'progress.get': {
      const lang = progressLang(data.lang);
      if (!lang) return fail('BAD_REQUEST', `lang 非法: ${data.lang}`);
      const doc = await db.getProgress(progressId(openid, lang));
      // 回显 lang：前端据此确认云函数已支持多语言，旧版云函数不会带这个字段
      return ok(doc ? { progress: doc.progress, updatedAt: doc.updatedAt, lang } : { progress: null, updatedAt: null, lang });
    }
    case 'progress.put': {
      if (!data.progress || typeof data.progress !== 'object') return fail('BAD_REQUEST', 'progress 必须是对象');
      const lang = progressLang(data.lang);
      if (!lang) return fail('BAD_REQUEST', `lang 非法: ${data.lang}`);
      const id = progressId(openid, lang);
      // 客户端可带上它上次读到的 updatedAt。云端更新过就拒绝，
      // 避免旧设备的快照静默覆盖新设备刚上传的进度。
      if (typeof data.baseUpdatedAt === 'string' && data.baseUpdatedAt) {
        const current = await db.getProgress(id);
        if (current && current.updatedAt && current.updatedAt > data.baseUpdatedAt) {
          return fail('CONFLICT', '云端有更新的进度，请先从云端恢复再上传');
        }
      }
      const updatedAt = now.toISOString();
      await db.putProgress(id, { progress: data.progress, updatedAt });
      // 摘要只服务于管理端列表，只看阿姆哈拉语；写失败不能让已经存好的进度上传变成失败
      if (lang === 'am') {
        try {
          await putUserSummary(ctx, now, data.meta);
        } catch (err) {
          console.error('写入用户摘要失败', err);
        }
      }
      return ok({ updatedAt, lang });
    }
```

`cloudfunctions/api/db.js` 的 `deleteUserData` 改为：

```js
  /** 删除某用户的全部语言进度文档与全部 ai_logs（where().remove() 服务端一次删多条）。 */
  async deleteUserData(openid) {
    await db.collection(PROGRESS).where({ _id: _.in([openid, `${openid}:om`]) }).remove();
    await db.collection(LOGS).where({ openid }).remove();
  },
```

`cloudfunctions/api/test/fakeDb.js` 的 `deleteUserData` 改为：

```js
    async deleteUserData(openid) {
      progress.delete(openid);
      progress.delete(`${openid}:om`);
      for (let i = logs.length - 1; i >= 0; i--) if (logs[i].openid === openid) logs.splice(i, 1);
    },
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: `# fail 0`，合规检查 OK，模拟 OK（模拟脚本只读 `fetched.progress`，不受多出的 `lang` 字段影响）

- [ ] **Step 5: 提交**

```bash
git add cloudfunctions/api/handler.js cloudfunctions/api/db.js cloudfunctions/api/test/fakeDb.js cloudfunctions/api/test/handler.progress.test.js cloudfunctions/api/test/handler.admin.test.js
git commit -m "feat(cloud): store progress per language and echo lang"
```

---

### Task 2: 语言包注册表，词库迁入 langs/am 并统一为 text 字段

**Files:**
- Create: `miniprogram/langs/index.js`
- Create: `miniprogram/langs/am/index.js`
- Move: `miniprogram/data/vocab.js` → `miniprogram/langs/am/vocab.js`
- Move: `miniprogram/data/plan.js` → `miniprogram/langs/am/plan.js`
- Move: `miniprogram/data/fidel.js` → `miniprogram/langs/am/alphabet.js`
- Create: `scripts/check-langs.js`
- Modify: `package.json`（`test` 脚本）
- Modify（`require` 与字段名）：`miniprogram/utils/progress.js`、`miniprogram/utils/quiz.js`、`miniprogram/utils/points.js`、`miniprogram/utils/audio.js`、`miniprogram/pages/{index,lessons,lesson,review,quiz,plan,fidel,search,speak}/*.js` 及对应 `.wxml`、`scripts/sim-miniprogram.js`

**Interfaces:**
- Produces（`miniprogram/langs/index.js`）：
  - `current(): string` 当前语言码
  - `set(code: string): boolean` 切换并持久化，未注册返回 false
  - `pack(code?: string): Pack` 语言包，缺省当前语言
  - `meta(code?: string): Meta`
  - `list(): Meta[]`
  - `onChange(fn: (code) => void): () => void` 返回取消订阅函数
  - `register(code: string, pack: Pack): void` 仅测试使用
  - `DEFAULT = 'am'`
- Produces（`Pack` 形状）：`{ meta, units, getUnit(id), getItem(id), allItems(), unitsForWeek(week), plan, alphabet, greetings: [{text, rom, zh}], badgeUnits: { phone, site, formal } }`
- Produces（`Meta` 形状）：`{ code, name, native, script: 'ethiopic' | 'latin', hasRom: boolean, voices: string[], scoring: boolean, beta: boolean, strings: {...} }`，`strings` 的键见 Task 4，本任务先放入完整对象
- 词条形状：`{ id, text, rom?, zh, note?, unit }`；对话行 `{ who, text, rom?, zh }`

- [ ] **Step 1: 写失败的校验脚本**

创建 `scripts/check-langs.js`：

```js
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
assert.equal(langs.current(), langs.DEFAULT, '没有存储时是缺省语言');
assert.equal(langs.set('xx'), false, '未注册的语言不能切换');
assert.equal(langs.current(), langs.DEFAULT);

console.log(`OK: 语言包校验通过（${metas.map((m) => m.code).join(', ')}）`);
```

在 `package.json` 的 `test` 脚本里，`check-privacy-scopes.js` 之前插入 `node scripts/check-langs.js &&`：

```json
    "test": "node --test cloudfunctions/api/test/*.test.js && node scripts/check-langs.js && node scripts/check-privacy-scopes.js && node scripts/sim-miniprogram.js"
```

- [ ] **Step 2: 运行，确认失败**

Run: `node scripts/check-langs.js`
Expected: FAIL，`Cannot find module '.../miniprogram/langs/index.js'`

- [ ] **Step 3: 迁移数据文件并改字段名**

```bash
mkdir -p miniprogram/langs/am
git mv miniprogram/data/vocab.js miniprogram/langs/am/vocab.js
git mv miniprogram/data/plan.js miniprogram/langs/am/plan.js
git mv miniprogram/data/fidel.js miniprogram/langs/am/alphabet.js
# 词条与对话行的原文字段 am → text（vocab.js 里 am: 只作为这两处的键出现）
sed -i "s/\bam: '/text: '/g" miniprogram/langs/am/vocab.js
grep -c "\bam: " miniprogram/langs/am/vocab.js   # 期望 0
```

把 `miniprogram/langs/am/vocab.js` 第 2 行的字段说明改为：

```js
// 字段：id、text（Fidel 原文）、rom（拉丁转写）、zh（中文）、note（用法/性别形式）
```

把 `miniprogram/langs/am/alphabet.js` 注释里的 `data/vocab.js` 改为 `langs/am/vocab.js`。

- [ ] **Step 4: 写阿姆哈拉语语言包入口**

创建 `miniprogram/langs/am/index.js`：

```js
// 阿姆哈拉语语言包：词库、8 周计划、Fidel 字母表与界面文案。
const vocab = require('./vocab.js');
const plan = require('./plan.js');
const alphabet = require('./alphabet.js');

const meta = {
  code: 'am',
  name: '阿姆哈拉语',
  native: 'አማርኛ',
  script: 'ethiopic',
  hasRom: true,
  voices: ['female', 'male'],
  scoring: true,
  beta: false,
  strings: {
    langName: '阿姆哈拉语',
    askSay: '阿姆哈拉语怎么说？',
    thinkSay: '在心里说出阿姆哈拉语',
    modeShort: '看阿',
    praise: 'ጥሩ ስራ!',
    praiseHigh: 'በጣም ጥሩ!',
    praiseMid: 'ጥሩ ነው',
    praiseLow: 'ችግር የለም',
    searchPlaceholder: '输入中文 / 转写 / 阿姆哈拉语，例如：多少钱、sint、ውሃ',
    searchHint: '长按阿姆哈拉语原文可复制，直接给对方看。',
    copyHint: '长按原文可复制',
    loginHello: 'ሰላም!',
    loginSub: '在埃塞工作的你，8 周学会用阿姆哈拉语沟通工作',
    about: '面向在埃塞俄比亚的中文使用者的阿姆哈拉语速成。'
  }
};

// 首页问候语。顺序约定（首页按下标取）：0 通用问候，1 早上好，2 下午好；全部也轮换作「每日一句」
const greetings = [
  { text: 'ሰላም', rom: 'selam', zh: '你好' },
  { text: 'እንደምን አደርክ?', rom: 'indemin aderk?', zh: '早上好（对男）' },
  { text: 'እንደምን ዋልሽ?', rom: 'indemin walsh?', zh: '下午好（对女）' },
  { text: 'ጥሩ ስራ!', rom: 'tiru sira!', zh: '干得好！' },
  { text: 'አማርኛ እማራለሁ', rom: 'Amarigna imaralehu', zh: '我在学阿姆哈拉语' }
];

// 徽章绑定的单元：电话达人 / 现场指挥 / 敬语大师
const badgeUnits = { phone: 'u15', site: 'u14', formal: 'u16' };

module.exports = {
  meta,
  units: vocab.units,
  getUnit: vocab.getUnit,
  getItem: vocab.getItem,
  allItems: vocab.allItems,
  unitsForWeek: vocab.unitsForWeek,
  plan,
  alphabet,
  greetings,
  badgeUnits
};
```

创建 `miniprogram/langs/index.js`：

```js
// 语言包注册表。页面和工具模块只通过这里取词库、计划、字母表和界面文案。
// 当前语言存本地 lang_v1，缺省阿姆哈拉语。
const KEY = 'lang_v1';
const DEFAULT = 'am';

const packs = { am: require('./am/index.js') };
const order = ['am'];
let cur = '';
const listeners = [];

function readStored() {
  try {
    const v = typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function' ? wx.getStorageSync(KEY) : '';
    return typeof v === 'string' ? v : '';
  } catch (e) { return ''; }
}

/** 当前语言码；存储里的值无效时回退到缺省语言 */
function current() {
  if (cur && packs[cur]) return cur;
  const v = readStored();
  cur = packs[v] ? v : DEFAULT;
  return cur;
}

/** 切换语言并持久化；未注册的语言返回 false */
function set(code) {
  if (!packs[code]) return false;
  if (code === current()) return true;
  cur = code;
  try { if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') wx.setStorageSync(KEY, code); } catch (e) { /* ignore */ }
  listeners.slice().forEach((fn) => { try { fn(code); } catch (e) { /* 一个订阅者出错不影响其他 */ } });
  return true;
}

function pack(code) { return packs[code] || packs[current()]; }
function meta(code) { return pack(code).meta; }
function list() { return order.map((c) => packs[c].meta); }

/** 订阅语言切换，返回取消订阅函数 */
function onChange(fn) {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
}

/** 只给测试使用：注册一个语言包 */
function register(code, p) {
  packs[code] = p;
  if (!order.includes(code)) order.push(code);
}

module.exports = { current, set, pack, meta, list, onChange, register, DEFAULT };
```

- [ ] **Step 5: 运行校验脚本，确认通过**

Run: `node scripts/check-langs.js`
Expected: `OK: 语言包校验通过（am）`

- [ ] **Step 6: 改所有使用方**

逐个文件替换 `require` 与字段。规则：`vocab.X(...)` → `langs.pack().X(...)`；`vocab.units` → `langs.pack().units`；`plan.X` → `langs.pack().plan.X`；`fidel.X` → `langs.pack().alphabet.X`；词条的 `.am` → `.text`。每个文件的具体改动：

`miniprogram/utils/progress.js`：第 2–3 行改为

```js
const langs = require('../langs/index.js');
```

并做以下替换（本任务只换数据来源和字段名，按语言分存储在 Task 3）：
- `currentPosition` 里两处 `plan.weeks` → `langs.pack().plan.weeks`
- `learnUnit` 里 `vocab.getUnit(unitId)` → `langs.pack().getUnit(unitId)`
- `dueCards` 里 `.map((id) => ({ ...vocab.getItem(id), card: p.srs[id] }))` → `.map((id) => ({ ...langs.pack().getItem(id), card: p.srs[id] }))`，`.filter((x) => x.am)` → `.filter((x) => x.text)`
- `summary` 里 `plan.weeks` → `langs.pack().plan.weeks`，`vocab.getUnit(id)` → `langs.pack().getUnit(id)`，`vocab.getItem(x.id)` → `langs.pack().getItem(x.id)`，`{ am: it.am, zh: it.zh, lapses: x.lapses }` → `{ text: it.text, zh: it.zh, lapses: x.lapses }`

`miniprogram/utils/quiz.js`：第 1–3 行改为

```js
// 生成选择题：题型混合（看原文选中文 / 看中文选原文 / 听音选中文），做提取练习。
const langs = require('../langs/index.js');
```

`buildQuiz` 函数体第一行加 `const vocab = langs.pack(); const plan = vocab.plan; const hasRom = vocab.meta.hasRom;`，其余 `vocab.`/`plan.` 调用保持原样即可生效。再把 `buildQuiz` 里词条字段改为：

```js
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
```

（`explain` 在有转写时仍是 `ሰላም (selam) 你好`，没有转写时是 `Akkam 你好`。）

`miniprogram/pages/quiz/quiz.wxml`：所有 `current.promptAm` → `current.promptText`。`miniprogram/pages/quiz/quiz.js`：`const vocab = require('../../data/vocab.js');` → `const langs = require('../../langs/index.js');`，`vocab.getUnit(scope)` → `langs.pack().getUnit(scope)`，`cur.promptAm` → `cur.promptText`，注释「播当前题的阿姆哈拉语」→「播当前题的原文」。

`miniprogram/utils/points.js`：第 2 行后加 `const langs = require('../langs/index.js');`，把 `BADGES` 里三处写死的单元改为读语言包：

```js
  { id: 'phone-pro', name: '电话达人', desc: '学完「电话与沟通」且小测 ≥ 80%',
    progress: (p) => { const u = langs.pack().badgeUnits.phone; const b = bestQuiz(p, u); return { done: !!p.unitsLearned[u] && b >= 80, text: p.unitsLearned[u] ? `小测最好 ${b}%，目标 80%` : '学完「电话与沟通」' }; } },
  { id: 'site-lead', name: '现场指挥', desc: '学完「现场与班组」并完成第 4 周实战',
    progress: (p) => { const u = langs.pack().badgeUnits.site; return { done: !!p.unitsLearned[u] && !!p.missions.w4, text: p.unitsLearned[u] ? '完成第 4 周实战任务' : '学完「现场与班组」' }; } },
  { id: 'formal-master', name: '敬语大师', desc: '学完「正式场合与敬语」且小测 ≥ 80%',
    progress: (p) => { const u = langs.pack().badgeUnits.formal; const b = bestQuiz(p, u); return { done: !!p.unitsLearned[u] && b >= 80, text: p.unitsLearned[u] ? `小测最好 ${b}%，目标 80%` : '学完「正式场合与敬语」' }; } },
```

`celebrate()` 里 `confirmText: 'ጥሩ ስራ!'` → `confirmText: langs.meta().strings.praise`。

`miniprogram/utils/audio.js`：`prefetch` 里 `String(it.text || it.am || '')` → `String(it.text || '')`，注释「也接受课程 item 的 am 字段」→「课程 item 的 text 字段」。

`miniprogram/pages/index/index.js`：删除 `GREETINGS` 常量和 `plan`/`vocab` 两个 require，改为 `const langs = require('../../langs/index.js');`。原来读 `GREETINGS` 的地方改读 `langs.pack().greetings`；`plan.weeks` / `plan.getDayTasks` → `langs.pack().plan.weeks` / `langs.pack().plan.getDayTasks`；`vocab.getUnit` → `langs.pack().getUnit`。`index.wxml` 里 `greet.am` → `greet.text`、`tip.am` → `tip.text`。

`miniprogram/pages/lessons/lessons.js`、`miniprogram/pages/plan/plan.js`：两个 require 换成 `const langs = require('../../langs/index.js');`，在用到的函数（`onShow`/`onLoad`）开头写 `const pk = langs.pack();`，`plan.` → `pk.plan.`，`vocab.` → `pk.`。`plan.js` 的 `data` 里 `principles: plan.principles, daily: plan.DAILY_TEMPLATE` 改为在 `onLoad` 里 `setData({ principles: pk.plan.principles, daily: pk.plan.DAILY_TEMPLATE })`，`data` 初值给 `principles: [], daily: {}`。

`miniprogram/pages/lesson/lesson.js`、`review/review.js`、`search/search.js`、`speak/speak.js`：require 换成 `langs`，`vocab.getUnit` / `vocab.getItem` / `vocab.allItems` → `langs.pack().…`。字段：
- `lesson.wxml`：所有 `item.am` → `item.text`
- `review.js`：`cur.am` → `cur.text`（两处）；`review.wxml`：`current.am` → `current.text`
- `search.js`：`ALL` 改为在 `onLoad` 里按当前语言构建（`this.all = buildIndex()`），`search()` 用 `this.all`：

```js
function buildIndex() {
  const pk = langs.pack();
  return pk.allItems().map((it) => ({
    ...it,
    unitTitle: (pk.getUnit(it.unit) || {}).title || '',
    hay: `${it.text} ${(it.rom || '').toLowerCase()} ${it.zh} ${it.note || ''}`.toLowerCase()
  }));
}
```

  `search()` 第一行改为 `const all = this.all || (this.all = buildIndex());`，下面的 `ALL` 换成 `all`（模拟脚本不调 `onLoad` 直接调 `search()`，要能自己建索引）。
  `search()` 里 `it.am === t` → `it.text.toLowerCase() === t`，`it.rom.toLowerCase().startsWith(t)` → `(it.rom || it.text).toLowerCase().startsWith(t)`；`search.wxml` 里 `item.am` → `item.text`，`<view class="rom">{{item.rom}}</view>` 加 `wx:if="{{item.rom}}"`
- `speak.js`：`this.data.item.am` → `this.data.item.text`（3 处，含 `api.sttScore(fileID, item.text)`）；`speak.wxml`：`item.am` → `item.text`，`<view class="rom">{{item.rom}}</view>` 加 `wx:if="{{item.rom}}"`

`miniprogram/pages/fidel/fidel.js`：`const fidel = require('../../data/fidel.js');` → `const langs = require('../../langs/index.js'); const fidel = langs.pack('am').alphabet;`（本页 PR 2 才改成通用字母页，这里固定取阿姆哈拉语）。

`scripts/sim-miniprogram.js`：第 89–90 行改为

```js
const langs = require(path.join(root, 'langs/index.js'));
const vocab = langs.pack('am');
const plan = vocab.plan;
```

第 162 行 `results[0].am` → `results[0].text`；第 298 行 `q9[2].promptAm` → `q9[2].promptText`。

- [ ] **Step 7: 确认没有残留**

Run: `grep -rn "data/vocab\|data/plan\|data/fidel\|\.am\b\|promptAm" miniprogram scripts --include=*.js --include=*.wxml | grep -v "class=\"am\|'am'"`
Expected: 无输出（`.am` 样式类名和语言码 `'am'` 不算）

- [ ] **Step 8: 运行全部测试**

Run: `npm test`
Expected: `# fail 0`、`OK: 语言包校验通过（am）`、合规检查 OK、`OK: miniprogram simulation passed`

- [ ] **Step 9: 提交**

```bash
git add -A miniprogram scripts package.json
git commit -m "refactor: move course data into language packs and rename am field to text"
```

---

### Task 3: 进度与同步按语言分开

**Files:**
- Modify: `miniprogram/utils/progress.js`（`KEY`、`cache`、`load`、`save`、`reset`、`replace`、`setOnSaved`）
- Modify: `miniprogram/utils/sync.js`（整文件）
- Modify: `miniprogram/utils/api.js`（`syncProgress`、`fetchProgress`）
- Modify: `miniprogram/app.js:20`
- Modify: `miniprogram/pages/profile/profile.js`（`upload`、`download`）
- Test: `scripts/sim-miniprogram.js`

**Interfaces:**
- Consumes: `langs.current()`、`langs.register()`（Task 2）；云端 `progress.*` 的 `lang` 参数与回显（Task 1）
- Produces:
  - `progress.load(code?: string)`、`progress.keyOf(code: string): string`
  - `progress.setOnSaved(fn: (p, code) => void)`
  - `api.syncProgress(progress, meta, baseUpdatedAt, lang = 'am')`、`api.fetchProgress(lang = 'am')`
  - `sync.syncNow(code?: string): Promise<boolean>`、`sync.scheduleSync(delayMs?, code?)`、`sync.noteRemoteVersion(updatedAt, code?)`
  - `sync.cloudSupports(code): Promise<boolean>`：非 `am` 时向云端 `progress.get` 探测是否回显同一个 `lang`

- [ ] **Step 1: 写失败的模拟测试**

在 `scripts/sim-miniprogram.js` 里，`progress.replace(realProgress);` 这一行（空进度不上传的断言之后）下面插入：

```js
  // 多语言：注册一个最小的测试语言包，验证进度与云端文档按语言分开
  const amPack = langs.pack('am');
  const omUnit = { id: 'om-u01', week: 1, title: '测试单元', items: [
    { id: 'om-u01-01', text: 'Akkam', zh: '你好', unit: 'om-u01' },
    { id: 'om-u01-02', text: 'Galatoomi', zh: '谢谢', unit: 'om-u01' }
  ], dialog: [] };
  langs.register('om', {
    ...amPack,
    meta: { ...amPack.meta, code: 'om', script: 'latin', hasRom: false },
    units: [omUnit],
    getUnit: (id) => (id === 'om-u01' ? omUnit : undefined),
    getItem: (id) => omUnit.items.find((it) => it.id === id),
    allItems: () => omUnit.items.slice(),
    unitsForWeek: (w) => (w === 1 ? [omUnit] : [])
  });
  assert.equal(progress.keyOf('am'), 'progress_v1', '阿姆哈拉语沿用老键名');
  assert.equal(progress.keyOf('om'), 'progress_om_v1');
  const amUnitsBefore = JSON.stringify(progress.load().unitsLearned);

  // 旧版云函数不回显 lang：不能把奥罗莫语进度传上去（会写进阿姆哈拉语文档）
  const realCallOld = wx.cloud.callFunction;
  const oldCloudActions = [];
  wx.cloud.callFunction = ({ data, success }) => {
    oldCloudActions.push(data.action);
    success({ result: { ok: true, data: data.action === 'progress.get' ? { progress: null, updatedAt: null } : { updatedAt: 'x' } } });
  };
  langs.set('om');
  progress.learnUnit('om-u01');
  assert.equal(await sync.syncNow(), false, '云端不支持多语言时不上传');
  assert.ok(!oldCloudActions.includes('progress.put'), '一次 progress.put 都没发');
  wx.cloud.callFunction = realCallOld;

  // 新版云函数：奥罗莫语进度写到 openid:om，阿姆哈拉语文档不受影响
  assert.ok(progress.load().srs['om-u01-01'], '奥罗莫语进度在奥罗莫语存储里');
  assert.equal(await sync.syncNow(), true, '云端支持后上传');
  const omDoc = await db.getProgress(`${simOpenid}:om`);
  assert.ok(omDoc && omDoc.progress.srs['om-u01-01'], '云端奥罗莫语文档');
  const amDoc = await db.getProgress(simOpenid);
  assert.ok(!amDoc.progress.srs['om-u01-01'], '阿姆哈拉语文档没混进奥罗莫语');
  const omFetched = await api.fetchProgress('om');
  assert.equal(omFetched.lang, 'om');
  assert.ok(omFetched.progress.unitsLearned['om-u01']);

  // 切回阿姆哈拉语，原进度完好
  langs.set('am');
  assert.equal(JSON.stringify(progress.load().unitsLearned), amUnitsBefore, '切回后阿姆哈拉语进度不变');
  assert.ok(!progress.load().srs['om-u01-01']);
  assert.ok(wx.getStorageSync('progress_om_v1').srs['om-u01-01'], '奥罗莫语进度存在自己的键下');
```

- [ ] **Step 2: 运行，确认失败**

Run: `node scripts/sim-miniprogram.js`
Expected: FAIL，`progress.keyOf is not a function`

- [ ] **Step 3: 实现 progress 按语言存储**

`miniprogram/utils/progress.js`：删除 `const KEY = 'progress_v1';` 和 `let cache = null;`，在 `const DAY = srs.DAY;` 之后加：

```js
/** 本地存储键：阿姆哈拉语沿用 progress_v1（老数据零迁移），其他语言 progress_<code>_v1 */
function keyOf(code) {
  return code === 'am' ? 'progress_v1' : `progress_${code}_v1`;
}

// 每种语言一份内存缓存
const caches = {};
```

把 `load`、`save`、`reset`、`replace`、`setOnSaved` 替换为：

```js
function load(code) {
  code = code || langs.current();
  if (caches[code]) return caches[code];
  try {
    caches[code] = sanitize(wx.getStorageSync(keyOf(code)));
  } catch (e) {
    caches[code] = defaultProgress();
  }
  return caches[code];
}

let onSaved = null;
/** fn(p, code)：每次保存后回调，code 是这份进度所属的语言 */
function setOnSaved(fn) { onSaved = fn; }

function save(p) {
  const code = langs.current();
  caches[code] = p;
  try { wx.setStorageSync(keyOf(code), p); } catch (e) { /* ignore */ }
  if (onSaved) onSaved(p, code);
  return p;
}

function reset() {
  const code = langs.current();
  delete caches[code];
  try { wx.removeStorageSync(keyOf(code)); } catch (e) { /* ignore */ }
  return load();
}

function replace(p) {
  const local = load();
  const next = sanitize(p);
  // 云端快照可能早于积分功能，缺这三个字段。浅合并会把本机已得的星星和徽章清零且不可逆，
  // 所以云端没有时保留本机的。
  if (!p || typeof p !== 'object' || p.stars == null) next.stars = local.stars || 0;
  if (!p || !p.starLog) next.starLog = local.starLog || {};
  if (!p || !p.badges) next.badges = local.badges || {};
  delete caches[langs.current()];
  return save(next);
}
```

`module.exports` 里加上 `keyOf`，并删掉重复的 `completeReflection`：

```js
module.exports = {
  todayStr, keyOf, load, save, reset, replace, sanitize, isEmpty, setOnSaved, currentPosition, todayLog, addMinutes, streak,
  learnUnit, dueCards, gradeCard, srsStats, recordQuiz, completeMission, completeReflection, completeFidelGroup, summary
};
```

- [ ] **Step 4: 实现 api 与 sync**

`miniprogram/utils/api.js` 的导出里两行改为：

```js
  syncProgress: (progress, meta, baseUpdatedAt, lang) => call('progress.put', { progress, meta, baseUpdatedAt, lang: lang || 'am' }),
  fetchProgress: (lang) => call('progress.get', { lang: lang || 'am' }),
```

`miniprogram/utils/sync.js` 整文件替换为：

```js
// 进度自动同步：小程序切后台或关键操作后静默上传；未配置后台或失败时不打扰用户。
// 每种语言各自一份同步状态，上传到云端各自的文档。
const api = require('./api.js');
const progress = require('./progress.js');
const account = require('./account.js');
const langs = require('../langs/index.js');

const states = {};
function state(code) {
  if (!states[code]) states[code] = { lastPayload: '', baseUpdatedAt: '', inFlight: null, supported: code === 'am' };
  return states[code];
}

function configured() {
  return api.configured();
}

/** 上传时附带的账号摘要，云端用来更新用户列表；计算失败不影响同步 */
function buildMeta(p) {
  try {
    return { week: progress.currentPosition(p).week, streak: progress.streak(p), stars: p.stars || 0 };
  } catch (e) {
    return { week: 0, streak: 0, stars: 0 };
  }
}

/**
 * 云函数是否已支持这种语言的进度。旧版云函数不认识 lang，会把奥罗莫语进度
 * 整份写进阿姆哈拉语文档，所以非阿姆哈拉语上传前先确认云端会回显同一个 lang。
 * 只缓存「支持」：不支持时下次再探测，负责人重新部署云函数后自动恢复同步。
 */
function cloudSupports(code) {
  const s = state(code);
  if (s.supported) return Promise.resolve(true);
  return api.fetchProgress(code)
    .then((r) => { s.supported = !!r && r.lang === code; return s.supported; })
    .catch(() => false);
}

function syncNow(code) {
  code = code || langs.current();
  if (!configured()) return Promise.resolve(false);
  // 没登记就不上传：用户还没勾选隐私同意，学习数据不该按 openid 存到云端
  if (!account.isRegistered()) return Promise.resolve(false);
  const s = state(code);
  const p = progress.load(code);
  // 全新的空进度绝不能上传：换手机或重装后只要打开一次再切后台，
  // 空进度就会整份覆盖云端，之前的学习记录永久丢失
  if (progress.isEmpty(p)) return Promise.resolve(false);
  const payload = JSON.stringify(p);
  if (payload === s.lastPayload) return Promise.resolve(false);
  // 同一份数据并发上传没有意义，只会重复写库
  if (s.inFlight) return s.inFlight;
  s.inFlight = cloudSupports(code)
    .then((ok) => {
      if (!ok) return false;
      return api.syncProgress(p, buildMeta(p), s.baseUpdatedAt, code)
        .then((r) => { s.lastPayload = payload; if (r && r.updatedAt) s.baseUpdatedAt = r.updatedAt; return true; });
    })
    .catch(() => false)
    .then((r) => { s.inFlight = null; return r; });
  return s.inFlight;
}

let timer = null;
const pending = new Set();
/** 延迟合并多次调用，避免频繁请求；期间改过进度的语言都会同步 */
function scheduleSync(delayMs, code) {
  pending.add(code || langs.current());
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const codes = [...pending];
    pending.clear();
    codes.forEach((c) => syncNow(c));
  }, delayMs == null ? 3000 : delayMs);
}

/** 从云端恢复后调用，记下这份数据对应的云端版本，之后上传才不会被判成旧快照 */
function noteRemoteVersion(updatedAt, code) {
  const s = state(code || langs.current());
  s.baseUpdatedAt = String(updatedAt || '');
  s.lastPayload = '';
}

module.exports = { syncNow, scheduleSync, configured, buildMeta, noteRemoteVersion, cloudSupports };
```

`miniprogram/app.js:20` 改为：

```js
    progress.setOnSaved((p, code) => sync.scheduleSync(3000, code));
```

`miniprogram/pages/profile/profile.js`：文件顶部加 `const langs = require('../../langs/index.js');`，`upload` / `download` 改为：

```js
  async upload() {
    const code = langs.current();
    const p = progress.load();
    try {
      if (!(await sync.cloudSupports(code))) throw new Error('云函数版本过旧，不支持这种语言的进度。请重新部署云函数 api。');
      await api.syncProgress(p, sync.buildMeta(p), undefined, code);
      wx.showToast({ title: '已上传到云端', icon: 'success' });
    } catch (e) { wx.showModal({ title: '上传失败', content: e.message, showCancel: false }); }
  },
  async download() {
    const code = langs.current();
    try {
      const r = await api.fetchProgress(code);
      if (code !== 'am' && (!r || r.lang !== code)) throw new Error('云函数版本过旧，不支持这种语言的进度。请重新部署云函数 api。');
      const { progress: remote, updatedAt } = r;
      if (!remote) { wx.showToast({ title: '云端没有数据', icon: 'none' }); return; }
      wx.showModal({
        title: '覆盖本地进度？', content: '将用云端的进度替换本机数据。',
        success: (res) => {
          if (!res.confirm) return;
          progress.replace(remote);
          sync.noteRemoteVersion(updatedAt, code); // 记下云端版本，之后上传不会被判成旧快照
          this.onShow();
          wx.showToast({ title: '已恢复', icon: 'success' });
        }
      });
    } catch (e) { wx.showModal({ title: '恢复失败', content: e.message, showCancel: false }); }
  },
```

- [ ] **Step 5: 运行全部测试**

Run: `npm test`
Expected: `# fail 0`，各项 OK，模拟里新增的多语言断言全部通过

- [ ] **Step 6: 提交**

```bash
git add miniprogram/utils/progress.js miniprogram/utils/sync.js miniprogram/utils/api.js miniprogram/app.js miniprogram/pages/profile/profile.js scripts/sim-miniprogram.js
git commit -m "feat: keep progress and cloud sync separate per language"
```

---

### Task 4: 页面文案与字体类改为读语言包

**Files:**
- Modify: `miniprogram/pages/{quiz,review,search,lesson,login,fidel,profile,speak,index}/*.{js,wxml}`
- Test: `scripts/sim-miniprogram.js`、`scripts/check-privacy-scopes.js`（不改，只确认通过）

**Interfaces:**
- Consumes: `langs.meta()`（Task 2），`meta.strings` 的全部键：`langName, askSay, thinkSay, modeShort, praise, praiseHigh, praiseMid, praiseLow, searchPlaceholder, searchHint, copyHint, loginHello, loginSub, about`
- Produces: 每个页面 `data.L`（= `meta.strings`）、`data.tc`（原文字体类：`script === 'ethiopic'` 为 `'am'`，否则 `'latin'`）、`data.hasRom`。PR 2 加奥罗莫语时，模板不再需要改动。

- [ ] **Step 1: 写失败的模拟测试**

在 `scripts/sim-miniprogram.js` 的「搜索页」断言后面加：

```js
  // 界面文案来自语言包，不写死在模板里
  const L = langs.meta('am').strings;
  searchPage.onLoad();
  assert.equal(searchPage.data.L.searchPlaceholder, L.searchPlaceholder, '搜索页文案来自语言包');
  assert.equal(searchPage.data.tc, 'am', '埃塞文字用 .am 字体类');
  const reviewPage = pageOf('review/review');
  reviewPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  reviewPage.data = { ...reviewPage.data };
  reviewPage.onShow();
  assert.equal(reviewPage.data.L.modeShort, '看阿');
  assert.equal(reviewPage.data.mode, 'text', '复习默认模式改名为 text');
```

并新增一个静态检查，确认模板里不再写死语言文案（放在模拟脚本末尾 `console.log('OK: …')` 之前）：

```js
  const fs = require('fs');
  const HARD = /阿姆哈拉语怎么说|在心里说出阿姆哈拉语|看阿<|ጥሩ ስራ|በጣም ጥሩ|ችግር የለም|ሰላም!/;
  ['quiz/quiz', 'review/review', 'search/search', 'login/login', 'fidel/fidel'].forEach((p) => {
    const wxml = fs.readFileSync(path.join(root, 'pages', p + '.wxml'), 'utf8');
    assert.ok(!HARD.test(wxml), `${p}.wxml 里还有写死的语言文案`);
  });
```

- [ ] **Step 2: 运行，确认失败**

Run: `node scripts/sim-miniprogram.js`
Expected: FAIL，`searchPage.data.L` 为 undefined

- [ ] **Step 3: 实现**

每个页面的 JS 都加一个同样的小函数（放在 `Page({` 之前）：

```js
function langView() {
  const m = langs.meta();
  return { L: m.strings, tc: m.script === 'ethiopic' ? 'am' : 'latin', hasRom: m.hasRom };
}
```

并在 `onLoad` 开头 `this.setData(langView());`；复习页没有 `onLoad`，放在 `onShow` 开头（tab 页常驻，切换语言后回到页面时也要刷新）。首页同理放在 `onShow` 开头。各页模板改动：

- `quiz/quiz.wxml`：`'阿姆哈拉语怎么说？'` → `L.askSay`；`class="am q-am"` → `class="{{tc}} q-am"`；`class="am"`（听力题原文）→ `class="{{tc}}"`；结果行改为 `<view class="{{tc}} result-am">{{pct >= 80 ? L.praiseHigh : pct >= 60 ? L.praiseMid : L.praiseLow}}</view>`
- `review/review.wxml`：`data-m="am"` 与 `mode==='am'` → `'text'`，按钮文字 `看阿` → `{{L.modeShort}}`；`在心里说出阿姆哈拉语` → `{{L.thinkSay}}`；`class="am fc-am"` → `class="{{tc}} fc-am"`；`fc-rom` 两处加 `wx:if="{{hasRom}}"`；`class="am done-am">ጥሩ ስራ!` → `class="{{tc}} done-am">{{L.praise}}`。`review.js` 的 `data.mode` 初值 `'am'` → `'text'`
- `search/search.wxml`：`placeholder="..."` → `placeholder="{{L.searchPlaceholder}}"`；提示行 → `{{L.searchHint}}`；`class="am word-am"` → `class="{{tc}} word-am"`
- `lesson/lesson.wxml`：`class="am ..."` → `class="{{tc}} ..."`；两处「显示/隐藏转写」标签外包 `wx:if="{{hasRom}}"`；`.rom` 行的 `wx:if="{{showRom}}"` → `wx:if="{{hasRom && showRom}}"`
- `speak/speak.wxml`：`class="am big"` → `class="{{tc}} big"`；`class="am word ..."` → `class="{{tc}} word ..."`
- `login/login.wxml`：`<view class="am hero-am">ሰላም!</view>` → `<view class="{{tc}} hero-am">{{L.loginHello}}</view>`；副标题 → `{{L.loginSub}}`
- `fidel/fidel.wxml`：`{{pct >= 70 ? 'ጥሩ ስራ!' : 'ችግር የለም'}}` → `{{pct >= 70 ? L.praise : L.praiseLow}}`（本页固定阿姆哈拉语，`fidel.js` 用 `langs.meta('am')` 构造 `L`）
- `index/index.wxml`：`class="hero-am am"` → `class="hero-am {{tc}}"`；`class="am am-lg"` → `class="{{tc}} am-lg"`；`.rom` 行加 `wx:if="{{hasRom}}"`
- `profile/profile.wxml:163` 关于文字 → `Amharic Learner · {{L.about}}学习计划依据成人学习特性设计：知道为什么学、自主导向、经验为本、问题驱动、微学习、间隔重复。`

在 `miniprogram/app.wxss` 的 `.am` 规则后面加一个拉丁文字的原文样式（PR 2 起用到，先定义）：

```css
/* 拉丁字母的外语原文（如奥罗莫语）：不用 Ethiopic 字体，字号与 .am 对齐 */
.latin { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; letter-spacing: 0.2rpx; }
```

- [ ] **Step 4: 运行全部测试**

Run: `npm test`
Expected: `# fail 0`，各项 OK

- [ ] **Step 5: 提交**

```bash
git add miniprogram
git add scripts/sim-miniprogram.js
git commit -m "refactor: read language-specific UI copy and fonts from the language pack"
```

---

### Task 5: 文档、版本号与 PR

**Files:**
- Modify: `README.md`（目录结构里 `data/` 一节 → `langs/`；接口表 `progress.get` / `progress.put` 增加 `lang` 参数说明）
- Modify: `miniprogram/config.js`（`buildTag`）
- Modify: `提审检查清单.md`（buildTag 文字）

- [ ] **Step 1: 更新文档与版本号**

`README.md`：
- 目录结构里的 `data/vocab.js`、`data/plan.js`、`data/fidel.js` 三行替换为：
  ```
  langs/index.js      语言包注册表（当前语言、切换、订阅）
  langs/am/           阿姆哈拉语：vocab.js 词库、plan.js 8 周计划、alphabet.js Fidel 字母表、index.js 元数据与界面文案
  ```
- 接口表 `progress.get` 行改为：`progress.get | { lang? } | 读取该语言的云端进度；返回 { progress, updatedAt, lang }。am 文档 _id = openid，其他语言 _id = openid:lang`
- 接口表 `progress.put` 行改为：`progress.put | { progress, meta?, baseUpdatedAt?, lang? } | 上传该语言的进度；只有 am 的上传更新用户摘要`

`miniprogram/config.js`：`buildTag: '2026-09-30 第二版开发（多语言骨架）'`

`提审检查清单.md`：Console 第一行示例里的 buildTag 同步改为 `2026-09-30 第二版开发（多语言骨架）`。

- [ ] **Step 2: 全量验证**

Run: `npm test`
Expected: `# fail 0`、`OK: 语言包校验通过（am）`、`OK: 合规静态检查通过`、`OK: miniprogram simulation passed`

Run: `grep -rn "data/vocab\|data/plan\|data/fidel" README.md miniprogram scripts`
Expected: 无输出

- [ ] **Step 3: 提交并推送**

```bash
git add README.md miniprogram/config.js 提审检查清单.md
git commit -m "docs: document language packs and per-language progress"
git push -u origin claude/amharic-learning-wechat-app-phqk1c
```

- [ ] **Step 4: 开 PR 到 main**

标题：`第二版 PR 1：多语言骨架（行为不变）`。正文说明：只有阿姆哈拉语、用户可见行为不变；云函数 `progress.*` 新增 `lang` 并回显，需要重新部署云函数；老数据零迁移。正文结尾：

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ
```

---

## 后续计划（PR 1 合并后再写）

- `docs/superpowers/plans/…-oromo-content.md`：奥罗莫语 16 单元词库、8 周计划、`pages/fidel` → `pages/alphabet` 通用字母页（计划任务类型 `fidel` → `alphabet`）、Qubee 页、语言切换入口（首页顶部、我的）、「试用版」标签，`check-langs.js` 自动覆盖新语言包。
- `docs/superpowers/plans/…-oromo-audio.md`：生成脚本、音频包与 manifest、`tts.*` 的 `om` 分支（免登录、不计额度）、前端 `lang` 透传与缓存 key、校对表。
- `docs/superpowers/plans/…-oromo-speak-compliance.md`：奥罗莫语跟读对比、「合成音」标注、关于页 MMS 署名、合规检查、提审清单更新。

## PR 1 执行后带入 PR 2 的事项（来自逐任务审查与终审）

写 PR 2 计划时必须包含：
- `progress.save/replace` 绑定到进度所属语言（如 `save(p, code)`），防止跨语言切换时把一种语言的进度写进另一种（例如「我的 → 从云端恢复」弹框期间切换语言）。
- `app.onHide` 同步所有待同步的语言（新增 `sync.flushPending()`），不只当前语言；后台时计时器可能被冻结。
- `scripts/check-langs.js`：问候语至少 3 条（首页按下标 1、2 取早上好/下午好）；覆盖 `onChange`、`register`、`lang_v1` 持久化；`langs.set(当前语言)` 也要写入 `lang_v1`。
- `langs.pack(code)` 传入未注册的语言码时报错或告警，而不是静默回退。
- `.latin` 样式补上与 `.am` 一致的字重和强调色，改正「字号与 .am 对齐」的注释。
- 模拟脚本断言拉丁语言分支（`tc === 'latin'`、`hasRom === false`），静态文案检查扩展到 index、lesson、speak、profile 模板。
- 课文页对话提示「先看着转写读，再遮住转写读」在没有转写的语言下改写。
- 实战任务键 `missions.w1/w4` 与徽章文案改为读语言包（规格 §2.3）。
- `cloudSupports` 在云端不支持时加时间退避，避免每次保存都完整拉一次 `progress.get`。
- 顺手清理：`quiz.js`、`review.js` 注释里残留的「阿姆哈拉语」；无人调用的 `progress.summary()`；提审清单第二节重新部署云函数的理由。
