# 奥罗莫语语音、跟读对比与合规（第二版 PR 3 + PR 4）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 奥罗莫语有标准音（Meta MMS 预生成，免登录、不计额度），可以跟读并与标准音对比（不打分）；界面标注「合成音」并署名模型来源；顺带处理 PR 2 留下的几项。

**Architecture:** 开发机用 `scripts/gen-oromo-audio.py` 把奥罗莫语全部待朗读文本生成为 mp3，随云函数代码包发布（`cloudfunctions/api/audio-om/` + `manifest.json`）。云函数 `tts.*` 带 `lang: 'om'` 时从代码包取文件，首次用到上传云存储并写 `tts_cache`，之后与阿姆哈拉语走同一条返回路径；新增 `tts.caps` 让前端确认云函数支持奥罗莫语，避免旧云函数用阿姆哈拉语声音合成奥罗莫语并计费。前端 `audio.js` 按语言选缓存键与登录规则；跟读页在不支持评分的语言下改为「录音 → 与标准音对比」，每词每天首次完成给 1 颗星。

**Tech Stack:** 微信小程序、微信云函数（Node.js 20）、Python 3.11（torch CPU、transformers、lameenc、numpy，仅开发机）、`node:test`、`scripts/sim-miniprogram.js`。

**Spec:** `docs/superpowers/specs/2026-09-30-afan-oromo-design.md` 第 3 节（3.1–3.6）与第 7 节的 PR 3、PR 4；以及 `docs/superpowers/plans/2026-09-30-oromo-content.md` 文末「PR 2 执行后带入后续 PR 的事项」。

## Global Constraints

- 阿姆哈拉语：语音、缓存键 `sha1(voice|rate|text)`、额度、登录门槛全部不变；本地音频缓存键 `voice|rate|text` 不变。
- 奥罗莫语语音：缓存键 `sha1('om|' + rate + '|' + text)`；云存储路径 `tts/om/<key>.mp3`；**不调用 Azure、不计入每日次数与每月字符额度、不写 `ai_logs`、不要求登录、停用账号也可用**。
- 语速 `normal` = MMS `speaking_rate` 1.0，`slow` = 0.75；随机种子固定 555；mp3 16kHz 单声道 32kbps（总大小超过 15MB 时改 24kbps）。
- 模型：`facebook/mms-tts-orm`，许可证 CC BY-NC 4.0，必须在「关于」页与隐私页署名。
- 奥罗莫语不做发音评分：任何路径都不得把奥罗莫语文本或录音送去 `stt.score`。
- 生成依赖只在开发机：不进小程序、不进云函数 `package.json`。
- 提交信息结尾带：
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012XhDr3sdrtgk4B4Lg4Z2yJ
  ```
- 分支 `claude/amharic-learning-wechat-app-phqk1c`；`npm test` 全部通过才能提交；不用 `git stash`。

---

### Task 1: 生成奥罗莫语音频

**Files:**
- Create: `scripts/om-texts.js`（收集全部待朗读文本，供生成脚本与校验共用）
- Create: `scripts/gen-oromo-audio.py`、`scripts/requirements-tts.txt`
- Create: `scripts/check-oromo-audio.js`
- Create: `cloudfunctions/api/audio-om/*.mp3`、`cloudfunctions/api/audio-om/manifest.json`（生成物，提交）
- Modify: `.gitattributes`（`*.mp3 binary`）、`package.json`（`test` 加 `node scripts/check-oromo-audio.js`）

**Interfaces:**
- Produces：`require('scripts/om-texts.js').collect(): string[]`——奥罗莫语全部待朗读文本（词条 `text`、对话行 `text`、问候语 `text`、Qubee 规则例词 `text`），各自 `trim()` 后去重、按 `localeCompare` 排序
- Produces：`manifest.json` = `{ "<rate>|<text>": "<sha1('om|'+rate+'|'+text)>.mp3" }`，`rate ∈ { normal, slow }`，键按字典序排列

- [ ] **Step 1: 写失败的校验**

`scripts/om-texts.js`：

```js
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
```

`scripts/check-oromo-audio.js`：

```js
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
console.log(`OK: 奥罗莫语音频 ${texts.length} 条 × 2 种语速，共 ${(total / 1048576).toFixed(1)}MB`);
```

Run: `node scripts/check-oromo-audio.js` → Expected: FAIL「缺少 audio-om/manifest.json」

- [ ] **Step 2: 生成脚本**

`scripts/requirements-tts.txt`：

```
--extra-index-url https://download.pytorch.org/whl/cpu
torch
transformers
lameenc
numpy
```

`scripts/gen-oromo-audio.py`：

```python
#!/usr/bin/env python3
"""生成奥罗莫语朗读音频：Meta MMS 开源模型 facebook/mms-tts-orm（CC BY-NC 4.0）。

用法（开发机）：
  python3 -m venv .venv-tts && . .venv-tts/bin/activate
  pip install -r scripts/requirements-tts.txt
  python scripts/gen-oromo-audio.py           # 只生成新增/改动的句子
  python scripts/gen-oromo-audio.py --prune   # 同时删除已不在词库里的旧文件
同一句话每次生成的结果相同（固定随机种子）。想换成真人录音：用同名 mp3 覆盖即可。
"""
import hashlib
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'cloudfunctions', 'api', 'audio-om')
MODEL = 'facebook/mms-tts-orm'
RATES = {'normal': 1.0, 'slow': 0.75}
SEED = 555
BITRATE = 32


def key(rate, text):
    return hashlib.sha1(f'om|{rate}|{text}'.encode('utf-8')).hexdigest()


def collect_texts():
    out = subprocess.check_output(['node', os.path.join(ROOT, 'scripts', 'om-texts.js')], cwd=ROOT)
    return json.loads(out.decode('utf-8'))


def main():
    prune = '--prune' in sys.argv
    import numpy as np
    import torch
    import lameenc
    from transformers import AutoTokenizer, VitsModel

    os.makedirs(OUT, exist_ok=True)
    model = VitsModel.from_pretrained(MODEL)
    tok = AutoTokenizer.from_pretrained(MODEL)
    sr = model.config.sampling_rate
    manifest = {}
    made = 0
    for text in collect_texts():
        for rate, speed in RATES.items():
            name = key(rate, text) + '.mp3'
            manifest[f'{rate}|{text}'] = name
            path = os.path.join(OUT, name)
            if os.path.exists(path):
                continue
            model.speaking_rate = speed
            torch.manual_seed(SEED)
            with torch.no_grad():
                wav = model(**tok(text, return_tensors='pt')).waveform[0].numpy()
            pcm = (np.clip(wav, -1.0, 1.0) * 32767).astype(np.int16)
            enc = lameenc.Encoder()
            enc.set_bit_rate(BITRATE)
            enc.set_in_sample_rate(sr)
            enc.set_channels(1)
            enc.set_quality(2)
            with open(path, 'wb') as f:
                f.write(enc.encode(pcm.tobytes()) + enc.flush())
            made += 1
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(manifest.items())), f, ensure_ascii=False, indent=0)
        f.write('\n')
    keep = set(manifest.values())
    orphans = [n for n in os.listdir(OUT) if n.endswith('.mp3') and n not in keep]
    if prune:
        for n in orphans:
            os.remove(os.path.join(OUT, n))
    total = sum(os.path.getsize(os.path.join(OUT, n)) for n in os.listdir(OUT) if n.endswith('.mp3'))
    print(f'新生成 {made} 个，共 {len(keep)} 个音频，{total / 1048576:.1f}MB；'
          f'{"已删除" if prune else "多余"} {len(orphans)} 个')


if __name__ == '__main__':
    main()
```

`.gitattributes` 追加一行 `*.mp3 binary`。

- [ ] **Step 3: 生成并校验**

```bash
python3 -m venv /tmp/.venv-tts && . /tmp/.venv-tts/bin/activate
pip install -q -r scripts/requirements-tts.txt
python scripts/gen-oromo-audio.py --prune
node scripts/check-oromo-audio.js
```

Expected: `OK: 奥罗莫语音频 N 条 × 2 种语速，共 X.XMB`（约 8–10MB）。超过 15MB 则把 `BITRATE` 改 24、删掉 `audio-om/*.mp3` 重新生成。

`package.json` 的 `test`：在 `node scripts/gen-oromo-review.js --check &&` 之后加 `node scripts/check-oromo-audio.js &&`。

- [ ] **Step 4: 运行全部测试**

Run: `npm test` → Expected: `# fail 0`，各项 OK，含音频校验 OK

- [ ] **Step 5: 提交**

```bash
git add .gitattributes package.json scripts/om-texts.js scripts/gen-oromo-audio.py scripts/requirements-tts.txt scripts/check-oromo-audio.js cloudfunctions/api/audio-om
git commit -m "feat: pre-generate Oromo audio with the MMS model and verify the package"
```

---

### Task 2: 云函数奥罗莫语语音分支

**Files:**
- Create: `cloudfunctions/api/om-audio.js`
- Modify: `cloudfunctions/api/speech.js`（`ttsGet`、`ttsBatch`、`sttScore`、新增 `tts.caps`）
- Modify: `cloudfunctions/api/handler.js`（登录门槛对奥罗莫语语音放行）
- Test: `cloudfunctions/api/test/speech.om.test.js`（新建）

**Interfaces:**
- Consumes：Task 1 的 `audio-om/manifest.json` 与 mp3
- Produces：
  - `om-audio.js`：`createOmAudio(dir?) → { lookup(text, rate): string /* 文件绝对路径或 '' */, read(file): Buffer }`；`omKey(rate, text)`；`defaultOmAudio`
  - `tts.get { text, rate, lang: 'om', voice? }` → `{ url, key, fileID }`；清单里没有 → `BAD_REQUEST`「这句还没有生成语音」
  - `tts.batch { items, rate, lang: 'om', voice? }` → `{ urls, files }`（清单里没有的 id 省略）
  - `tts.caps {}` → `{ langs: ['am', 'om'] }`
  - `lang` 缺省 `am`；其他值 → `BAD_REQUEST`
  - `stt.score { lang: 'om' }` → `BAD_REQUEST`「该语言暂不支持发音评分」
  - ctx 可注入 `ctx.omAudio`（测试用）

- [ ] **Step 1: 写失败的测试**

`cloudfunctions/api/test/speech.om.test.js`：

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { handle } = require('../handler.js');
const { handleSpeech } = require('../speech.js');
const { createOmAudio, omKey } = require('../om-audio.js');
const { createFakeDb } = require('./fakeDb.js');
const { createFakeAzure } = require('./fakeAzure.js');
const { createFakeStorage } = require('./fakeStorage.js');

function tmpAudio(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-audio-'));
  const manifest = {};
  entries.forEach(([rate, text]) => {
    const name = `${omKey(rate, text)}.mp3`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(`mp3:${rate}:${text}`));
    manifest[`${rate}|${text}`] = name;
  });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return createOmAudio(dir);
}

function ctx(extra) {
  return {
    openid: 'u1',
    db: createFakeDb({ registered: false }),
    azure: createFakeAzure({ synth: () => { throw new Error('不应调用 Azure'); } }),
    storage: createFakeStorage(),
    omAudio: tmpAudio([['normal', 'Akkam?'], ['slow', 'Akkam?'], ['normal', 'Galatoomi']]),
    now: () => new Date('2026-09-30T10:00:00Z'),
    ...extra
  };
}

test('tts.get om：从代码包取文件、上传一次、写缓存，不调 Azure、不写日志', async () => {
  const c = ctx();
  const res = await handleSpeech('tts.get', { text: 'Akkam?', rate: 'normal', lang: 'om' }, c);
  assert.equal(res.ok, true, JSON.stringify(res));
  const key = omKey('normal', 'Akkam?');
  assert.equal(res.data.key, key);
  assert.equal(res.data.fileID, `cloud://fake/tts/om/${key}.mp3`);
  assert.equal(c.storage._files.get(res.data.fileID).toString(), 'mp3:normal:Akkam?');
  const cached = await c.db.getTtsCache(key);
  assert.equal(cached.lang, 'om');
  assert.equal(cached.chars, 0, '不计入月度字符');
  assert.equal(c.db._logs.length, 0, '不写 ai_logs');
  const again = await handleSpeech('tts.get', { text: 'Akkam?', rate: 'normal', lang: 'om' }, c);
  assert.equal(again.data.fileID, res.data.fileID);
  assert.equal(c.storage._files.size, 1, '第二次走缓存，不再上传');
});

test('tts.get om：清单里没有的句子给出明确错误', async () => {
  const res = await handleSpeech('tts.get', { text: 'Hin jiru', rate: 'normal', lang: 'om' }, ctx());
  assert.equal(res.ok, false);
  assert.equal(res.code, 'BAD_REQUEST');
  assert.match(res.error, /还没有生成语音/);
});

test('tts.get：lang 非法返回 BAD_REQUEST，am 缺省行为不变', async () => {
  assert.equal((await handleSpeech('tts.get', { text: 'x', rate: 'normal', voice: 'female', lang: 'fr' }, ctx())).code, 'BAD_REQUEST');
});

test('tts.batch om：批量返回，缺失的 id 省略', async () => {
  const res = await handleSpeech('tts.batch', { rate: 'normal', lang: 'om', items: [{ id: 'a', text: 'Akkam?' }, { id: 'b', text: 'Galatoomi' }, { id: 'c', text: 'Hin jiru' }] }, ctx());
  assert.equal(res.ok, true);
  assert.deepEqual(Object.keys(res.data.urls).sort(), ['a', 'b']);
});

test('tts.caps 声明支持的语言', async () => {
  const res = await handleSpeech('tts.caps', {}, ctx());
  assert.deepEqual(res, { ok: true, data: { langs: ['am', 'om'] } });
});

test('stt.score 拒绝奥罗莫语', async () => {
  const res = await handleSpeech('stt.score', { fileID: 'cloud://fake/stt/u1/a.wav', target: 'Akkam', lang: 'om' }, ctx());
  assert.equal(res.code, 'BAD_REQUEST');
  assert.match(res.error, /暂不支持发音评分/);
});

test('奥罗莫语语音不要求登录，停用账号也可用；阿姆哈拉语仍要登录', async () => {
  const c = ctx();
  const om = await handle('tts.get', { text: 'Akkam?', rate: 'slow', lang: 'om' }, c);
  assert.equal(om.ok, true, '未登录可用');
  await c.db.putUser('u1', { _id: 'u1', status: 'blocked' });
  assert.equal((await handle('tts.get', { text: 'Akkam?', rate: 'normal', lang: 'om' }, c)).ok, true, '停用账号可用');
  const am = await handle('tts.get', { text: 'ሰላም', rate: 'normal', voice: 'female' }, ctx());
  assert.equal(am.ok, false);
  assert.match(am.error, /登录/);
});

test('默认音频包：真实 manifest 可读且含首页问候语', () => {
  const { defaultOmAudio } = require('../om-audio.js');
  assert.ok(defaultOmAudio.lookup('Akkam?', 'normal'), 'audio-om 里有 Akkam?');
});
```

Run: `node --test cloudfunctions/api/test/speech.om.test.js` → Expected: FAIL `Cannot find module '../om-audio.js'`

- [ ] **Step 2: 实现**

`cloudfunctions/api/om-audio.js`：

```js
// 奥罗莫语预生成音频（Meta MMS，CC BY-NC 4.0）：随云函数代码包发布在 audio-om/，manifest.json 记录「语速|文本 → 文件名」。
const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');

const DIR = path.join(__dirname, 'audio-om');

/** 缓存键 / 文件名：sha1(`om|${rate}|${text}`) */
function omKey(rate, text) {
  return crypto.createHash('sha1').update(`om|${rate}|${text}`).digest('hex');
}

function createOmAudio(dir) {
  const base = dir || DIR;
  let manifest = null;
  function load() {
    if (manifest) return manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
    } catch (e) {
      manifest = {};
    }
    return manifest;
  }
  return {
    /** 文件绝对路径；清单里没有返回 '' */
    lookup(text, rate) {
      const name = load()[`${rate}|${text}`];
      return name ? path.join(base, name) : '';
    },
    read(file) { return fs.readFileSync(file); }
  };
}

const defaultOmAudio = createOmAudio();

module.exports = { createOmAudio, omKey, defaultOmAudio };
```

`cloudfunctions/api/speech.js`：
- 顶部 `require` 区加 `const { omKey, defaultOmAudio } = require('./om-audio.js');`，常量区加 `const TTS_LANGS = ['am', 'om'];`，并加：

```js
/** 语音语言：缺省 am；不认识的返回 '' */
function ttsLang(v) {
  if (v == null || v === '') return 'am';
  return TTS_LANGS.includes(v) ? v : '';
}

/**
 * 奥罗莫语：从代码包取预生成音频，首次用到上传云存储并写缓存。
 * 不调 Azure、不计额度、不写日志（没有成本，也不涉及用户数据）。
 * @returns {Promise<{url, key, fileID} | {missing: true}>}
 */
async function ensureOmTts(ctx, now, text, rate) {
  const { db, storage } = ctx;
  const omAudio = ctx.omAudio || defaultOmAudio;
  const key = omKey(rate, text);
  let cached = await db.getTtsCache(key);
  if (!cached) {
    const file = omAudio.lookup(text, rate);
    if (!file) return { missing: true };
    const fileID = await storage.upload(`tts/om/${key}.mp3`, omAudio.read(file));
    cached = { _id: key, fileID, text, voice: 'mms', rate, lang: 'om', chars: 0, createdAt: now.toISOString() };
    await db.putTtsCache(cached);
  }
  const urls = await storage.tempUrls([cached.fileID]);
  const url = urls[cached.fileID];
  if (!url) throw Object.assign(new Error('获取音频临时链接失败'), { code: 'UPSTREAM' });
  return { url, key, fileID: cached.fileID };
}
```

- `ttsGet` 函数体最前面加：

```js
  const lang = ttsLang(data.lang);
  if (!lang) return fail('BAD_REQUEST', `lang 非法: ${data.lang}`);
  if (lang === 'om') {
    if (!validRate(data.rate)) return fail('BAD_REQUEST', `rate 非法: ${data.rate}`);
    const t = cleanText(data.text);
    if (!t) return fail('BAD_REQUEST', `text 必须是 1–${MAX_TEXT_CHARS} 字符的非空字符串`);
    let r;
    try { r = await ensureOmTts(ctx, now, t, data.rate); } catch (err) { return mapError(err); }
    if (r.missing) return fail('BAD_REQUEST', '这句还没有生成语音');
    return ok({ url: r.url, key: r.key, fileID: r.fileID });
  }
```

- `ttsBatch` 函数体最前面加（校验 `items` 的规则与阿姆哈拉语相同，抽成本地小函数复用即可）：

```js
  const lang = ttsLang(data.lang);
  if (!lang) return fail('BAD_REQUEST', `lang 非法: ${data.lang}`);
  if (lang === 'om') {
    if (!validRate(data.rate)) return fail('BAD_REQUEST', `rate 非法: ${data.rate}`);
    if (!Array.isArray(data.items)) return fail('BAD_REQUEST', 'items 必须是数组');
    if (data.items.length > MAX_BATCH_ITEMS) return fail('BAD_REQUEST', `items 最多 ${MAX_BATCH_ITEMS} 条`);
    const urls = {};
    const files = {};
    const list = data.items
      .filter((it) => it && (typeof it.id === 'string' || typeof it.id === 'number'))
      .map((it) => ({ id: String(it.id), text: cleanText(it.text) }))
      .filter((it) => it.text);
    await runPool(list, BATCH_CONCURRENCY, async (it) => {
      try {
        const r = await ensureOmTts(ctx, now, it.text, data.rate);
        if (r.missing) return;
        Object.defineProperty(urls, it.id, { value: r.url, enumerable: true, writable: true, configurable: true });
        Object.defineProperty(files, it.id, { value: r.fileID, enumerable: true, writable: true, configurable: true });
      } catch (err) {
        if (!(err && UPSTREAM_CODES.includes(err.code))) throw err;
      }
    });
    return ok({ urls, files });
  }
```

- `sttScore` 函数体最前面加：`if (data.lang && data.lang !== 'am') return fail('BAD_REQUEST', '该语言暂不支持发音评分');`
- `handleSpeech` 的 `switch` 加 `case 'tts.caps': return ok({ langs: TTS_LANGS.slice() });`

`cloudfunctions/api/handler.js`：`const isGated = GATED_PREFIXES.some((p) => action.startsWith(p));` 改为：

```js
  // 奥罗莫语语音是随代码包发布的预生成音频：没有成本、不涉及用户数据，不设登录门槛
  const isFreeTts = action.startsWith('tts.') && (data.lang === 'om' || action === 'tts.caps');
  const isGated = !isFreeTts && GATED_PREFIXES.some((p) => action.startsWith(p));
```

（`data = data || {};` 已在它之前。）

- [ ] **Step 3: 运行测试**

Run: `node --test cloudfunctions/api/test/*.test.js` → Expected: 全部通过（原 96 个 + 新 8 个）

- [ ] **Step 4: 运行全部测试**：`npm test` → `# fail 0`

- [ ] **Step 5: 提交**

```bash
git add cloudfunctions/api/om-audio.js cloudfunctions/api/speech.js cloudfunctions/api/handler.js cloudfunctions/api/test/speech.om.test.js
git commit -m "feat(cloud): serve pre-generated Oromo audio without login or quota"
```

---

### Task 3: 前端奥罗莫语朗读

**Files:**
- Modify: `miniprogram/langs/om/index.js`（`meta.audio: true`、`meta.ttsLogin: false`）、`miniprogram/langs/am/index.js`（`meta.ttsLogin: true`）、`miniprogram/langs/index.js`（`view()` 加 `voiceChoice`）
- Modify: `miniprogram/utils/api.js`（`ttsGet`、`ttsBatch` 加 `lang`；新增 `ttsCaps`）
- Modify: `miniprogram/utils/audio.js`（缓存键、登录规则、云端能力确认）
- Modify: `miniprogram/pages/quiz/quiz.js`（听力题条件）、`miniprogram/pages/profile/profile.wxml`（声音选项）
- Test: `scripts/check-langs.js`、`scripts/sim-miniprogram.js`

**Interfaces:**
- Consumes：云端 `tts.get/tts.batch { lang }`、`tts.caps`（Task 2）
- Produces：
  - `meta.ttsLogin: boolean`（朗读是否要求登录；am true，om false）
  - `langs.view()` 增加 `voiceChoice: meta.voices.length > 1`
  - `api.ttsGet(text, voice, rate, lang = 'am')`、`api.ttsBatch(items, voice, rate, lang = 'am')`、`api.ttsCaps()`
  - `audio.cacheKey(text, voice, rate, lang = 'am')`：am 为 `voice|rate|text`，其他为 `<lang>|rate|text`
  - `audio.cloudTtsSupports(lang): Promise<boolean>`：am 恒为 true；其他语言调用 `tts.caps` 确认，支持才缓存

- [ ] **Step 1: 写失败的测试**

`scripts/check-langs.js`：`['hasRom', 'scoring', 'beta', 'audio']` 加 `'ttsLogin'`；`langs.view('am')` 的期望加 `voiceChoice: true`。

`scripts/sim-miniprogram.js`：把 Task 3（PR 2）里「没有语音的语言：朗读不发任何请求」那段断言改为针对一个 `audio: false` 的测试语言（用 `langs.register('xx', { ...langs.pack('om'), meta: { ...langs.meta('om'), code: 'xx', audio: false } })` 注册后 `langs.set('xx')` 测，测完 `langs.set('om')`），并在多语言块末尾（全流程之后）加：

```js
  // 奥罗莫语朗读：免登录、带 lang、缓存键独立；旧云函数（不认识 tts.caps）时不发 tts 请求
  langs.set('om');
  const omText = langs.pack('om').getUnit('om-u01').items[0].text;
  const savedProfile = wx.getStorageSync('profile_v1');
  wx.setStorageSync('profile_v1', { ...(savedProfile || {}), registered: false });
  const sent = [];
  const cf0 = wx.cloud.callFunction;
  wx.cloud.callFunction = (o) => { sent.push(o.data); return cf0(o); };
  wx.cloud.downloadFile = ({ fileID, success }) => { const p = `/tmp/sim/${fileID.split('/').pop()}`; localFiles.add(p); success({ statusCode: 200, tempFilePath: p }); };
  await audio.speak(omText);
  const omCall = sent.find((d) => d.action === 'tts.get');
  assert.ok(omCall, '未登录也能朗读奥罗莫语');
  assert.equal(omCall.data.lang, 'om');
  assert.ok(sent.some((d) => d.action === 'tts.caps'), '先确认云函数支持奥罗莫语');
  assert.match(global.__audioCtx.src, /\/tmp\/sim\//, '播放下载到本地的文件');
  assert.ok(wx.getStorageSync('audio_cache_v1')[`om|normal|${omText}`], '奥罗莫语本地缓存键带语言前缀');
  sent.length = 0;
  await audio.speak(omText);
  assert.equal(sent.filter((d) => d.action === 'tts.get').length, 0, '第二次走本地缓存');
  const omQuiz2 = quiz.buildQuiz('om-u01', 9, progress.load(), langs.meta().audio);
  assert.ok(omQuiz2.some((q) => q.listen), '奥罗莫语有语音后出听力题');
  wx.cloud.callFunction = cf0;
  delete wx.cloud.downloadFile;
  wx.setStorageSync('profile_v1', savedProfile);
  assert.equal(langs.view().voiceChoice, false, '奥罗莫语只有一种声音，不显示男声/女声');
  langs.set('am');
  assert.equal(langs.view().voiceChoice, true);
```

另外在上面这段之前单独测旧云函数：用一个只对 `tts.caps` 返回 `{ result: { ok: false, code: 'BAD_REQUEST', error: '未知 action: tts.caps' } }`、其余转发真实 mock 的 `callFunction`，`await audio.speak(另一个奥罗莫语文本)` 后断言没有任何 `tts.get` 请求、弹出的提示含「云函数版本过旧」。注意 `audio.cloudTtsSupports` 只缓存「支持」，所以旧云函数测试放在新云函数测试之前。

- [ ] **Step 2: 运行，确认失败**：`node scripts/check-langs.js` → FAIL `am: meta.ttsLogin`

- [ ] **Step 3: 实现**

语言包：`am/index.js` 的 `meta` 加 `ttsLogin: true,`；`om/index.js` 的 `meta` 改 `audio: true,` 并加 `ttsLogin: false,`，文件头注释去掉「语音在 PR 3 上线前 meta.audio = false」一句，改为「语音为 Meta MMS 预生成（见 scripts/gen-oromo-audio.py）」。

`langs/index.js` 的 `view` 返回值加 `voiceChoice: m.voices.length > 1`。

`utils/api.js`：

```js
  ttsGet: (text, voice, rate, lang) => call('tts.get', { text, voice, rate, lang: lang || 'am' }),
  ttsBatch: (items, voice, rate, lang) => call('tts.batch', { items, voice, rate, lang: lang || 'am' }),
  ttsCaps: () => call('tts.caps'),
```

`utils/audio.js`：
- `cacheKey(text, voice, rate, lang)`：`return !lang || lang === 'am' ? \`${voice}|${rate}|${text}\` : \`${lang}|${rate}|${text}\`;`
- 新增：

```js
const ttsSupported = { am: true };
/**
 * 云函数是否支持这种语言的语音。旧版云函数不认识 lang，会用阿姆哈拉语声音去合成奥罗莫语并计费，
 * 所以非阿姆哈拉语先用 tts.caps 确认；只缓存「支持」，负责人重新部署后自动恢复。
 */
function cloudTtsSupports(lang) {
  if (ttsSupported[lang]) return Promise.resolve(true);
  return api.ttsCaps()
    .then((r) => { ttsSupported[lang] = !!(r && Array.isArray(r.langs) && r.langs.includes(lang)); return !!ttsSupported[lang]; })
    .catch(() => false);
}
```

- `speak`：
  - `const key = cacheKey(text, s.voice, s.rate, m.code);`
  - `if (opts.silent && !account.isRegistered()) return Promise.resolve();` → `if (opts.silent && m.ttsLogin && !account.isRegistered()) return Promise.resolve();`
  - `fetchAndPlay` 增加参数 `lang`，调用 `api.ttsGet(text, s.voice, s.rate, lang)`；在请求前 `return cloudTtsSupports(lang).then((ok) => { if (!ok) { if (!opts.silent) fail('云函数版本过旧，暂不支持这种语言的发音。请管理员重新部署云函数 api。'); return; } return api.ttsGet(…)… })`（把原来的 `.then/.catch` 链接在里面）。
- `prefetch`：`const lang = langs.meta().code;`，`cacheKey(text, s.voice, s.rate, lang)`；批量请求前 `cloudTtsSupports(lang)` 为 false 时直接返回；`api.ttsBatch(…, s.voice, s.rate, lang)`。
- 导出加 `cloudTtsSupports`。

`pages/quiz/quiz.js`：`const withAudio = api.configured() && account.isRegistered() && langs.meta().audio;` → 

```js
    const m = langs.meta();
    const withAudio = api.configured() && m.audio && (!m.ttsLogin || account.isRegistered());
```

`pages/profile/profile.wxml`：包含「女声 / 男声」`radio-group` 的那一行 `list-item` 加 `wx:if="{{voiceChoice}}"`（profile 的 `onShow` 已 `setData(langs.view())`）。

- [ ] **Step 4: 运行全部测试**：`npm test` → `# fail 0`

- [ ] **Step 5: 提交**

```bash
git add miniprogram scripts
git commit -m "feat: play Oromo audio without login, keyed per language, guarded by tts.caps"
```

---

### Task 4: 校对表加音频列

**Files:**
- Modify: `scripts/gen-oromo-review.js`、`docs/oromo-review.md`（重新生成）
- Modify: `docs/superpowers/specs/2026-09-30-afan-oromo-design.md` §3.6（与实现一致即可，无需改动时跳过）

- [ ] **Step 1**：`gen-oromo-review.js` 读取 `cloudfunctions/api/audio-om/manifest.json`（不存在时按空对象处理），问候语、词条、对话、Qubee 例词四张表都加一列「音频（正常速）」，值为 `manifest['normal|' + text]`（没有则空）；表头说明加一句「音频文件在 cloudfunctions/api/audio-om/，可直接用播放器打开核对发音」。
- [ ] **Step 2**：`node scripts/gen-oromo-review.js` 重新生成，`npm test` → `# fail 0`（`--check` 通过）。
- [ ] **Step 3: 提交**

```bash
git add scripts/gen-oromo-review.js docs/oromo-review.md docs/superpowers/specs/2026-09-30-afan-oromo-design.md
git commit -m "docs: add audio file names to the Oromo review sheet"
```

---

### Task 5: 跟读页对比模式（不评分的语言）

**Files:**
- Modify: `miniprogram/pages/speak/speak.{js,wxml,wxss}`
- Modify: `miniprogram/utils/progress.js`（`markCompared`）、`miniprogram/utils/points.js`（`STAR_RULES.compare`）、`miniprogram/langs/index.js`（`view()` 加 `scoring`）
- Test: `scripts/sim-miniprogram.js`

**Interfaces:**
- Produces：
  - `progress.markCompared(itemId): boolean`——今天第一次对比这个词返回 true 并记录；进度字段 `compared = { date: 'YYYY-MM-DD', ids: { [itemId]: true } }`，日期变了就重置（`sanitize` 保证它是对象）
  - `points.STAR_RULES.compare = 1`
  - `langs.view()` 增加 `scoring`
  - 跟读页：`meta.scoring === false` 时隐藏「评分」按钮与登录提示，主按钮为「对比着听」（`bindtap="practiceCompare"`）；`practiceCompare()`：没有录音时提示「请先录音」；否则调用现有 `compare()` 并在 `progress.markCompared(item.id)` 为 true 时 `points.award('compare')`，设置 `practice: { first: boolean }`，结果卡片显示「对比完成 +1 星」或「今天这句已练过，继续多听几遍」
  - `onLoad` 守卫改为只看 `meta.audio`（没有标准音的语言才返回）；`score()` 开头加 `if (!langs.meta().scoring) return;`

- [ ] **Step 1: 写失败的测试**（加在 `scripts/sim-miniprogram.js` 奥罗莫语朗读断言之后，语言为 `om`）：

```js
  // 跟读对比：奥罗莫语不评分，对比完成每词每天 1 颗星，不调 stt.score
  langs.set('om');
  const speakPage = Object.create(pageOf('speak/speak'));
  speakPage.data = { ...pageOf('speak/speak').data };
  speakPage.setData = function (d) { this.data = { ...this.data, ...d }; };
  speakPage.onLoad({ id: 'om-u01-01' });
  speakPage.onShow();
  assert.equal(speakPage.data.item.id, 'om-u01-01', '奥罗莫语能进跟读页');
  assert.equal(speakPage.data.scoring, false);
  assert.equal(speakPage.data.needLogin, false, '不评分就不需要登录提示');
  const sttCalls = [];
  const cf1 = wx.cloud.callFunction;
  wx.cloud.callFunction = (o) => { if (o.data.action === 'stt.score') sttCalls.push(o); return cf1(o); };
  const starsBefore = progress.load().stars || 0;
  speakPage.data.tempFilePath = '/tmp/sim/rec.wav';
  speakPage.practiceCompare();
  assert.equal((progress.load().stars || 0) - starsBefore, 1, '第一次对比 +1 星');
  assert.equal(speakPage.data.practice.first, true);
  speakPage.practiceCompare();
  assert.equal((progress.load().stars || 0) - starsBefore, 1, '同一个词当天不重复给星');
  assert.equal(speakPage.data.practice.first, false);
  speakPage.score();
  assert.equal(sttCalls.length, 0, '奥罗莫语绝不调用 stt.score');
  if (speakPage.compareTimer) clearTimeout(speakPage.compareTimer);
  wx.cloud.callFunction = cf1;
  langs.set('am');
```

Run → Expected: FAIL（`practiceCompare is not a function` 或 onLoad 守卫把奥罗莫语挡回）

- [ ] **Step 2: 实现**

- `langs/index.js` `view()` 加 `scoring: m.scoring`。
- `progress.js`：`OBJECT_FIELDS` 加 `'compared'`；新增并导出：

```js
/** 今天第一次对比练习这个词返回 true（用于每词每天只给一次星） */
function markCompared(itemId) {
  const p = load();
  const today = todayStr();
  if (!p.compared || p.compared.date !== today || typeof p.compared.ids !== 'object') p.compared = { date: today, ids: {} };
  if (p.compared.ids[itemId]) return false;
  p.compared.ids[itemId] = true;
  save(p);
  return true;
}
```

- `points.js` `STAR_RULES` 加 `compare: 1        // 跟读对比（不评分的语言），每词每天一次`。
- `speak.js`：`onLoad` 守卫改为 `if (!m.audio)`；`onShow` 里 `needLogin` 改为 `langs.meta().scoring && api.configured() && !account.canUseSpeech()`；`score()` 开头 `if (!langs.meta().scoring) return;`；新增：

```js
  /** 不评分的语言：录音后与标准音交替播放，每词每天第一次完成给 1 颗星 */
  practiceCompare() {
    const { item, tempFilePath } = this.data;
    if (!item) return;
    if (!tempFilePath) { wx.showToast({ title: '请先录音', icon: 'none' }); return; }
    this.compare();
    const first = progress.markCompared(item.id);
    if (first) { try { points.award('compare'); } catch (e) { /* ignore */ } }
    try { progress.addMinutes(1); } catch (e) { /* ignore */ }
    this.setData({ practice: { first } });
  },
```

- `speak.wxml`：
  - 评分按钮 `<button class="btn accent score-btn" bindtap="score" …>` 加 `wx:if="{{scoring}}"`，其后加：

```xml
    <block wx:else>
      <button class="btn accent score-btn" bindtap="practiceCompare" disabled="{{!tempFilePath}}">对比着听</button>
      <view class="hint muted">{{L.langName}}暂不支持自动评分：录音后和标准音交替播放，自己找出差别。</view>
    </block>
```

  - 登录提示卡片的 `wx:if="{{needLogin}}"` 不变（`needLogin` 已只在评分语言下为 true）。
  - 在评分结果卡片后加：

```xml
  <view class="card result" wx:if="{{practice}}">
    <view class="res-title">{{practice.first ? '对比完成' : '今天这句已练过'}}</view>
    <view class="stars" wx:if="{{practice.first}}"><x-icon name="star" size="26" color="#F59E0B" /><text>+1</text></view>
    <view class="res-tip">{{practice.first ? '多听几遍标准音，再录一次对比。' : '继续多听几遍，明天再来还有星星。'}}</view>
  </view>
```

  - 「当前环境不支持录音，无法跟读评分。」改为「当前环境不支持录音。」
- `speak.js` 的 `data` 初值加 `practice: null, scoring: true`。

- [ ] **Step 3: 运行全部测试**：`npm test` → `# fail 0`
- [ ] **Step 4: 提交**

```bash
git add miniprogram scripts
git commit -m "feat: record-and-compare practice for languages without pronunciation scoring"
```

---

### Task 6: 「合成音」标注、模型署名与文档

**Files:**
- Modify: `miniprogram/langs/{am,om}/index.js`（`meta.voiceNote`）、`miniprogram/langs/index.js`（`view()` 加 `voiceNote`）
- Modify: `miniprogram/app.wxss`（`.syn-tag`）
- Modify: `miniprogram/pages/{lesson,review,quiz,speak,search}/*.wxml`
- Modify: `miniprogram/utils/privacy.js`、`miniprogram/pages/profile/profile.wxml`（关于）
- Modify: `scripts/check-privacy-scopes.js`、`scripts/check-langs.js`
- Modify: `README.md`、`部署配置清单.md`、`提审检查清单.md`、`miniprogram/config.js`

**Interfaces:**
- Produces：`meta.voiceNote: string`（am `''`，om `'合成音'`）；`langs.view()` 增加 `voiceNote`

- [ ] **Step 1: 写失败的检查**

`scripts/check-langs.js`：每个语言包 `assert.equal(typeof meta.voiceNote, 'string', at('meta.voiceNote'))`；`om` 必须为 `'合成音'`；`langs.view('am')` 的期望加 `voiceNote: ''`。

`scripts/check-privacy-scopes.js` 末尾（`console.log` 之前）加：

```js
// ---------- 3. 奥罗莫语合成语音的标注与署名 ----------
const mustTag = ['lesson/lesson', 'review/review', 'quiz/quiz', 'speak/speak', 'search/search'];
mustTag.forEach((p) => {
  const f = path.join(root, 'pages', `${p}.wxml`);
  const src = fs.readFileSync(f, 'utf8');
  assert.ok(/wx:if\s*=\s*['"]\{\{\s*voiceNote\s*\}\}['"]/.test(src) && /\{\{\s*voiceNote\s*\}\}/.test(src), `${rel(f)} 的朗读入口旁缺少「合成音」标注（voiceNote）`);
});
const privacySrc = fs.readFileSync(path.join(root, 'utils', 'privacy.js'), 'utf8');
const aboutSrc = fs.readFileSync(path.join(root, 'pages', 'profile', 'profile.wxml'), 'utf8');
[['utils/privacy.js', privacySrc], ['pages/profile/profile.wxml', aboutSrc]].forEach(([name, src]) => {
  assert.ok(/MMS/.test(src) && /mms-tts-orm/.test(src) && /CC BY-NC 4\.0/.test(src), `${name} 缺少奥罗莫语语音模型署名（Meta MMS、facebook/mms-tts-orm、CC BY-NC 4.0）`);
});
```

Run → Expected: FAIL（缺少 voiceNote / 署名）

- [ ] **Step 2: 实现**

- `am/index.js` meta 加 `voiceNote: '',`；`om/index.js` meta 加 `voiceNote: '合成音',`；`view()` 加 `voiceNote: m.voiceNote`。
- `app.wxss` 追加：

```css
/* 合成语音标注（奥罗莫语朗读为模型预生成） */
.syn-tag { display: inline-block; font-size: 20rpx; line-height: 1.6; padding: 0 10rpx; border-radius: 8rpx; background: var(--lav, #EEEAFB); color: #4C3D8F; margin-left: 8rpx; vertical-align: middle; }
```

- 模板里各加一个 `<text class="syn-tag" wx:if="{{voiceNote}}">{{voiceNote}}</text>`：
  - `lesson.wxml`：单元标题行（显示单元名的元素内，标题文字后面）
  - `review.wxml`：卡片正面喇叭（`fc-play`）下方或背面喇叭旁
  - `quiz.wxml`：听力题大按钮（`q-play`）旁的题型文字后
  - `speak.wxml`：「标准音」chip 的文字后
  - `search.wxml`：顶部提示行 `{{L.searchHint}}` 后面
  每处都放在已有的 `wx:if="{{audio}}"` 区块里或旁边，确保只有有语音时才出现。
- `utils/privacy.js`：`AIGC` 数组第一条之后插入 `'奥罗莫语发音为 Meta MMS 开源模型（facebook/mms-tts-orm，CC BY-NC 4.0）预先合成的机器语音，界面标有「合成音」，可能与真人发音有差异；阿姆哈拉语朗读由 Azure 语音实时合成。'`；`UPDATED` 改为 `'2026-09-30'`；`THIRD_PARTIES` 第一项的 `data` 改为 `'待朗读的阿姆哈拉语文本、阿姆哈拉语跟读录音'`（奥罗莫语不经过 Azure）。
- `pages/profile/profile.wxml` 「关于」卡片的简介 `<view class="muted">…</view>` 后加：

```xml
    <view class="muted-2 about-credit">奥罗莫语发音：Meta MMS 开源模型（facebook/mms-tts-orm，CC BY-NC 4.0）预先合成，仅供学习参考。</view>
```

- `README.md`：合规说明与「服务内容声明」段落加上与 `privacy.js` 相同的奥罗莫语语音说明；「奥罗莫语（试用版）」小节改为：语音已上线（MMS 预生成，免登录、不计额度），跟读为对比模式不评分；如何重新生成音频（`scripts/gen-oromo-audio.py` 用法）；更换为真人录音的方法（同名 mp3 覆盖后重新部署云函数）。
- `部署配置清单.md`：步骤 E 第 1 条后加：「云函数 `api` 目录里的 `audio-om/`（约 8–10MB 的奥罗莫语音频）会随「上传并部署」一起上传，不要删掉；奥罗莫语朗读不需要 Azure 密钥。」
- `提审检查清单.md`：第二节加「重新部署云函数后，未登录状态下切到奥罗莫语点朗读能出声，界面有「合成音」标注」；第三节「服务内容声明」核对项加「含奥罗莫语 MMS 合成语音的说明，与小程序内隐私页一致」；新增「关于」页有 MMS 署名一项；buildTag 示例同步。
- `miniprogram/config.js`：`buildTag: '2026-09-30 第二版（奥罗莫语语音与跟读）'`。

- [ ] **Step 3: 运行全部测试**：`npm test` → `# fail 0`，合规检查 OK
- [ ] **Step 4: 提交**

```bash
git add miniprogram scripts README.md 部署配置清单.md 提审检查清单.md
git commit -m "feat: label synthetic Oromo audio and credit the MMS model"
```

---

### Task 7: PR 2 遗留事项

**Files:**
- Modify: `miniprogram/utils/sync.js`（`syncNow`、`cloudSupports`）
- Modify: `miniprogram/pages/index/index.{js,wxml}`、`miniprogram/pages/profile/profile.{js,wxml}`、`miniprogram/utils/lang-switch.js`（只有一种语言时隐藏切换入口；首页全表自测完成判断）
- Modify: `miniprogram/langs/plan-engine.js`（全表自测打开全部批次）
- Modify: `README.md`（第 4 周「周末 AI 诊断」）
- Test: `scripts/sim-miniprogram.js`

**Interfaces:**
- Produces：`langSwitch.available(): boolean`（`langs.list().length > 1`）；首页与「我的」的切换入口 `wx:if="{{langSwitchable}}"`
- 全表自测任务 `group: 0`（字母页 0 = 全部批次；Fidel 与 Qubee 两页都已支持 0）

- [ ] **Step 1: 写失败的测试**（`scripts/sim-miniprogram.js` 多语言块末尾）：

```js
  // 进行中的上传结束后，期间新增的改动还要再传一次
  langs.set('am');
  progress.addMinutes(1);
  const firstSync = sync.syncNow();
  progress.addMinutes(1); // 上传还没结束时又改了
  await firstSync;
  await new Promise((r) => setTimeout(r, 20));
  const amCloud = await db.getProgress(simOpenid);
  assert.equal(JSON.stringify(amCloud.progress.logs), JSON.stringify(progress.load().logs), '上传期间的改动也传上去了');
  // 只有一种语言可选时隐藏切换入口
  const langSwitch2 = require(path.join(root, 'utils/lang-switch.js'));
  assert.equal(langSwitch2.available(), true);
  const cfg = require(path.join(root, 'config.js'));
  cfg.showBetaLangs = false;
  assert.equal(langSwitch2.available(), false, '奥罗莫语隐藏后不显示切换入口');
  cfg.showBetaLangs = true;
  // 第 8 周全表自测打开全部批次
  assert.equal(langs.pack('am').plan.getDayTasks(8, 6).find((t) => t.type === 'alphabet').group, 0);
```

Run → Expected: FAIL

- [ ] **Step 2: 实现**

- `sync.js` `syncNow`：`s.inFlight` 的链尾改为结束后比较当前进度，与刚上传的不同则再同步一次：

```js
    .then((r) => {
      s.inFlight = null;
      // 上传期间又有改动：再传一次，否则切后台时最后的改动会漏掉
      if (r && JSON.stringify(progress.load(code)) !== s.lastPayload) return syncNow(code);
      return r;
    });
```

  （替换原来的 `.then((r) => { s.inFlight = null; return r; })`。）
- `sync.js` `cloudSupports`：只有探测拿到答复时才记 `checkedAt`（`.then` 里设置），网络失败不进入退避：把 `s.checkedAt = Date.now();` 从请求前挪到 `.then` 回调内第一行。
- `lang-switch.js` 加并导出 `function available() { return langs.list().length > 1; }`；`index.js`、`profile.js` 的 `onShow` 里 `setData({ langSwitchable: langSwitch.available() })`；`index.wxml` 的 `.lang-chip`、`profile.wxml` 的「学习语言」行加 `wx:if="{{langSwitchable}}"`。
- `plan-engine.js`：全表自测任务 `group: 5` → `group: 0`；首页 `decorate` 里 `case 'alphabet'` 的完成判断对 `group === 0` 改为「全部 5 批都已通过」：`d.done = t.group === 0 ? [1, 2, 3, 4, 5].every((g) => p.fidelGroupsDone[g]) : !!p.fidelGroupsDone[t.group];`
- `README.md`：第 4 周那行的「周末 AI 诊断」改为「周末复盘」。

- [ ] **Step 3: 运行全部测试**：`npm test` → `# fail 0`
- [ ] **Step 4: 提交**

```bash
git add miniprogram scripts README.md
git commit -m "fix: resync changes made during an upload, hide the switch with one language, full-table self-test"
```
