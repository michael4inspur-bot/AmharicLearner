const config = require('../config.js');

// 完整的 Tab 列表。AI 教练是否出现由 config.aiCoachEnabled 决定：
// 微信个人主体未开放深度合成类目，默认关闭。开关同时要改 app.json 的 tabBar.list。
const ALL = [
  { pagePath: '/pages/index/index', text: '今日', icon: 'home' },
  { pagePath: '/pages/lessons/lessons', text: '课程', icon: 'book' },
  { pagePath: '/pages/review/review', text: '复习', icon: 'cards' },
  { pagePath: '/pages/coach/coach', text: 'AI 教练', icon: 'spark', needsAi: true },
  { pagePath: '/pages/profile/profile', text: '我的', icon: 'user' }
];

const LIST = ALL.filter((item) => !item.needsAi || config.aiCoachEnabled);

Component({
  data: { selected: 0, list: LIST },
  methods: {
    /** 页面 onShow 时按自己的路径点亮，Tab 增减都不会错位 */
    select(pagePath) {
      const idx = LIST.findIndex((item) => item.pagePath === pagePath);
      if (idx >= 0 && idx !== this.data.selected) this.setData({ selected: idx });
    },
    switchTab(e) {
      const idx = Number(e.currentTarget.dataset.index);
      const item = this.data.list[idx];
      if (!item) return;
      wx.switchTab({ url: item.pagePath });
      this.setData({ selected: idx });
    }
  }
});
