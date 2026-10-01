# 第二版设计：增加奥罗莫语（Afaan Oromoo）

日期：2026-09-30　状态：已与产品负责人逐段确认，待实施

## 1. 目标与范围

在同一个小程序 Amharic Learner 里增加奥罗莫语学习，用户可在两种语言之间切换，两种语言的进度分开记录。

已确认的决定：

| 问题 | 决定 |
| --- | --- |
| 产品形态 | 同一个小程序，切换语言 |
| 奥罗莫语发音 | 用 Meta 公开模型 MMS（`facebook/mms-tts-orm`，CC BY-NC 4.0）预先生成 mp3，以后可逐条换成真人录音 |
| 课程内容 | 与阿姆哈拉语相同的 16 个场景、8 周计划完整对照；Fidel 页换成 Qubee 字母与发音规则页 |
| 小程序名称 | 不改名，仍为 Amharic Learner，简介写「阿姆哈拉语·奥罗莫语」；显示名收拢到一处常量 |

不做：奥罗莫语发音评分（没有可用的识别服务）、第三种语言、改名、管理端按语言统计。

### 外部约束（已核实）

- Azure 语音服务支持 `am-ET`、`so-SO`，**不支持**奥罗莫语的合成与识别（来源：MicrosoftDocs/azure-ai-docs 仓库 `includes/language-support/tts.md`、`stt.md`）。Google Cloud TTS 同样没有。
- `facebook/mms-tts-orm` 可从本开发环境下载；许可证 CC BY-NC 4.0，要求署名、不得商用。本小程序免费，可以使用，须在「关于」页署名。
- MMS 输出的是机器合成音，只有一种声音。

## 2. 结构与数据

### 2.1 语言包

```
miniprogram/langs/
  index.js          当前语言注册表：list()、current()、set(code)、pack()
  am/vocab.js       现 data/vocab.js 迁入
  am/plan.js        现 data/plan.js 迁入
  am/alphabet.js    现 data/fidel.js 迁入
  om/vocab.js       新增：16 单元，与 am 一一对应的场景
  om/plan.js        新增：8 周计划（结构同 am）
  om/alphabet.js    新增：Qubee 字母与发音规则
```

每个语言包导出同一组接口：`meta`（code、中文名、本族名、`script: 'ethiopic' | 'latin'`、`hasRom`、`voices`、`scoring: true | false`、`beta`）、`units`、`getUnit`、`getItem`、`allItems`、`unitsForWeek`、`plan`、`alphabet`。页面只通过 `langs/index.js` 取数据，不再直接 `require('../../data/vocab.js')`。

当前语言存在本地存储 `lang_v1`，缺省 `am`。

### 2.2 字段统一

词条与对话行里原文字段由 `am` 改为 `text`，`rom` 保留为可选的拉丁转写：

```js
{ id: 'u01-01', text: 'ሰላም', rom: 'selam', zh: '你好 / 平安（万能问候）' }        // am
{ id: 'om-u01-01', text: 'Akkam', zh: '你好（万能问候）' }                         // om，无 rom
```

`hasRom === false` 时隐藏「显示转写」开关，小测选项只显示 `text`，不再出现 `text  rom` 重复。

### 2.3 id 与进度

- 阿姆哈拉语 id 不变（`u01-01`、`u01`），奥罗莫语加前缀（`om-u01-01`、`om-u01`）。
- 本地进度：阿姆哈拉语仍是 `progress_v1`，奥罗莫语 `progress_om_v1`。星星、徽章、复习卡片、周任务各语言独立。
- 云端进度：`progress.get` / `progress.put` 增加可选参数 `lang`。阿姆哈拉语文档仍是 `_id = openid`（老数据零迁移），奥罗莫语 `_id = openid + ':om'`。冲突检测（`baseUpdatedAt`）按文档各自进行。
- 用户摘要（管理端列表）只由阿姆哈拉语的上传写入，保持现状。
- 徽章里写死的 `u14/u15/u16` 改为读当前语言包的配置。实战任务键 `missions.w1/w4` 不改为语言包配置：两种语言的 8 周结构一致，任务键按周编号，进度又按语言分开存，不会串。

### 2.4 字母页

不把 `pages/fidel` 改名为通用页，而是保留 `pages/fidel`（阿姆哈拉语）、新增 `pages/qubee`（奥罗莫语），由语言包的 `alphabet.page` 决定跳转。两种文字的交互完全不同，拆成两页比一个页面里分支渲染简单，也不影响现有 Fidel 页。

- `pages/fidel`（`ethiopic`）：现有 Fidel 字母表，功能不变。
- `pages/qubee`（`latin`）：Qubee 页，按以下几项讲解，每项配例词与发音：元音长短（`a`/`aa`）、辅音重读（`d`/`dd`）、撇号 `'`（hudhaa，喉塞音）、双字母 `ch dh ny ph sh`、特殊字母 `c q x`。

计划里的 `type: 'fidel'` 任务改为 `type: 'alphabet'`，文案取自语言包。

## 3. 语音与跟读

### 3.1 离线生成奥罗莫语语音

`scripts/gen-oromo-audio.py`：

1. 调用 `node scripts/dump-om-texts.js` 导出奥罗莫语全部待朗读文本（词条 + 对话行，去重）。
2. 用 `transformers` 的 `VitsModel` 加载 `facebook/mms-tts-orm`，固定随机种子，对每条文本生成正常语速和慢速（`speaking_rate = 0.75`）两份。
3. 用 ffmpeg 转为 16kHz 单声道 mp3（约 32kbps），文件名 `sha1('om|' + rate + '|' + text).mp3`，写入 `cloudfunctions/api/audio-om/`。
4. 写 `cloudfunctions/api/audio-om/manifest.json`：`{ "<rate>|<text>": "<file>.mp3" }`。已存在且文本未变的文件跳过，只生成新增和改动的句子。

预计约 520 条文本 × 2 种语速，总量 5–9MB，在云函数代码包限制以内。若超出，把码率降到 24kbps。

生成依赖（torch CPU 版、transformers、ffmpeg）只在开发机上装，不进小程序、也不进云函数依赖。

### 3.2 云函数

- `tts.get` / `tts.batch` 增加可选参数 `lang`，缺省 `am`，阿姆哈拉语逻辑与缓存 key（`sha1(voice|rate|text)`）完全不变。
- `lang === 'om'`：
  1. 按 manifest 找本地 mp3，找不到返回 `BAD_REQUEST`「这句还没有生成语音」。
  2. 缓存 key 带文件内容版本：`sha1('om|' + rate + '|' + text + '|' + ver)`，`ver` 为该 mp3 字节 sha1 的前 12 位（`om-audio.js` 按文件路径在进程内记忆）。未命中时读取代码包内文件上传到 `tts/om/<key>.mp3`，写 `tts_cache`。代码包里的文件名仍是 `sha1('om|' + rate + '|' + text).mp3`；把某个 mp3 换成真人录音并重新部署后，内容版本变了，缓存键随之变化，自动上传并改用新文件。
  3. 返回 `{ url, key, fileID, lang: 'om' }`（`tts.batch` 返回 `{ urls, files, lang: 'om' }`）。`lang` 供前端识别：灰度 / 多实例部署时请求可能落到不认识 `lang` 的旧实例，旧实例的回包不带 `lang`。
  4. 不调用 Azure、不计入每日次数和每月字符额度、不写 `ai_logs`。
  5. **不要求登录**：`handler.js` 的登录门槛对 `tts.*` 且 `lang === 'om'` 的请求放行。已停用账号的限制同样不作用于此（没有成本，也没有用户数据）。
- `tts.caps`（免登录）返回 `{ langs: ['am', 'om'] }`，前端朗读非阿姆哈拉语前先调它确认云函数已更新；旧云函数不认识这个 action，返回 `BAD_REQUEST`。阿姆哈拉语从不调用它。
- `stt.score` 只服务阿姆哈拉语：先校验录音是本人上传的（`stt/<openid>/`），`lang` 不是 `am` 时删除该录音后返回 `BAD_REQUEST`（不识别、不写日志）。前端 `api.sttScore` 带上当前语言。

### 3.3 小程序前端

- `api.ttsGet(text, voice, rate, lang)`、`api.ttsBatch(items, voice, rate, lang)` 透传 `lang`。
- `utils/audio.js`：
  - `speak(text, opts)` 的语言取自当前语言（`langs.meta().code`），不接受 `opts.lang`。
  - 本地缓存 key：阿姆哈拉语保持 `voice|rate|text`（老缓存继续有效），奥罗莫语为 `om|v<audioVersion>|rate|text`，`audioVersion` 在 `langs/om/index.js` 的 meta 里（正整数，`check-langs.js` 校验）；换真人录音后加 1，手机上的旧文件不再命中。
  - 非阿姆哈拉语先用 `tts.caps` 确认云函数支持（只缓存「支持」）；`tts.get` / `tts.batch` 的回包 `lang` 与请求不一致时不播放、不缓存，主动点的提示「云函数版本过旧」。
  - 奥罗莫语自动播放（`silent`）不再因为未登录而跳过。
  - 上一轮的「先云存储下载 → 换源 → 坏缓存重下」逻辑全部复用。
- PR 2 起语言包有 `audio` 开关；奥罗莫语语音上线前为 false。
- 设置：`meta.voices` 只有一种时隐藏「男声 / 女声」，保留语速。
- 小测听力题、复习「先听再看」：奥罗莫语不要求登录即可出现。

### 3.4 跟读页

- 阿姆哈拉语：不变。
- 奥罗莫语（`meta.scoring === false`）：「录音 → 回放 → 与标准音交替对比听」，不显示分数、不调用 `stt.score`。完成一次对比练习给 1 颗星、记 1 分钟学习时长（每词每天最多一次）。录音只在本机回放，不上传。

### 3.5 合规

- 「关于」页与隐私页服务说明加：「奥罗莫语发音为 Meta MMS 公开模型预先合成的机器语音（CC BY-NC 4.0），可能与真人发音有差异」。
- 奥罗莫语朗读按钮旁显示小标注「合成音」。
- 这是预先生成的固定音频，用户不能输入内容让它生成，性质与现有 Azure 朗读相同；与上一轮被驳回的「AI 问答」不同。
- `scripts/check-privacy-scopes.js` 增加检查：奥罗莫语朗读入口的模板必须带「合成音」标注；「关于」页必须含 MMS 署名。

### 3.6 质量把关

- 生成 `docs/oromo-review.md`：每行包含单元、词句、中文、音频文件名，供母语者逐条核对文字与发音。
- 校对完成前，`om` 语言包 `meta.beta = true`，切换入口显示「试用版」。

## 4. 界面

| 位置 | 改动 |
| --- | --- |
| 首页顶部 | 语言切换标签（`አማርኛ 阿姆哈拉语 ▾` / `Afaan Oromoo 奥罗莫语 ▾`），点开 ActionSheet 切换；切换后今日任务、课程、复习随之变化 |
| 我的 | 「学习语言」一行，作用同上；关于页加 MMS 署名 |
| 课程 / 复习 / 小测 / 搜索 / 计划 / 登录 | 写死的「阿姆哈拉语」「看阿」「ጥሩ ስራ!」等改为读 `meta` 与语言包文案 |
| 字体 | `script === 'ethiopic'` 才用 `.am` 字体类并加载 Fidel 字体；拉丁文字用普通字体 |
| 首次进入 | 不强制选择，缺省阿姆哈拉语（不给审核员增加步骤） |

## 5. 错误处理

- 语言码只接受 `am` / `om`，其他值在前端回退为 `am`，在云函数返回 `BAD_REQUEST`。
- 奥罗莫语音频缺失：弹框「这句还没有生成语音」，不影响继续学习。
- 切换语言时停止正在播放的音频，清空页面上的临时状态（当前复习卡片、进行中的小测）。
- 云端进度拉取失败时两种语言各自独立处理，一个失败不影响另一个。

## 6. 测试

- 云函数单测：`lang: 'om'` 按 manifest 返回音频；不计额度、未登录可用；manifest 缺失给出明确错误；阿姆哈拉语缓存 key 不变；`stt.score` 拒绝 `om`；`progress.*` 按语言读写不同文档。
- 模拟脚本：切到奥罗莫语完整走一遍（课程 → 复习 → 小测听力题 → 跟读对比 → 进度同步），断言两种语言进度互不影响、切回阿姆哈拉语后原进度完好。
- 数据校验脚本 `scripts/check-langs.js`（纳入 `npm test`）：各语言包 id 唯一；单元数同为 16；奥罗莫语文本不含 Ethiopic 字符；每条奥罗莫语文本在 manifest 中有两种语速的音频；阿姆哈拉语词条字段完整。
- 现有直接引用 `data/vocab.js` 的测试改为通过语言包取数据。
- `npm test` 全部通过才提交。

## 7. 实施与上线

分 4 个 PR，每个都能单独运行并通过测试：

1. **多语言骨架与字段重构**：`langs/` 目录、`text` 字段、语言切换、进度与 API 的 `lang` 参数。此时只有阿姆哈拉语，行为不变。
2. **奥罗莫语课程内容**：16 单元词库、8 周计划、Qubee 页、`check-langs.js`，入口标「试用版」。
3. **语音生成与云函数**：生成脚本、音频包、manifest、`tts.*` 的 `om` 分支、校对表。
4. **跟读对比、文案与合规**：奥罗莫语跟读、「合成音」标注、关于页署名、合规检查、清单更新。

上线：负责人重新部署云函数（带音频包）、上传体验版；母语者按 `docs/oromo-review.md` 校对并由我修正；去掉「试用版」后提审。提审检查清单增加两项：奥罗莫语朗读在未登录状态下能播放；「关于」页有 MMS 署名。
