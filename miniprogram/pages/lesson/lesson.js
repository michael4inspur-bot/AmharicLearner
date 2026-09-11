const progress = require('../../utils/progress.js');
const vocab = require('../../data/vocab.js');
const audio = require('../../utils/audio.js');

Page({
  data: { unit: null, tab: 'words', learned: false, showRom: true, showZh: true },
  onLoad(q) {
    const unit = vocab.getUnit(q.id);
    if (!unit) { wx.navigateBack(); return; }
    wx.setNavigationBarTitle({ title: unit.title });
    this.enterAt = Date.now();
    this.setData({ unit, tab: q.tab || 'words' });
    audio.prefetch(unit.items);
  },
  onShow() {
    const p = progress.load();
    this.setData({ learned: !!p.unitsLearned[this.data.unit.id] });
  },
  onUnload() {
    const min = Math.round((Date.now() - this.enterAt) / 60000);
    if (min > 0) progress.addMinutes(Math.min(min, 30));
    audio.stop();
  },
  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); },
  toggleRom() { this.setData({ showRom: !this.data.showRom }); },
  toggleZh() { this.setData({ showZh: !this.data.showZh }); },
  learn() {
    progress.learnUnit(this.data.unit.id);
    this.setData({ learned: true });
    wx.showToast({ title: `已加入复习 ${this.data.unit.items.length} 张卡`, icon: 'none' });
  },
  quiz() { wx.navigateTo({ url: `/pages/quiz/quiz?scope=${this.data.unit.id}` }); },
  copy(e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.text });
  },
  play(e) { audio.speak(e.currentTarget.dataset.text); },
  speakPage(e) { wx.navigateTo({ url: `/pages/speak/speak?id=${e.currentTarget.dataset.id}` }); }
});
