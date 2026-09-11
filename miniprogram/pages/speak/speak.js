// 跟读与评分：听标准音 → 按住录音 → 回放 / 交替对比 → 上传云存储评分。
// 所有 wx.* 在 Node 模拟环境可能不存在，涉及录音、上传的调用都做存在性判断或 try/catch。
const progress = require('../../utils/progress.js');
const vocab = require('../../data/vocab.js');
const audio = require('../../utils/audio.js');
const api = require('../../utils/api.js');

const RECORD_OPTS = { format: 'wav', sampleRate: 16000, numberOfChannels: 1, duration: 10000 };
const NO_TRANSCRIPT = '没有识别出内容，请靠近麦克风再试';

function has(fn) {
  return typeof wx !== 'undefined' && wx && typeof wx[fn] === 'function';
}

function scoreClass(score) {
  if (score >= 80) return 'good';
  if (score >= 50) return 'mid';
  return 'bad';
}

Page({
  data: {
    item: null,
    canRecord: true,
    recording: false,
    tempFilePath: '',
    loading: false,
    result: null,
    scoreClass: '',
    noTranscriptText: NO_TRANSCRIPT
  },

  onLoad(q) {
    const item = vocab.getItem(q && q.id);
    if (!item) { if (has('navigateBack')) wx.navigateBack(); return; }
    if (has('setNavigationBarTitle')) wx.setNavigationBarTitle({ title: '跟读练习' });
    this.setData({ item });
    this.setupRecorder();
  },

  onUnload() {
    audio.stop();
    this.stopPlayback();
    if (this.compareTimer) { clearTimeout(this.compareTimer); this.compareTimer = null; }
    if (this.data.recording) this.stopRecord();
  },

  // ---------- 录音器 ----------
  setupRecorder() {
    let rec = null;
    try { if (has('getRecorderManager')) rec = wx.getRecorderManager() || null; } catch (e) { rec = null; }
    if (!rec || typeof rec.start !== 'function') {
      this.recorder = null;
      this.setData({ canRecord: false });
      return;
    }
    this.recorder = rec;
    try {
      if (typeof rec.onStart === 'function') rec.onStart(() => this.setData({ recording: true }));
      if (typeof rec.onStop === 'function') {
        rec.onStop((res) => {
          const path = (res && res.tempFilePath) || '';
          this.setData({ recording: false, tempFilePath: path, result: null, scoreClass: '' });
          if (!path) wx.showToast({ title: '录音失败，请重试', icon: 'none' });
        });
      }
      if (typeof rec.onError === 'function') {
        rec.onError((err) => {
          this.setData({ recording: false });
          wx.showToast({ title: '录音出错：' + ((err && err.errMsg) || '未知错误'), icon: 'none' });
        });
      }
    } catch (e) { /* ignore */ }
  },

  /** 申请录音权限；拒绝时引导到设置页 */
  ensureAuth() {
    if (!has('authorize')) return Promise.resolve(true);
    return new Promise((resolve) => {
      wx.authorize({
        scope: 'scope.record',
        success: () => resolve(true),
        fail: () => {
          wx.showModal({
            title: '需要麦克风权限',
            content: '跟读评分需要录音。请在设置中允许使用麦克风。',
            confirmText: '去设置',
            success: (r) => { if (r && r.confirm && has('openSetting')) wx.openSetting(); }
          });
          resolve(false);
        }
      });
    });
  },

  startRecord() {
    if (!this.data.canRecord || !this.recorder || this.data.loading || this.data.recording) return;
    audio.stop();
    this.stopPlayback();
    this.ensureAuth().then((ok) => {
      if (!ok) return;
      try {
        this.recorder.start(RECORD_OPTS);
        this.setData({ recording: true });
      } catch (e) {
        this.setData({ recording: false });
        wx.showToast({ title: '无法开始录音', icon: 'none' });
      }
    });
  },

  stopRecord() {
    if (!this.recorder || !this.data.recording) return;
    try { this.recorder.stop(); } catch (e) { this.setData({ recording: false }); }
  },

  // ---------- 播放 ----------
  playStandard() {
    if (!this.data.item) return;
    this.stopPlayback();
    audio.speak(this.data.item.am);
  },

  /** 独立的回放 InnerAudioContext（不与标准音共用） */
  player() {
    if (this.playCtx) return this.playCtx;
    try {
      if (has('createInnerAudioContext')) {
        this.playCtx = wx.createInnerAudioContext() || null;
        if (this.playCtx && typeof this.playCtx.onError === 'function') {
          this.playCtx.onError(() => wx.showToast({ title: '回放失败', icon: 'none' }));
        }
      }
    } catch (e) { this.playCtx = null; }
    return this.playCtx;
  },

  playMine() {
    const path = this.data.tempFilePath;
    if (!path) { wx.showToast({ title: '请先录音', icon: 'none' }); return; }
    audio.stop();
    const c = this.player();
    if (!c) { wx.showToast({ title: '回放不可用', icon: 'none' }); return; }
    try {
      if (typeof c.stop === 'function') c.stop();
      c.src = path;
      c.play();
    } catch (e) { wx.showToast({ title: '回放失败', icon: 'none' }); }
  },

  stopPlayback() {
    if (this.playCtx) { try { this.playCtx.stop(); } catch (e) { /* ignore */ } }
  },

  /** 交替对比：先标准音，延时后播自己的（拿不到标准音结束事件，用文本长度估算） */
  compare() {
    if (!this.data.item) return;
    if (!this.data.tempFilePath) { wx.showToast({ title: '请先录音', icon: 'none' }); return; }
    if (this.compareTimer) clearTimeout(this.compareTimer);
    this.playStandard();
    const wait = Math.max(1500, this.data.item.am.length * 250);
    this.compareTimer = setTimeout(() => { this.compareTimer = null; this.playMine(); }, wait);
  },

  // ---------- 评分 ----------
  uploadRecording(filePath) {
    return new Promise((resolve, reject) => {
      if (typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.uploadFile !== 'function') {
        reject(new Error('当前环境不支持上传录音'));
        return;
      }
      const cloudPath = 'stt/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.wav';
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: (res) => {
          if (res && res.fileID) resolve(res.fileID);
          else reject(new Error('上传录音失败'));
        },
        fail: (err) => reject(new Error((err && err.errMsg) || '上传录音失败'))
      });
    });
  },

  score() {
    const { item, tempFilePath, loading } = this.data;
    if (!item || loading) return;
    if (!tempFilePath) { wx.showToast({ title: '请先录音', icon: 'none' }); return; }
    audio.stop();
    this.stopPlayback();
    this.setData({ loading: true });
    this.uploadRecording(tempFilePath)
      .then((fileID) => api.sttScore(fileID, item.am))
      .then((res) => {
        res = res || {};
        const score = Math.max(0, Math.min(100, Math.round(Number(res.score) || 0)));
        const result = {
          score,
          transcript: String(res.transcript || ''),
          words: Array.isArray(res.words) ? res.words.map((x) => ({ w: String((x && x.w) || ''), ok: !!(x && x.ok) })) : []
        };
        this.setData({ loading: false, result, scoreClass: scoreClass(score) });
        try { progress.addMinutes(1); } catch (e) { /* ignore */ }
      })
      .catch((err) => {
        this.setData({ loading: false });
        wx.showModal({ title: '评分失败', content: (err && err.message) || '请稍后再试', showCancel: false });
      });
  }
});
