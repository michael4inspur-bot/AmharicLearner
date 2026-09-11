const vocab = require('../../data/vocab.js');
const progress = require('../../utils/progress.js');

const ALL = vocab.allItems().map((it) => ({
  ...it,
  unitTitle: (vocab.getUnit(it.unit) || {}).title || '',
  hay: `${it.am} ${it.rom.toLowerCase()} ${it.zh} ${it.note || ''}`.toLowerCase()
}));

Page({
  data: { q: '', results: [], recent: [] },
  onLoad() {
    let recent = [];
    try { recent = wx.getStorageSync('search_recent') || []; } catch (e) { /* ignore */ }
    this.setData({ recent });
  },
  onInput(e) { this.search(e.detail.value); },
  onConfirm(e) {
    const q = (e.detail.value || '').trim();
    if (!q) return;
    const recent = [q, ...this.data.recent.filter((x) => x !== q)].slice(0, 8);
    try { wx.setStorageSync('search_recent', recent); } catch (err) { /* ignore */ }
    this.setData({ recent });
    this.search(q);
  },
  useRecent(e) { const q = e.currentTarget.dataset.q; this.setData({ q }); this.search(q); },
  search(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) { this.setData({ q, results: [] }); return; }
    const terms = q.split(/\s+/);
    const results = ALL
      .map((it) => {
        let score = 0;
        terms.forEach((t) => {
          if (it.zh.toLowerCase() === t || it.am === t) score += 10;
          else if (it.zh.toLowerCase().includes(t)) score += 5;
          else if (it.rom.toLowerCase().startsWith(t)) score += 4;
          else if (it.hay.includes(t)) score += 2;
        });
        return { it, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((x) => x.it);
    this.setData({ q, results });
  },
  addCard(e) {
    const id = e.currentTarget.dataset.id;
    const p = progress.load();
    if (p.srs[id]) { wx.showToast({ title: '已在复习队列中', icon: 'none' }); return; }
    const srs = require('../../utils/srs.js');
    p.srs[id] = srs.newCard(Date.now() - 1000);
    progress.save(p);
    wx.showToast({ title: '已加入闪卡', icon: 'none' });
  },
  copy(e) { wx.setClipboardData({ data: e.currentTarget.dataset.text }); },
  openUnit(e) { wx.navigateTo({ url: `/pages/lesson/lesson?id=${e.currentTarget.dataset.unit}` }); }
});
