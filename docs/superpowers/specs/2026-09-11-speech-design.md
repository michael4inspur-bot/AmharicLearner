# 子项目 2：语音（Azure TTS 朗读 + 语音识别跟读评分）—— 设计说明

日期：2026-09-11
状态：无人值守模式，决策由 AI 教练助手做出并记录

## 1. 目标

- 所有阿姆哈拉语词句可点击播放真人感语音，男声 / 女声、正常 / 慢速可选。
- 小测新增"听音选意思"题型；闪卡新增"先听再看"模式。
- 跟读：录自己的声音与标准音交替回放。
- 发音评分：录音送 Azure 语音识别（am-ET），识别文字与目标句做字符级相似度，给分并标出未识别的词。
- AI 教练回复中的阿姆哈拉语句子可点击朗读（实时合成）。

需求来源：brainstorming 结论——四种练习方式都要；男女声都要；教练回复要实时朗读；可接 Azure。

## 2. 非目标

- 不做自动发音评估（Azure Pronunciation Assessment 不支持阿姆哈拉语）。
- 不保存用户录音；识别完即删。
- 不做离线预生成脚本；缓存按需填充。

## 3. 架构（方案 A：按需生成 + 云端缓存）

```
小程序 utils/audio.js ──callFunction('api', tts.*/stt.*)──> 云函数 speech.js
                                                             ├── azure.js   Azure Speech REST（TTS / STT）
                                                             ├── storage.js 云存储（上传 / 临时链接 / 下载 / 删除）
                                                             └── db.js      tts_cache 集合 + ai_logs 计数
本地缓存：wx.downloadFile 到 USER_DATA_PATH/tts/，键为 voice|rate|text
```

### 3.1 云函数动作（加入现有 `api` 函数）

| action | 入参 | 出参 data |
| --- | --- | --- |
| `tts.get` | `{text, voice: 'female'\|'male', rate: 'normal'\|'slow'}` | `{url, key}`，key = sha1(`${voice}|${rate}|${text}`) |
| `tts.batch` | `{items: [{id, text}], voice, rate}`，最多 40 条 | `{urls: {id: url}}`，缺失的并行生成（并发 5） |
| `stt.score` | `{fileID, target}` | `{transcript, score: 0-100, words: [{w, ok}]}`；处理完删除 fileID |

- 文本长度上限 300 字符；超出 `BAD_REQUEST`。
- 声音映射：female → `am-ET-MekdesNeural`，male → `am-ET-AmehaNeural`；慢速为 SSML `<prosody rate="-25%">`。
- 输出格式 `audio-24khz-48kbitrate-mono-mp3`。
- 缓存：`tts_cache` 集合，`_id` = key，字段 `fileID, text, voice, rate, chars, createdAt`。命中直接取临时链接；未命中合成后上传 `tts/${key}.mp3`。
- 计数：每次缓存未命中写 `ai_logs` 一条 `type: 'tts'`（含 `chars`），每次识别写 `type: 'stt'`。每人每日上限：tts 未命中 300 次，stt 100 次。AI 三动作的 20 次上限只统计 `diagnosis/plan/chat`。
- 语音识别：Azure REST `speech/recognition/conversation/cognitiveservices/v1?language=am-ET&format=simple`，音频 `audio/wav; codecs=audio/pcm; samplerate=16000`。
- 评分：归一化（去标点 ፣ ። ፡ ? ! , . 与空白），Levenshtein 相似度 = 1 − 距离 / max(长度)，取整为 0–100；`words` 按目标句空格分词，每词是否在识别文本（归一化后）中出现。
- 环境变量：`AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`（如 `southeastasia`）。缺失 → `NO_API_KEY`，error 为"未配置 AZURE_SPEECH_KEY"。

### 3.2 云函数代码结构

- `speech.js`：`handleSpeech(action, data, ctx)`，纯逻辑，ctx 额外注入 `azure`、`storage`。`handler.js` 遇到 `tts.`/`stt.` 前缀委托给它。
- `scoring.js`：`normalize(text)`, `similarity(a, b)`, `wordMatches(target, transcript)`，纯函数。
- `azure.js`：`synthesize(text, voiceName, rate) => Promise<Buffer>`；`recognize(wavBuffer) => Promise<{status, text}>`；用全局 fetch。
- `storage.js`：`upload(cloudPath, buffer) => fileID`；`tempUrls(fileIDs) => {fileID: url}`；`download(fileID) => Buffer`；`remove(fileIDs)`。
- `db.js` 新增：`getTtsCache(key)`, `putTtsCache(doc)`；`countAiSince(openid, sinceIso, types)` 增加 `types` 参数。
- 测试用 `test/fakeAzure.js`、`test/fakeStorage.js`，`fakeDb.js` 同步扩展。

### 3.3 小程序

- `utils/audio.js`：
  - `getSettings() => {voice, rate}`，`setSettings(partial)`，存 `audio_settings_v1`，默认 `{voice: 'female', rate: 'normal'}`。
  - `speak(text, opts?) => Promise<void>`：本地缓存命中直接播放；否则 `api.ttsGet` 取 url，`wx.downloadFile` 到 `USER_DATA_PATH/tts/`，记录映射后播放。共享一个 `InnerAudioContext`，新播放先 stop。
  - `prefetch(items: [{id, text}])`：`api.ttsBatch` 后后台逐个下载，最多同时 3 个，失败静默。
  - `stop()`。
- `utils/api.js` 新增 `ttsGet(text, voice, rate)`、`ttsBatch(items, voice, rate)`、`sttScore(fileID, target)`。
- 播放入口：课程详情词句行与对话行（🔊 按钮，长按行仍是复制）、闪卡（🔊 按钮；"先听再看"模式显示时自动播放）、小测听力题（大播放按钮，进入自动播一次）、搜索结果、教练回复（正则提取埃塞文字片段 `[ሀ-፿][ሀ-፿\s፣።፡?!,.]*`，去重后显示为可点朗读的小片）。
- 课程详情 `onLoad` 调 `audio.prefetch(unit.items)`。
- 小测：`buildQuiz` 每 3 题中 1 题为 `listen` 型（`promptListen: true`，题面不显示阿姆哈拉语，选项为中文），答题后显示原文与转写。
- 闪卡：模式循环 am → zh → listen；listen 模式正面只有播放按钮，翻面显示全部。
- 跟读与评分：新页面 `pages/speak/speak?id=<itemId>`。显示词句；"听标准音"；按住录音（wav 16kHz 单声道，最长 10 秒）；"听我的"回放；"评分"上传 `stt/${Date.now()}-${随机}.wav` 到云存储后调 `api.sttScore`，展示分数、识别文字、逐词对错。入口：课程详情词句行 🎤、闪卡翻面后 🎤。录音权限被拒时弹窗引导到设置。
- 「我的」：声音（男 / 女）、语速（正常 / 慢速）两个选择。

## 4. 错误处理

- 云函数错误码沿用四种。Azure 非 200 → `UPSTREAM`；超时 20 秒 → `TIMEOUT`；缺密钥 → `NO_API_KEY`；识别状态非 `Success`（如 `NoMatch`）→ `ok: true` 但 `transcript: ''`、`score: 0`。
- 小程序：播放失败 toast "语音暂时不可用"，不阻塞学习；下载失败仍可用临时 url 直接播放。

## 5. 测试

- `scoring.test.js`：归一化去标点；相同句 100；完全不同 0 附近；`wordMatches` 标记。
- `speech.test.js`：tts.get 首次调用 azure + 上传 + 写缓存，第二次不调 azure；tts.batch 只生成缺失项；文本超长 BAD_REQUEST；缺密钥 NO_API_KEY；stt.score 下载、识别、删除文件、返回分数；stt 上限。
- `handler.ai.test.js`：AI 上限不受 tts/stt 记录影响。
- 小程序模拟脚本：假 `createInnerAudioContext`、`downloadFile`、`getFileSystemManager`、`getRecorderManager`、`cloud.uploadFile`；验证 `audio.speak` 走缓存、`buildQuiz` 含 listen 题、评分链路返回分数。

## 6. 上线步骤（负责人手动）

1. 注册 Azure 账号，创建"语音服务"资源（Speech），定价层 F0 免费（每月 50 万字符合成、5 小时识别），区域建议 `southeastasia` 或 `eastasia`。
2. 云函数环境变量添加 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`。
3. 云开发数据库新建集合 `tts_cache`（仅创建者可读写）。
4. 重新部署云函数 `api`。
5. 小程序需要录音权限；真机首次录音会弹授权。
