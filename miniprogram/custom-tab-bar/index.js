Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '今日', icon: 'home' },
      { pagePath: '/pages/lessons/lessons', text: '课程', icon: 'book' },
      { pagePath: '/pages/review/review', text: '复习', icon: 'cards' },
      { pagePath: '/pages/coach/coach', text: 'AI 教练', icon: 'spark' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: 'user' }
    ]
  },
  methods: {
    switchTab(e) {
      const idx = Number(e.currentTarget.dataset.index);
      const item = this.data.list[idx];
      wx.switchTab({ url: item.pagePath });
      this.setData({ selected: idx });
    }
  }
});
