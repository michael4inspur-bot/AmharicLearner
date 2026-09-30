# 奥罗莫语课程内容与语言切换（第二版 PR 2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户可以在首页和「我的」页把学习语言切到奥罗莫语，学习 16 个单元的奥罗莫语课程、8 周计划和 Qubee 字母规则；两种语言进度互不影响。奥罗莫语暂无语音（PR 3 才加），入口标「试用版」。

**Architecture:** 在 PR 1 的语言包骨架上新增 `langs/om/`。8 周计划的任务生成逻辑抽成共用的 `langs/plan-engine.js`，两个语言包各自只提供数据。字母页按语言包路由：阿姆哈拉语仍是 `pages/fidel`，奥罗莫语是新页 `pages/qubee`。语言包元数据新增 `audio` 开关，奥罗莫语为 `false`，前端所有朗读、听力、跟读入口据此隐藏或提示。同时落实 PR 1 审查带入的健壮性事项。

**Tech Stack:** 微信小程序（WXML/WXSS/JS）、Node.js 20、`node:test`、`scripts/sim-miniprogram.js`、`scripts/check-langs.js`。

**Spec:** `docs/superpowers/specs/2026-09-30-afan-oromo-design.md`（本计划实现第 7 节的 PR 2：2.1 的 om 语言包、2.4 字母页、3.6 的「试用版」、第 4 节的切换入口；并包含 PR 1 计划文末「带入 PR 2 的事项」）

## Global Constraints

- 阿姆哈拉语用户可见行为不变；本地进度 `progress_v1`、云端 `_id = openid` 不变。
- 奥罗莫语：语言码 `om`，id 前缀 `om-`（单元 `om-u01`…`om-u16`，词条 `om-u01-01`…），拉丁字母 Qubee 书写，**不含任何埃塞文字**，**没有 `rom` 字段**。
- 奥罗莫语 `meta`：`script: 'latin'`、`hasRom: false`、`voices: ['female']`、`scoring: false`、`beta: true`、`audio: false`。
- 本 PR 不调用任何奥罗莫语语音：`meta.audio === false` 时不得发起 `tts.*` 请求。
- 进度字段 `fidelGroupsDone` 保留原名（本地与云端老数据兼容），只改访问它的函数名。
- 提交信息结尾带：
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ
  ```
- 只在分支 `claude/amharic-learning-wechat-app-phqk1c` 上开发；`npm test` 全部通过才能提交；不用 `git stash`。

## 对规格的两处修订（本计划第 7 个任务同步写回规格）

- §2.4：不把 `pages/fidel` 改名为通用页，而是保留 `pages/fidel`（阿姆哈拉语）、新增 `pages/qubee`（奥罗莫语），由语言包的 `alphabet.page` 决定跳转。两种文字的交互完全不同，拆成两页比一个页面里分支渲染简单，也不影响现有 Fidel 页。
- §2.3：实战任务键 `missions.w1/w4` 不改为语言包配置。两种语言的 8 周结构一致，任务键按周编号，进度又按语言分开存，不会串。

---

### Task 1: 多语言健壮性（PR 1 审查带入事项）

**Files:**
- Modify: `miniprogram/langs/index.js`（`set`、`pack`）
- Modify: `miniprogram/utils/progress.js`（`save`、`replace`）
- Modify: `miniprogram/utils/sync.js`（`cloudSupports`、新增 `flushPending`）
- Modify: `miniprogram/app.js`（`onHide`）
- Modify: `miniprogram/pages/profile/profile.js`（`download`）
- Modify: `scripts/check-langs.js`、`scripts/sim-miniprogram.js`

**Interfaces:**
- Produces:
  - `langs.set(code)`：切换到当前语言时也写入 `lang_v1`；只有语言真的变化才通知订阅者
  - `langs.pack(code)`：传入未注册的语言码时抛 `Error('未注册的语言：<code>')`；不传参数时返回当前语言
  - `progress.save(p, code?)`、`progress.replace(p, code?)`：写入指定语言，缺省当前语言
  - `sync.cloudSupports(code, opts?: { force?: boolean })`：不支持时 10 分钟内不再探测，`force` 跳过这个间隔
  - `sync.flushPending(): Promise<boolean[]>`：立即同步所有待同步的语言和当前语言

- [ ] **Step 1: 写失败的测试**

在 `scripts/check-langs.js` 里：
- 把 `assert.ok(Array.isArray(p.greetings) && p.greetings.length >= 1, at('greetings'));` 改为 `assert.ok(Array.isArray(p.greetings) && p.greetings.length >= 3, at('greetings 至少 3 条：首页按下标 1、2 取早上好 / 下午好'));`
- 在文件末尾 `console.log` 之前追加注册表测试：

```js
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
delete global.wx;
```

在 `scripts/sim-miniprogram.js` 的多语言块（`langs.register('om', {...})` 那一段）里：
- 在「新版云函数」注释那行下面、`assert.ok(progress.load().srs['om-u01-01'] …` 之前插入：

```js
  assert.equal(await sync.syncNow(), false, '刚探测过不支持，10 分钟内不再探测');
  assert.equal(await sync.cloudSupports('om', { force: true }), true, 'force 立即重新探测');
```

- 在 `langs.set('am');`（切回阿姆哈拉语）之前插入：

```js
  // 进度对象绑定到它所属的语言：切换语言后再保存，也不会写进另一种语言
  const omHeld = progress.load();
  langs.set('am');
  omHeld.stars = 7;
  progress.save(omHeld, 'om');
  assert.notEqual(progress.load().stars, 7, '阿姆哈拉语进度没被写入');
  assert.equal(progress.load('om').stars, 7, '奥罗莫语进度按指定语言保存');
  langs.set('om');
  // 切后台时两种语言都同步
  progress.addMinutes(1);
  langs.set('am');
  progress.addMinutes(1);
  const flushed = await sync.flushPending();
  assert.ok(flushed.length >= 2 && flushed.every((r) => r === true), '切后台时所有有改动的语言都上传');
```

- [ ] **Step 2: 运行，确认失败**

Run: `node scripts/check-langs.js; node scripts/sim-miniprogram.js`
Expected: check-langs 在「切到当前语言也写入 lang_v1」或「未注册的语言码报错」处失败；sim 在「刚探测过不支持」处失败

- [ ] **Step 3: 实现**

`miniprogram/langs/index.js` 的 `set` 与 `pack` 改为：

```js
/** 切换语言并持久化；未注册的语言返回 false。语言真的变化才通知订阅者 */
function set(code) {
  if (!packs[code]) return false;
  const changed = code !== current();
  cur = code;
  try { if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') wx.setStorageSync(KEY, code); } catch (e) { /* ignore */ }
  if (changed) listeners.slice().forEach((fn) => { try { fn(code); } catch (e) { /* 一个订阅者出错不影响其他 */ } });
  return true;
}

/** 语言包。不传参数取当前语言；传了未注册的语言码直接报错，避免静默拿到别的语言的数据 */
function pack(code) {
  if (code == null) return packs[current()];
  if (!packs[code]) throw new Error(`未注册的语言：${code}`);
  return packs[code];
}
```

`miniprogram/utils/progress.js` 的 `save` 与 `replace` 改为：

```js
/** 保存进度。code 是这份进度所属的语言；页面拿着进度对象跨过语言切换时必须传 */
function save(p, code) {
  code = code || langs.current();
  caches[code] = p;
  try { wx.setStorageSync(keyOf(code), p); } catch (e) { /* ignore */ }
  if (onSaved) onSaved(p, code);
  return p;
}

function replace(p, code) {
  code = code || langs.current();
  const local = load(code);
  const next = sanitize(p);
  // 云端快照可能早于积分功能，缺这三个字段。浅合并会把本机已得的星星和徽章清零且不可逆，
  // 所以云端没有时保留本机的。
  if (!p || typeof p !== 'object' || p.stars == null) next.stars = local.stars || 0;
  if (!p || !p.starLog) next.starLog = local.starLog || {};
  if (!p || !p.badges) next.badges = local.badges || {};
  delete caches[code];
  return save(next, code);
}
```

`miniprogram/utils/sync.js`：
- `state()` 初值里加 `checkedAt: 0`。
- `cloudSupports` 替换为：

```js
const PROBE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * 云函数是否已支持这种语言的进度。旧版云函数不认识 lang，会把奥罗莫语进度
 * 整份写进阿姆哈拉语文档，所以非阿姆哈拉语上传前先确认云端会回显同一个 lang。
 * 支持就一直缓存；不支持时 10 分钟内不再探测（每次探测都要拉一整份进度），
 * opts.force 用于用户手动上传 / 恢复时立即重新探测。
 */
function cloudSupports(code, opts) {
  const s = state(code);
  if (s.supported) return Promise.resolve(true);
  if (!(opts && opts.force) && s.checkedAt && Date.now() - s.checkedAt < PROBE_INTERVAL_MS) return Promise.resolve(false);
  s.checkedAt = Date.now();
  return api.fetchProgress(code)
    .then((r) => { s.supported = !!r && r.lang === code; return s.supported; })
    .catch(() => false);
}
```

- 在 `noteRemoteVersion` 之前加：

```js
/** 立即同步所有待同步的语言和当前语言（切后台时用：后台计时器可能被冻结） */
function flushPending() {
  if (timer) { clearTimeout(timer); timer = null; }
  const codes = new Set([...pending, langs.current()]);
  pending.clear();
  return Promise.all([...codes].map((c) => syncNow(c)));
}
```

- `module.exports` 加上 `flushPending`。

`miniprogram/app.js` 的 `onHide` 改为：

```js
  onHide() {
    // 切到后台时把所有有改动的语言的进度静默上传（未配置云环境时跳过）
    sync.flushPending();
  }
```

`miniprogram/pages/profile/profile.js`：
- `upload` 里 `sync.cloudSupports(code)` → `sync.cloudSupports(code, { force: true })`
- `download` 里 `progress.replace(remote);` → `progress.replace(remote, code);`

- [ ] **Step 4: 运行全部测试**

Run: `npm test`
Expected: `# fail 0`，各项 OK

- [ ] **Step 5: 提交**

```bash
git add miniprogram/langs/index.js miniprogram/utils/progress.js miniprogram/utils/sync.js miniprogram/app.js miniprogram/pages/profile/profile.js scripts/check-langs.js scripts/sim-miniprogram.js
git commit -m "fix: bind saves to their language, flush all languages on hide, back off cloud probes"
```

---

### Task 2: 计划引擎共用，字母页按语言包路由

**Files:**
- Create: `miniprogram/langs/plan-engine.js`
- Modify: `miniprogram/langs/am/plan.js`（改用引擎；周数据字段 `fidelGroup` → `alphabetGroup`）
- Modify: `miniprogram/langs/am/alphabet.js`（导出 `name`、`page`）
- Modify: `miniprogram/utils/progress.js`（`completeFidelGroup` → `completeAlphabetGroup`）
- Modify: `miniprogram/utils/points.js`（`STAR_RULES.fidel` → `STAR_RULES.alphabet`）
- Modify: `miniprogram/pages/fidel/fidel.js`、`miniprogram/pages/index/index.{js,wxml}`、`miniprogram/pages/lessons/lessons.{js,wxml}`、`miniprogram/pages/plan/plan.{js,wxml}`
- Modify: `miniprogram/app.wxss`（`.latin`）、`miniprogram/pages/lesson/lesson.wxml`（对话提示）
- Test: `scripts/sim-miniprogram.js`、`scripts/check-langs.js`

**Interfaces:**
- Produces（`plan-engine.js`）：`createPlan({ weeks, week8Missions, principles, alphabet: { name, groupDesc, finalDesc } })` → `{ weeks, getDayTasks(week, day), planOutline(), principles, DAILY_TEMPLATE }`。任务类型 `'alphabet'`（替代 `'fidel'`），带 `group`。周数据字段 `alphabetGroup`。
- Produces（语言包 `alphabet`）：`alphabet.name: string`（如 `'Fidel 字母表'`），`alphabet.page: string`（如 `'/pages/fidel/fidel'`）
- Produces：`progress.completeAlphabetGroup(group)`（写入保留原名的 `fidelGroupsDone`）；`points.award('alphabet')`

- [ ] **Step 1: 写失败的测试**

`scripts/check-langs.js` 在每个语言包的循环里（`p.plan.weeks.forEach` 之后）加：

```js
  assert.ok(typeof p.alphabet.name === 'string' && p.alphabet.name, at('alphabet.name'));
  assert.ok(/^\/pages\/\w+\/\w+$/.test(p.alphabet.page), at('alphabet.page'));
  p.plan.weeks.forEach((w) => assert.ok(Number.isInteger(w.alphabetGroup) && w.alphabetGroup >= 1 && w.alphabetGroup <= 5, at(`第 ${w.week} 周 alphabetGroup`)));
  for (let wk = 1; wk <= p.plan.weeks.length; wk += 1) {
    for (let d = 1; d <= 7; d += 1) {
      p.plan.getDayTasks(wk, d).forEach((t) => assert.notEqual(t.type, 'fidel', at('任务类型已统一为 alphabet')));
    }
  }
```

`scripts/sim-miniprogram.js`：在「工作沟通主线」断言块末尾加：

```js
  assert.ok(plan.getDayTasks(1, 1).some((t) => t.type === 'alphabet' && t.group === 1 && /Fidel 字母表 第 1 批/.test(t.title)), '字母任务按语言包命名');
  assert.equal(vocab.alphabet.page, '/pages/fidel/fidel');
```

- [ ] **Step 2: 运行，确认失败**

Run: `node scripts/check-langs.js`
Expected: FAIL `am: alphabet.name`

- [ ] **Step 3: 实现计划引擎**

创建 `miniprogram/langs/plan-engine.js`，内容为把现在 `langs/am/plan.js` 里的 `DAILY_TEMPLATE`、`extraTask`、`getDayTasks`、`planOutline` 原样搬过来，改成由参数提供数据：

```js
// 8 周计划的任务生成逻辑，两个语言包共用；语言包只提供周数据、第 8 周实战、学习原则和字母批次名称。
const DAILY_TEMPLATE = {
  reviewMinutes: 8,
  learnMinutes: 15,
  practiceMinutes: 10
};

/**
 * @param {object} cfg
 * @param {Array} cfg.weeks 周数据：{ week, theme, goal, why, units, extra, alphabetGroup, mission, milestone, reviewWeek? }
 * @param {string[]} cfg.week8Missions 第 8 周 5 个实战任务名
 * @param {Array} cfg.principles 学习原则 [{ title, desc }]
 * @param {object} cfg.alphabet { name: 字母页名称, groupDesc: 每批字母任务说明, finalDesc: 结业字母自测说明 }
 */
function createPlan(cfg) {
  const { weeks, week8Missions, principles, alphabet } = cfg;

  function extraTask(w, kind) {
    if (!w.extra) return null;
    if (kind === 'dialog') {
      // 自选单元也有对话，不给跟读任务的话这 4 个单元的对话永远练不到
      return { type: 'dialog', title: `自选对话：${w.extra}`, desc: '补充单元的对话，时间充裕再练', minutes: 6, unit: w.extra, optional: true };
    }
    return { type: 'learn', title: `自选：${w.extra}`, desc: '生活场景补充单元，时间充裕再学', minutes: 10, unit: w.extra, optional: true };
  }

  /**
   * 生成某周第 day 天（1–7）的任务列表。
   * 节奏：第 1–2 天学单元 A，第 3–4 天学单元 B，第 5 天对话与小测，第 6 天实战任务，第 7 天复盘。
   * 自选单元（extra）在第 5 天出词句、第 6 天出对话，都是可选任务。
   */
  function getDayTasks(week, day) {
    // （函数体：把 langs/am/plan.js 现有 getDayTasks 的函数体整段复制过来，只做下面三处替换）
    //  1. WEEK8_MISSIONS[day - 1]              → week8Missions[day - 1]
    //  2. { type: 'fidel', title: 'Fidel 全表自测', desc: '认读全部 33 个基础辅音', minutes: 8, group: 5 }
    //     → { type: 'alphabet', title: `${alphabet.name} 全表自测`, desc: alphabet.finalDesc, minutes: 8, group: 5 }
    //  3. { type: 'fidel', title: `Fidel 第 ${w.fidelGroup} 批`, desc: '认读本批字母的 7 序', minutes: DAILY_TEMPLATE.practiceMinutes, group: w.fidelGroup }
    //     → { type: 'alphabet', title: `${alphabet.name} 第 ${w.alphabetGroup} 批`, desc: alphabet.groupDesc, minutes: DAILY_TEMPLATE.practiceMinutes, group: w.alphabetGroup }
  }

  /** 计划大纲（精简版） */
  function planOutline() {
    return {
      totalWeeks: weeks.length,
      dailyMinutes: DAILY_TEMPLATE.reviewMinutes + DAILY_TEMPLATE.learnMinutes + DAILY_TEMPLATE.practiceMinutes,
      goal: '工作沟通优先（IT/通信/设备交付：司机后勤、一线班组、办公室同事、客户与政府），生活场景为自选补充',
      weeks: weeks.map((w) => ({ week: w.week, theme: w.theme, units: w.units, extra: w.extra, mission: w.mission, milestone: w.milestone, reviewWeek: !!w.reviewWeek }))
    };
  }

  return { weeks, getDayTasks, planOutline, principles, DAILY_TEMPLATE };
}

module.exports = { createPlan, DAILY_TEMPLATE };
```

（上面 `getDayTasks` 里的注释是给实现者的替换说明：最终文件里 `getDayTasks` 必须是完整函数体，不能留这段说明。`alphabet` 参数因此是 `{ name, groupDesc, finalDesc }` 三个字段。）

`miniprogram/langs/am/plan.js`：
- 删除 `DAILY_TEMPLATE`、`extraTask`、`getDayTasks`、`planOutline` 四个定义；
- 周数据里的 `fidelGroup:` 全部改为 `alphabetGroup:`（`sed -i 's/fidelGroup:/alphabetGroup:/' miniprogram/langs/am/plan.js`）；
- 文件末尾 `module.exports` 改为：

```js
const { createPlan } = require('../plan-engine.js');

module.exports = createPlan({
  weeks,
  week8Missions: WEEK8_MISSIONS,
  principles,
  alphabet: { name: 'Fidel 字母表', groupDesc: '认读本批字母的 7 序', finalDesc: '认读全部 33 个基础辅音' }
});
```

`miniprogram/langs/am/alphabet.js` 的 `module.exports` 加上 `name: 'Fidel 字母表', page: '/pages/fidel/fidel'`。

- [ ] **Step 4: 改使用方**

- `progress.js`：`function completeFidelGroup(group)` 改名 `completeAlphabetGroup`，函数上方加注释 `// 字母批次完成记录。字段名 fidelGroupsDone 沿用老名字，本地和云端老数据才能直接读`；导出列表同步改名；`summary()` 里的 `fidelGroupsDone` 字段不动（Task 7 删除整个 summary）。
- `points.js`：`fidel: 15         // Fidel 批次通过` → `alphabet: 15      // 字母批次通过`。
- `pages/fidel/fidel.js`：`progress.completeFidelGroup` → `progress.completeAlphabetGroup`，`points.award('fidel')` → `points.award('alphabet')`。
- `pages/index/index.js`：`TASK_STARS` 里 `fidel: R.fidel` → `alphabet: R.alphabet`；`decorate` 里 `case 'fidel':` → `case 'alphabet':`；`go` 的跳转 `case 'fidel': wx.navigateTo({ url: \`/pages/fidel/fidel?group=${t.group}\` })` → `case 'alphabet': wx.navigateTo({ url: \`${langs.pack().alphabet.page}?group=${t.group}\` })`；`goFidel` 改名 `goAlphabet`，跳转 `${langs.pack().alphabet.page}?group=${this.data.week.alphabetGroup}`；`refresh()` 的 `setData` 里加 `alphabetName: pk.alphabet.name`。
- `pages/index/index.wxml`：`bindtap="goFidel"` → `bindtap="goAlphabet"`；`Fidel 字母表` → `{{alphabetName}}`；`week.fidelGroup` → `week.alphabetGroup`；图标 `<text class="am">ፊ</text>` → `<text class="{{tc}}">{{tc === 'am' ? 'ፊ' : 'Q'}}</text>`。
- `pages/lessons/lessons.js`：`goFidel` 改名 `goAlphabet`，跳转 `${langs.pack().alphabet.page}?group=${e.currentTarget.dataset.group}`；`onShow` 的 `setData` 加 `alphabetName: pk.alphabet.name`，并 `this.setData(langs.view())`。`lessons.wxml`：`data-group="{{w.fidelGroup}}" bindtap="goFidel"` → `data-group="{{w.alphabetGroup}}" bindtap="goAlphabet"`；`Fidel 字母 第 {{w.fidelGroup}} 批` → `{{alphabetName}} 第 {{w.alphabetGroup}} 批`；图标同 index。
- `pages/plan/plan.js`：`onLoad` 的 `setData` 加 `alphabetName: pk.alphabet.name`；`plan.wxml`：`Fidel 第 {{w.fidelGroup}} 批` → `{{alphabetName}} 第 {{w.alphabetGroup}} 批`。
- `miniprogram/app.wxss` 的 `.latin` 改为（与 `.am` 同样加粗与强调色，去掉不准确的注释）：

```css
/* 拉丁字母的外语原文（如奥罗莫语）：不用 Ethiopic 字体，字重与颜色与 .am 一致 */
.latin { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; font-weight: 700; color: var(--accent); letter-spacing: 0.2rpx; }
```

- `pages/lesson/lesson.wxml`：对话区里写死的「先看着转写读，再遮住转写读」外包 `wx:if="{{hasRom}}"`，并加一行 `<view class="muted" wx:else>先跟着读，再遮住中文自己说</view>`（保持原有的 class；如果原句不在单独的元素里，就把它拆成单独的 `<view>` 再加判断）。

- [ ] **Step 5: 运行全部测试**

Run: `npm test`
Expected: `# fail 0`，各项 OK；`grep -rn "fidelGroup\b\|'fidel'\|completeFidelGroup\|goFidel" miniprogram scripts` 无输出

- [ ] **Step 6: 提交**

```bash
git add miniprogram scripts
git commit -m "refactor: share the 8-week plan engine and route the alphabet page by language pack"
```

---

### Task 3: 语言包 `audio` 开关

**Files:**
- Modify: `miniprogram/langs/am/index.js`（`meta.audio: true`）、`miniprogram/langs/index.js`（`view()` 加 `audio`）
- Modify: `miniprogram/utils/audio.js`（`speak`、`prefetch`）
- Modify: `miniprogram/pages/quiz/quiz.{js,wxml}`、`review/review.wxml`、`lesson/lesson.wxml`、`search/search.wxml`
- Test: `scripts/check-langs.js`、`scripts/sim-miniprogram.js`

**Interfaces:**
- Produces：`meta.audio: boolean`；`langs.view()` 返回 `{ L, tc, hasRom, audio }`
- `audio.speak(text, opts)`：当前语言 `meta.audio === false` 时不发请求；非 `silent` 时 toast `「<语言名>发音即将上线」`
- `audio.prefetch(items)`：`meta.audio === false` 时直接返回

- [ ] **Step 1: 写失败的测试**

`scripts/check-langs.js`：`['hasRom', 'scoring', 'beta']` → `['hasRom', 'scoring', 'beta', 'audio']`；把 `langs.view('am')` 的断言期望改为 `{ L: langs.meta('am').strings, tc: 'am', hasRom: true, audio: true }`。

`scripts/sim-miniprogram.js` 的多语言块里，在 `langs.register('om', {...})` 的 `meta` 里加 `audio: false`，并在 `langs.set('om');`（旧云函数测试那行）之后加：

```js
  // 没有语音的语言：朗读不发任何请求，只提示即将上线
  const callsBefore = (global.__calls || []).length;
  let toastTitle = '';
  const realToast = wx.showToast;
  wx.showToast = (o) => { toastTitle = o.title; };
  await audio.speak('Akkam');
  wx.showToast = realToast;
  assert.equal((global.__calls || []).length, callsBefore, '不发 tts 请求');
  assert.match(toastTitle, /发音即将上线/);
  assert.equal(langs.view().audio, false);
```

- [ ] **Step 2: 运行，确认失败**

Run: `node scripts/check-langs.js`
Expected: FAIL `am: meta.audio`

- [ ] **Step 3: 实现**

`langs/am/index.js` 的 `meta` 在 `beta: false,` 后加 `audio: true,`。

`langs/index.js` 的 `view`：

```js
/** 页面模板用的语言视图：界面文案 L、原文字体类 tc（埃塞文字 'am'，拉丁文字 'latin'）、是否有转写 hasRom、是否有语音 audio */
function view(code) {
  const m = meta(code);
  return { L: m.strings, tc: m.script === 'ethiopic' ? 'am' : 'latin', hasRom: m.hasRom, audio: m.audio };
}
```

`utils/audio.js`：顶部 `require` 区加 `const langs = require('../langs/index.js');`。`speak` 在 `if (!text) return Promise.resolve();` 之后加：

```js
  const m = langs.meta();
  // 这门语言还没有语音（奥罗莫语在语音上线前）：不发请求，主动点的才提示
  if (!m.audio) {
    if (!(opts && opts.silent)) toast(`${m.name}发音即将上线`);
    return Promise.resolve();
  }
```

`prefetch` 的 `try {` 之后第一行加 `if (!langs.meta().audio) return;`。

`pages/quiz/quiz.js`：`const withAudio = api.configured() && account.isRegistered();` → `const withAudio = api.configured() && account.isRegistered() && langs.meta().audio;`。

模板里的朗读入口加 `wx:if="{{audio}}"`：
- `quiz.wxml`：题面小喇叭（调用 `playCurrent` 的元素）
- `review.wxml`：「先听」模式按钮（`data-m="listen"`）、两处喇叭（`catchtap="play"`）、跟读话筒（`catchtap="goSpeak"`）
- `lesson.wxml`：词条行的喇叭与话筒（`catchtap="play"`、`catchtap="speakPage"`）、对话行的小喇叭
- `search.wxml`：结果行的喇叭（`catchtap="play"`）

`review.js` 的 `setMode`：如果 `mode === 'listen' && !this.data.audio` 直接 `return`（防御：模板已隐藏）。复习页 `onShow` 开头 `this.setData(langs.view())` 已有；另外在其后加 `if (!this.data.audio && this.data.mode === 'listen') this.setData({ mode: 'text' });`（从有语音的语言切到没有语音的语言时退出「先听」模式）。

- [ ] **Step 4: 运行全部测试**

Run: `npm test`
Expected: `# fail 0`，各项 OK

- [ ] **Step 5: 提交**

```bash
git add miniprogram scripts
git commit -m "feat: per-language audio switch hides listening entry points when a language has no voice"
```

---

### Task 4: 奥罗莫语语言包（词库与元数据）

**Files:**
- Create: `miniprogram/langs/om/vocab.js`
- Create: `miniprogram/langs/om/index.js`
- Modify: `miniprogram/langs/index.js`（注册 `om`）
- Test: `scripts/check-langs.js`（自动覆盖新语言包，无需改动）

**Interfaces:**
- Consumes：`createPlan`（Task 2，本任务先用临时计划，见 Step 3）；`meta.audio`（Task 3）
- Produces：`langs.pack('om')`，形状与 `am` 相同；`badgeUnits: { phone: 'om-u15', site: 'om-u14', formal: 'om-u16' }`

**内容要求（`langs/om/vocab.js`）**

结构与 `langs/am/vocab.js` 完全相同（`units` 数组 + 同样的 `byId`/`itemById` 索引与 5 个导出函数），逐单元对照阿姆哈拉语：

- 16 个单元，`om-u01`…`om-u16` 与 `u01`…`u16` 一一对应：`week` 相同；`title` 与阿姆哈拉语单元相同（中文场景名）；`scene`、`why`、`tips` 改写成奥罗莫语的情况（例如在奥罗米亚州、亚的斯亚贝巴周边的使用场景；奥罗莫语的礼貌用 `isin`、熟人用 `ati` 等），`tips` 2–3 条。
- 每单元 `items` 条数与对应阿姆哈拉语单元相差不超过 3，覆盖同样的意思（按阿姆哈拉语词条的 `zh` 翻译）；只在阿姆哈拉语里成立的条目（如 Fidel 相关、阿姆哈拉语特有的性别变位说明）换成奥罗莫语里对应的常用说法。
- 词条字段：`id`（`om-uNN-NN`，两位序号）、`text`（Qubee 原文）、`zh`（中文）、可选 `note`（用法、礼貌/熟人形式、对男/对女差异）。**不写 `rom`。**
- `dialog`：行数与对应阿姆哈拉语单元相差不超过 1，`{ who: 'A' | 'B', text, zh }`。
- 书写规范（Qubee 标准正字法）：长元音双写（`aa ee ii oo uu`）；辅音重读双写（`dd`、`kk`…）；喉塞音用撇号 `'`（如 `ba'e`）；双字母 `ch dh ny ph sh`；挤喉音 `c q x`；句首与专有名词首字母大写，问句带 `?`。
- 数字：`tokko lama sadii afur shan jaha torba saddeet sagal kudhan`，`kudha tokko`（11），`digdama`（20），`soddoma`（30），`dhibba`（100），`kuma`（1000）。货币用 `qarshii`/`birrii`。时间单元保留「埃塞时间 = 国际时间 − 6」的说明。
- 文件头注释说明：字段含义；「内容为初稿，需母语者校对，校对前入口标试用版」。

**`langs/om/index.js`**：

```js
// 奥罗莫语（Afaan Oromoo）语言包：词库、8 周计划、Qubee 字母规则与界面文案。
// 内容为初稿，母语者校对完成前 meta.beta = true（入口显示「试用版」）；语音在 PR 3 上线前 meta.audio = false。
const vocab = require('./vocab.js');
const plan = require('./plan.js');
const alphabet = require('./alphabet.js');

const meta = {
  code: 'om',
  name: '奥罗莫语',
  native: 'Afaan Oromoo',
  script: 'latin',
  hasRom: false,
  voices: ['female'],
  scoring: false,
  beta: true,
  audio: false,
  strings: {
    langName: '奥罗莫语',
    askSay: '奥罗莫语怎么说？',
    thinkSay: '在心里说出奥罗莫语',
    modeShort: '看奥',
    praise: "Baay'ee gaarii!",
    praiseHigh: "Baay'ee gaarii!",
    praiseMid: 'Gaarii dha',
    praiseLow: 'Rakkoo hin qabu',
    searchPlaceholder: '输入中文 / 奥罗莫语，例如：多少钱、meeqa、bishaan',
    searchHint: '长按奥罗莫语原文可复制，直接给对方看。',
    copyHint: '长按原文可复制',
    loginHello: 'Akkam!',
    loginSub: '在埃塞工作的你，8 周学会用奥罗莫语沟通工作',
    about: '面向在埃塞俄比亚的中文使用者的奥罗莫语速成（试用版，内容待母语者校对）。'
  }
};

// 首页问候语。顺序约定（首页按下标取）：0 通用问候，1 早上好，2 下午好；全部也轮换作「每日一句」
const greetings = [
  { text: 'Akkam?', zh: '你好（万能问候）' },
  { text: 'Akkam bulte?', zh: '早上好（昨晚过得好吗）' },
  { text: 'Akkam oolte?', zh: '下午好（今天过得好吗）' },
  { text: "Baay'ee gaarii!", zh: '非常好！' },
  { text: 'Afaan Oromoo nan barachaa jira', zh: '我在学奥罗莫语' }
];

// 徽章绑定的单元：电话达人 / 现场指挥 / 敬语大师
const badgeUnits = { phone: 'om-u15', site: 'om-u14', formal: 'om-u16' };

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

- [ ] **Step 1: 写奥罗莫语词库**

按上面的内容要求写 `miniprogram/langs/om/vocab.js`，16 个单元全部写完。

- [ ] **Step 2: 临时的计划与字母数据**

Task 5 才写正式的 8 周计划与 Qubee 规则。为了让本任务单独可测，先创建最小可用版本，Task 5 会整文件替换：

`miniprogram/langs/om/plan.js`：

```js
// 临时版本：周结构与阿姆哈拉语相同，单元 id 换成 om- 前缀。Task 5 替换为正式的奥罗莫语计划。
const amWeeks = require('../am/plan.js').weeks;
const { createPlan } = require('../plan-engine.js');

const om = (id) => (id ? `om-${id}` : id);
const weeks = amWeeks.map((w) => ({ ...w, units: w.units.map(om), extra: om(w.extra) }));

module.exports = createPlan({
  weeks,
  week8Missions: ['给司机安排行程', '电话约时间', '现场布置任务', '敬语接待客户', '报告并解决一个问题'],
  principles: [],
  alphabet: { name: 'Qubee 字母', groupDesc: '读本批拼写规则与例词', finalDesc: '全部拼写规则自测' }
});
```

`miniprogram/langs/om/alphabet.js`：

```js
// 临时版本：Task 5 替换为完整的 Qubee 字母与发音规则。
module.exports = { name: 'Qubee 字母', page: '/pages/qubee/qubee', groups: [] };
```

- [ ] **Step 3: 注册并校验**

`miniprogram/langs/index.js`：`const packs = { am: require('./am/index.js') };` → `const packs = { am: require('./am/index.js'), om: require('./om/index.js') };`，`const order = ['am'];` → `const order = ['am', 'om'];`。

`scripts/sim-miniprogram.js` 的多语言块里原来用 `langs.register('om', {...})` 注册的测试包要删掉（真实的 om 包已注册）：把那段 `langs.register('om', …)` 整段删除，测试里的 `'om-u01'`、`'om-u01-01'` 继续可用（真实词库有这些 id）；如果测试断言依赖测试包里的具体词（如 `Akkam`），改成从 `langs.pack('om').getUnit('om-u01').items[0]` 取。

Run: `node scripts/check-langs.js`
Expected: `OK: 语言包校验通过（am, om）`。失败时按报错修改词库（常见：缺 `zh`、混入埃塞文字、id 前缀、单元数）。

- [ ] **Step 4: 运行全部测试**

Run: `npm test`
Expected: `# fail 0`，各项 OK

- [ ] **Step 5: 提交**

```bash
git add miniprogram/langs scripts/sim-miniprogram.js
git commit -m "feat: add the Afaan Oromoo language pack (16 units, beta, no audio yet)"
```

---

### Task 5: 奥罗莫语 8 周计划与 Qubee 字母页

**Files:**
- Replace: `miniprogram/langs/om/plan.js`、`miniprogram/langs/om/alphabet.js`
- Create: `miniprogram/pages/qubee/qubee.{js,wxml,wxss,json}`
- Modify: `miniprogram/app.json`（`pages` 加 `pages/qubee/qubee`，放在 `pages/fidel/fidel` 后面）
- Test: `scripts/sim-miniprogram.js`、`scripts/check-langs.js`

**Interfaces:**
- Consumes：`createPlan`（Task 2）、`progress.completeAlphabetGroup`（Task 2）、`points.award('alphabet')`（Task 2）、`langs.view()`（含 `audio`）
- Produces（`om/alphabet.js`）：

```js
{
  name: 'Qubee 字母',
  page: '/pages/qubee/qubee',
  groups: [ // 恰好 5 批，group 1..5
    { group: 1, title: string, intro: string,
      rules: [ { pattern: string, zh: string, examples: [ { text: string, zh: string } ] } ] }
  ],
  buildQuiz(group: number, n: number): Array<{ text: string, answer: string, options: string[] }>
  // group 为 0 表示全部批次；题目 = 给出例词 text，从 4 个中文里选意思；options 含 answer，无重复
}
```

**内容要求**

`om/plan.js`：用 `createPlan`，8 周结构与阿姆哈拉语相同（每周单元 = 对应阿姆哈拉语单元加 `om-` 前缀，`extra` 同理，`alphabetGroup` 与阿姆哈拉语相同的 1,2,3,3,4,4,5,5），`theme`/`goal`/`why`/`milestone` 按奥罗莫语改写；`mission` 里的示范句换成奥罗莫语（如第 1 周：向门卫、司机、一位本地同事各用 `Akkam?` + `Akkam bulte?` 问候，并回答 `Nagaa dha`）；`week8Missions` 与阿姆哈拉语相同的 5 个中文任务名；`principles` 与阿姆哈拉语相同 8 条，只把「文字渐进」改为「Qubee 用拉丁字母，难点在长短元音、双写辅音、喉塞音和 ch/dh/ny/ph/sh/c/q/x，分 5 批和当周词汇绑定学」；`alphabet: { name: 'Qubee 字母', groupDesc: '读本批拼写规则与例词，做 10 题小测', finalDesc: '全部拼写规则综合自测' }`。

`om/alphabet.js`：5 批规则，每批 3–5 条 `rules`，每条 2–4 个常用例词（例词优先取自奥罗莫语词库，`zh` 与词库一致），并实现 `buildQuiz`：
1. 元音与长短：`a e i o u` 与长元音 `aa ee ii oo uu`，长短区分词义（如 `hara` 湖 / `haaraa` 新的）
2. 辅音双写（重读）：单写与双写区分词义（如 `badaa` 坏的 / `baddaa` 高地）
3. 双字母：`ch dh ny ph sh`
4. 挤喉音与喉塞音：`c q x`、撇号 `'`（hudhaa）
5. 其余辅音与拼读：`b d f g h j k l m n r s t w y`，整词拼读与句子

`buildQuiz` 实现要求：题池为所选批次（0 为全部）所有例词；每题 4 个选项，干扰项从全部批次例词的 `zh` 中随机取、与答案不同且互不重复；题数 `min(n, 题池大小)`，题池不足 4 个 `zh` 时从全部批次补足。

**`pages/qubee` 页**（交互与 `pages/fidel` 对齐：批次标签 → 规则列表 → 10 题小测 → 结果）：

`qubee.js`：

```js
const langs = require('../../langs/index.js');
const progress = require('../../utils/progress.js');
const points = require('../../utils/points.js');

const PASS_PCT = 70;
const QUIZ_SIZE = 10;

Page({
  data: { group: 1, groups: [], rules: [], mode: 'rules', q: null, qIdx: 0, qTotal: QUIZ_SIZE, qScore: 0, qPicked: null, pct: 0, earned: 0, done: false },
  onLoad(q) {
    const qb = langs.pack('om').alphabet;
    this.qb = qb;
    this.setData({ ...langs.view('om'), groups: qb.groups.map((g) => ({ group: g.group, title: g.title })) });
    this.setGroup(Number(q && q.group) || 1);
    this.enterAt = Date.now();
  },
  onUnload() {
    const min = Math.round((Date.now() - this.enterAt) / 60000);
    if (min > 0) progress.addMinutes(Math.min(min, 20));
  },
  setGroup(g) {
    const list = g === 0 ? this.qb.groups : this.qb.groups.filter((x) => x.group === g);
    const p = progress.load();
    this.setData({ group: g, sections: list, mode: 'rules', done: !!p.fidelGroupsDone[g] });
  },
  pickGroup(e) { this.setGroup(Number(e.currentTarget.dataset.g)); },
  startQuiz() {
    this.questions = this.qb.buildQuiz(this.data.group, QUIZ_SIZE);
    this.setData({ mode: 'quiz', qIdx: 0, qScore: 0, qTotal: this.questions.length });
    this.showQ();
  },
  showQ() {
    const { qIdx, qTotal } = this.data;
    if (qIdx >= qTotal) { this.finish(); return; }
    this.setData({ q: this.questions[qIdx], qPicked: null });
  },
  pickQ(e) {
    if (this.data.qPicked) return;
    const pick = e.currentTarget.dataset.opt;
    const ok = pick === this.data.q.answer;
    this.setData({ qPicked: pick, qScore: this.data.qScore + (ok ? 1 : 0) });
    setTimeout(() => { this.setData({ qIdx: this.data.qIdx + 1 }); this.showQ(); }, ok ? 500 : 1200);
  },
  finish() {
    const pct = Math.round((this.data.qScore / Math.max(1, this.data.qTotal)) * 100);
    let earned = 0;
    if (pct >= PASS_PCT && this.data.group > 0) {
      // 只在本次首次通过该批时加星
      const firstPass = !progress.load().fidelGroupsDone[this.data.group];
      progress.completeAlphabetGroup(this.data.group);
      if (firstPass) { earned = points.award('alphabet'); points.celebrate(); }
    }
    this.setData({ mode: 'result', pct, earned, done: pct >= PASS_PCT });
  },
  backRules() { this.setData({ mode: 'rules' }); }
});
```

注意：`progress.load()` / `completeAlphabetGroup` 写的是当前语言；Qubee 页只能从奥罗莫语入口进入，页面 `onLoad` 里若 `langs.current() !== 'om'` 则 `wx.navigateBack()` 并 `return`（防止从旧链接进入写错语言）。

`qubee.wxml`：顶部标题 `Qubee 字母` 与一句说明「奥罗莫语用拉丁字母书写，按读音拼写：长音写两个元音，重读写两个辅音」；批次标签（`groups` + 「全部」，`data-g`，当前批高亮，`done` 显示「已通过」）；`mode === 'rules'`：遍历 `sections` → `rules`，每条显示 `pattern`（`class="{{tc}}"`）、`zh`、例词列表（例词 `class="{{tc}}"` + 中文）；底部按钮「开始小测（10 题）」`bindtap="startQuiz"`；`mode === 'quiz'`：进度 `第 {{qIdx+1}} / {{qTotal}} 题`、题面 `q.text`（`class="{{tc}} big"`）、提示「这个词是什么意思？」、4 个选项 `data-opt="{{item}}" bindtap="pickQ"`，已选后正确项 `right`、错误项 `wrong`、其余 `dim`（与 `fidel.wxml` 的样式类一致）；`mode === 'result'`：`{{pct >= 70 ? L.praise : L.praiseLow}}`、`答对 {{qScore}} / {{qTotal}}`、`earned > 0` 时显示 `+{{earned}} 星`、按钮「再看规则」`bindtap="backRules"`。

`qubee.wxss`：复用 `fidel.wxss` 的批次标签、选项、结果样式（复制需要的规则，类名保持一致），规则卡片用全局 `.card`。

`qubee.json`：`{ "navigationBarTitleText": "Qubee 字母" }`

- [ ] **Step 1: 写失败的测试**

`scripts/check-langs.js` 在语言包循环末尾加（只对拉丁文字语言）：

```js
  if (meta.script === 'latin') {
    assert.equal(p.alphabet.groups.length, 5, at('Qubee 规则恰好 5 批'));
    p.alphabet.groups.forEach((g, i) => {
      assert.equal(g.group, i + 1, at(`第 ${i + 1} 批 group 编号`));
      assert.ok(g.rules.length >= 3, at(`第 ${g.group} 批至少 3 条规则`));
      g.rules.forEach((r) => {
        assert.ok(r.pattern && r.zh && r.examples.length >= 2, at(`第 ${g.group} 批规则 ${r.pattern} 不完整`));
        r.examples.forEach((ex) => checkText(ex, `Qubee 例词 ${ex.text}`));
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
```

`scripts/sim-miniprogram.js`：`PAGE_NAMES` 在 `'fidel/fidel'` 后加 `'qubee/qubee'`，`assert.equal(pages.length, 13, …)` 改为 14。

- [ ] **Step 2: 运行，确认失败**

Run: `node scripts/check-langs.js`
Expected: FAIL `om: Qubee 规则恰好 5 批`

- [ ] **Step 3: 实现**：按上面的内容要求与代码写 `om/plan.js`、`om/alphabet.js`、`pages/qubee/*`，`app.json` 注册页面。

- [ ] **Step 4: 运行全部测试**

Run: `npm test`
Expected: `# fail 0`，`OK: 语言包校验通过（am, om）`，模拟 OK

- [ ] **Step 5: 提交**

```bash
git add miniprogram scripts
git commit -m "feat: Oromo 8-week plan and Qubee spelling-rules page"
```

---

### Task 6: 语言切换入口与奥罗莫语全流程

**Files:**
- Create: `miniprogram/utils/lang-switch.js`
- Modify: `miniprogram/pages/index/index.{js,wxml,wxss}`、`miniprogram/pages/profile/profile.{js,wxml}`
- Test: `scripts/sim-miniprogram.js`

**Interfaces:**
- Consumes：`langs.list()`、`langs.set()`、`langs.meta()`、`audio.stop()`
- Produces：`langSwitch.label(meta?)`：`'<native> <name>'`，`beta` 时追加 `'（试用版）'`；`langSwitch.choose(onChanged)`：弹出语言列表，选中不同语言后 `audio.stop()` → `langs.set(code)` → `onChanged(code)`

- [ ] **Step 1: 写失败的测试**

在 `scripts/sim-miniprogram.js` 的多语言块末尾（切回阿姆哈拉语的断言之后）加奥罗莫语全流程：

```js
  // 语言切换入口：首页标签 → 选奥罗莫语 → 各页按奥罗莫语显示
  const langSwitch = require(path.join(root, 'utils/lang-switch.js'));
  assert.equal(langSwitch.label(langs.meta('om')), 'Afaan Oromoo 奥罗莫语（试用版）');
  const realSheet = wx.showActionSheet;
  wx.showActionSheet = ({ itemList, success }) => { global.__sheet = itemList; success({ tapIndex: itemList.findIndex((t) => /Oromoo/.test(t)) }); };
  const home = pageOf('index/index');
  home.setData = function (d) { this.data = { ...this.data, ...d }; };
  home.data = {};
  home.onShow();
  assert.match(home.data.langLabel, /阿姆哈拉语/);
  home.switchLang();
  assert.equal(langs.current(), 'om', '首页切到奥罗莫语');
  assert.equal(global.__sheet.length, 2);
  assert.match(home.data.langLabel, /奥罗莫语（试用版）/, '切换后首页立即刷新');
  assert.equal(home.data.tc, 'latin');
  assert.ok(home.data.tasks.some((t) => t.type === 'alphabet'), '今日任务来自奥罗莫语计划');
  assert.equal(home.data.alphabetName, 'Qubee 字母');

  // 课程 → 学单元 → 复习 → 小测（无听力题、选项没有转写）→ 搜索 → Qubee
  const omPack = langs.pack('om');
  const lessonPage = pageOf('lesson/lesson');
  lessonPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  lessonPage.data = {};
  lessonPage.onLoad({ id: 'om-u03' });
  assert.equal(lessonPage.data.unit.id, 'om-u03');
  assert.equal(lessonPage.data.hasRom, false);
  assert.equal(lessonPage.data.audio, false, '奥罗莫语课文页不显示喇叭');
  progress.learnUnit('om-u03');
  const omDue = progress.dueCards();
  assert.ok(omDue.length > 0 && omDue.every((c) => c.id.startsWith('om-')), '复习队列只有奥罗莫语卡片');
  const omQuiz = quiz.buildQuiz('om-u03', 10, progress.load(), false);
  assert.equal(omQuiz.filter((q) => q.listen).length, 0);
  omQuiz.forEach((q) => { assert.equal(q.promptRom, ''); q.options.forEach((o) => assert.ok(!/  /.test(o.text), '选项不拼接转写')); });
  const omSearch = pageOf('search/search');
  omSearch.setData = function (d) { this.data = { ...this.data, ...d }; };
  omSearch.data = { q: '', results: [], recent: [] };
  omSearch.onLoad();
  omSearch.search('你好');
  assert.ok(omSearch.data.results.length > 0 && omSearch.data.results.every((r) => r.id.startsWith('om-')), '搜索只搜当前语言');
  const qubee = pageOf('qubee/qubee');
  qubee.setData = function (d) { this.data = { ...this.data, ...d }; };
  qubee.data = { ...qubee.data };
  qubee.onLoad({ group: '1' });
  qubee.startQuiz();
  qubee.questions.forEach((qq) => { qubee.data.q = qq; qubee.data.qScore += 1; });
  qubee.data.qIdx = qubee.data.qTotal;
  qubee.finish();
  assert.equal(qubee.data.done, true);
  assert.ok(progress.load().fidelGroupsDone[1], 'Qubee 第 1 批记在奥罗莫语进度里');

  // 「我的」页也能切回阿姆哈拉语，阿姆哈拉语进度完好
  wx.showActionSheet = ({ itemList, success }) => success({ tapIndex: itemList.findIndex((t) => /阿姆哈拉语/.test(t)) });
  const me = pageOf('profile/profile');
  me.setData = function (d) { this.data = { ...this.data, ...d }; };
  me.data = { ...me.data };
  me.switchLang();
  assert.equal(langs.current(), 'am');
  assert.match(me.data.langLabel, /阿姆哈拉语/);
  assert.ok(!progress.load().unitsLearned['om-u03'], '阿姆哈拉语进度没有混入奥罗莫语');
  wx.showActionSheet = realSheet;
```

并把 Task 4 模板静态检查扩展到全部相关模板：`['quiz/quiz', 'review/review', 'search/search', 'login/login', 'fidel/fidel']` → `['quiz/quiz', 'review/review', 'search/search', 'login/login', 'fidel/fidel', 'index/index', 'lesson/lesson', 'speak/speak', 'profile/profile', 'lessons/lessons', 'plan/plan', 'qubee/qubee']`，`HARD` 加上 `|Fidel 字母表<|Fidel 字母 第`（字母页名称必须来自语言包；`fidel/fidel.wxml` 自身的标题除外——对它单独跳过 `Fidel 字母表` 这一项）。

- [ ] **Step 2: 运行，确认失败**

Run: `node scripts/sim-miniprogram.js`
Expected: FAIL `Cannot find module …/utils/lang-switch.js`

- [ ] **Step 3: 实现**

创建 `miniprogram/utils/lang-switch.js`：

```js
// 学习语言切换：首页标签和「我的」页共用。
const langs = require('../langs/index.js');
const audio = require('./audio.js');

/** 显示用的语言名：本族名 + 中文名，试用版加标注 */
function label(meta) {
  const m = meta || langs.meta();
  return `${m.native} ${m.name}${m.beta ? '（试用版）' : ''}`;
}

/** 弹出语言列表；选了不同的语言就切换，并回调 onChanged(code) 让页面刷新 */
function choose(onChanged) {
  const list = langs.list();
  wx.showActionSheet({
    itemList: list.map((m) => label(m)),
    success: (res) => {
      const m = list[res.tapIndex];
      if (!m || m.code === langs.current()) return;
      audio.stop();
      langs.set(m.code);
      if (typeof onChanged === 'function') onChanged(m.code);
    }
  });
}

module.exports = { label, choose };
```

`pages/index/index.js`：顶部加 `const langSwitch = require('../../utils/lang-switch.js');`；`onShow` 的 `this.setData(langs.view())` 之后加 `this.setData({ langLabel: langSwitch.label() });`；加方法 `switchLang() { langSwitch.choose(() => this.onShow()); },`。

`pages/index/index.wxml`：在 `<view class="hero">` 内第一行加 `<view class="lang-chip" bindtap="switchLang">{{langLabel}} ▾</view>`。`index.wxss` 加：

```css
.lang-chip { display: inline-block; font-size: 24rpx; padding: 6rpx 18rpx; border-radius: 999rpx; background: rgba(255, 255, 255, 0.7); color: var(--accent); font-weight: 700; margin-bottom: 12rpx; position: relative; z-index: 1; }
```

`pages/profile/profile.js`：顶部加 `const langSwitch = require('../../utils/lang-switch.js');`；`onShow` 的 `setData` 里加 `langLabel: langSwitch.label()`；加方法 `switchLang() { langSwitch.choose(() => this.onShow()); },`。

`pages/profile/profile.wxml`：「学习设置」卡片 `<view class="card-title">学习设置</view>` 之后第一行加：

```xml
    <view class="row between list-item" bindtap="switchLang">
      <text class="set-label">学习语言</text>
      <text class="set-val">{{langLabel}} ▾</text>
    </view>
```

- [ ] **Step 4: 运行全部测试**

Run: `npm test`
Expected: `# fail 0`，各项 OK

- [ ] **Step 5: 提交**

```bash
git add miniprogram scripts
git commit -m "feat: switch the study language from the home page and profile"
```

---

### Task 7: 校对表、文档与清理

**Files:**
- Create: `scripts/gen-oromo-review.js`、`docs/oromo-review.md`（生成）
- Modify: `package.json`（`test` 加 `node scripts/gen-oromo-review.js --check`）
- Modify: `miniprogram/utils/progress.js`（删除 `summary()`）、`scripts/sim-miniprogram.js`（不再调用 `summary()`）
- Modify: `miniprogram/pages/quiz/quiz.js`、`miniprogram/pages/review/review.js`（注释）
- Modify: `README.md`、`提审检查清单.md`、`docs/superpowers/specs/2026-09-30-afan-oromo-design.md`、`miniprogram/config.js`

- [ ] **Step 1: 校对表生成脚本**

创建 `scripts/gen-oromo-review.js`：

```js
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
```

Run: `node scripts/gen-oromo-review.js --check` → Expected FAIL（文件不存在）；再 `node scripts/gen-oromo-review.js` 生成，`--check` → `OK`。

`package.json` 的 `test`：在 `node scripts/check-langs.js &&` 之后加 `node scripts/gen-oromo-review.js --check &&`。

- [ ] **Step 2: 清理**

- `progress.js`：删除 `summary()` 整个函数（含上方「给 AI 的摘要」注释）和导出项；`scripts/sim-miniprogram.js` 里 `const s = progress.summary(); assert.equal(s.streak, 1);` 改为 `assert.equal(progress.streak(), 1);`。先 `grep -rn "summary(" miniprogram scripts` 确认没有别的调用方。
- `pages/quiz/quiz.js`、`pages/review/review.js` 注释里残留的「阿姆哈拉语」改为「原文」。

- [ ] **Step 3: 文档**

- `README.md`：
  - 开头简介加一句：第二版起支持奥罗莫语（试用版），在首页顶部或「我的 → 学习语言」切换，两种语言进度分开。
  - 目录结构在 `langs/am/` 下面加：`langs/om/           奥罗莫语（试用版）：vocab.js、plan.js、alphabet.js（Qubee 拼写规则）、index.js`，以及 `langs/plan-engine.js  8 周计划任务生成（两种语言共用）`、`pages/qubee/  Qubee 字母规则与小测`、`scripts/gen-oromo-review.js  生成母语者校对表 docs/oromo-review.md`。
  - 新增小节「奥罗莫语（试用版）」：内容为初稿，需母语者按 `docs/oromo-review.md` 校对；校对前入口显示「试用版」；语音将在后续版本上线，目前奥罗莫语不显示朗读、听力和跟读入口。
- `提审检查清单.md`：
  - 第二节「云函数这次改动很大（删掉了全部 AI 接口，修了三个安全漏洞）」的理由改为「云函数新增了按语言存进度（`progress.*` 的 `lang` 参数），只上传小程序不重新部署云函数，奥罗莫语进度无法同步」。
  - 新增一项：「决定奥罗莫语试用版是否随本次提审：若母语者校对未完成，建议仍随版本提交（入口已标试用版），或先把 `langs/index.js` 里的 `om` 从 `order` 中移除再提审」。
  - buildTag 示例同步。
- 规格 `docs/superpowers/specs/2026-09-30-afan-oromo-design.md`：按本计划开头「对规格的两处修订」改写 §2.4 和 §2.3 对应段落，并在 §3.3 加一句「PR 2 起语言包有 `audio` 开关；奥罗莫语语音上线前为 false」。
- `miniprogram/config.js`：`buildTag: '2026-09-30 第二版开发（奥罗莫语试用版）'`；`提审检查清单.md` 里的 buildTag 示例同步。

- [ ] **Step 4: 全量验证**

Run: `npm test`
Expected: `# fail 0`、`OK: 语言包校验通过（am, om）`、`OK: 奥罗莫语校对表与词库一致`、合规检查 OK、模拟 OK

- [ ] **Step 5: 提交**

```bash
git add scripts/gen-oromo-review.js docs/oromo-review.md package.json miniprogram README.md 提审检查清单.md docs/superpowers/specs/2026-09-30-afan-oromo-design.md scripts/sim-miniprogram.js
git commit -m "docs: Oromo review sheet, README and checklist for the Oromo beta"
```

---

## 后续计划

- PR 3（语音）：`scripts/gen-oromo-audio.py`、音频包与 manifest、云函数 `tts.*` 的 `om` 分支（免登录、不计额度）、前端 `lang` 透传与缓存 key、`meta.audio` 改为 true、校对表加音频文件名列、设置页只有一种声音时隐藏男声/女声。
- PR 4（跟读与合规）：奥罗莫语跟读对比模式、「合成音」标注、关于页 MMS 署名、合规检查、提审清单更新。
