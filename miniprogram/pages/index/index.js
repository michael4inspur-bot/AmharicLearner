const progress = require('../../utils/progress.js');
const points = require('../../utils/points.js');
const api = require('../../utils/api.js');
const plan = require('../../data/plan.js');
const vocab = require('../../data/vocab.js');
const update = require('../../utils/update.js');

const GREETINGS = [
  { am: 'ሰላም', rom: 'selam', zh: '你好' },
  { am: 'እንደምን አደርክ?', rom: 'indemin aderk?', zh: '早上好（对男）' },
  { am: 'እንደምን ዋልሽ?', rom: 'indemin walsh?', zh: '下午好（对女）' },
  { am: 'ጥሩ ስራ!', rom: 'tiru sira!', zh: '干得好！' },
  { am: 'አማርኛ እማራለሁ', rom: 'Amarigna imaralehu', zh: '我在学阿姆哈拉语' }
];

const ANNOUNCE_KEY = 'announcement_seen';
const PROFILE_KEY = 'profile_v1';

function readStorage(key) {
  try { return wx.getStorageSync(key); } catch (e) { return null; }
}

// 每类任务完成后可得的星数（与 utils/points.js 的 STAR_RULES 对齐）
const R = points.STAR_RULES;
const TASK_STARS = {
  review: R.review_clear,
  learn: R.learn_unit,
  quiz: R.quiz,
  mission: R.mission,
  fidel: R.fidel,
  dialog: 0,
  ai: 0,
  reflect: 0
};

Page({
  data: { days7: [1, 2, 3, 4, 5, 6, 7], announce: null, needNickname: false },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().select('/pages/index/index');
    this.refresh();
    this.loadNotices();
  },

  /** 公告与昵称提示：云端没准备好时静默跳过，不打扰用户 */
  loadNotices() {
    const profile = readStorage(PROFILE_KEY) || {};
    const nickname = String(profile.nickname || '');
    const configured = api.configured();
    // 首页不引导登录、不索要授权：登录入口只在「我的」和需要 AI/语音的功能里，由用户自己点。
    // 昵称提示也只对已经登录过的人显示，新用户进来先自由体验。
    this.setData({ needNickname: configured && !!profile.registered && !nickname });
    if (!configured) { this.setData({ announce: null }); return Promise.resolve(); }
    return api.announcement()
      .then((a) => {
        const text = a && a.text ? String(a.text) : '';
        const updatedAt = String((a && a.updatedAt) || '');
        const seen = String(readStorage(ANNOUNCE_KEY) || '');
        this.setData({ announce: text && seen !== updatedAt ? { text, updatedAt } : null });
      })
      .catch(() => { /* 静默：云端还没有公告能力时当作没有公告 */ });
  },

  /**
   * 下拉刷新：重算今日任务、拉公告，并汇报版本更新状态。
   * 微信只在冷启动时检查新版本，没有重新检查的接口，所以这里汇报的是本次启动的检查结果；
   * 新版已经下载好时直接弹框问要不要重启。
   */
  async onPullDownRefresh() {
    try {
      this.refresh();
      await this.loadNotices();
    } catch (e) {
      // 拉公告失败不影响刷新本身
    } finally {
      wx.stopPullDownRefresh();
    }
    update.checkNow();
    if (update.status() !== 'ready') wx.showToast({ title: update.refreshHint(), icon: 'none' });
  },

  dismissAnnounce() {
    const a = this.data.announce;
    if (a) { try { wx.setStorageSync(ANNOUNCE_KEY, a.updatedAt || ''); } catch (e) { /* 忽略 */ } }
    this.setData({ announce: null });
  },

  refresh() {
    const p = progress.load();
    const pos = progress.currentPosition(p);
    const week = plan.weeks[pos.week - 1];
    const log = progress.todayLog(p);
    const stats = progress.srsStats(p);
    const tasks = plan.getDayTasks(pos.week, pos.day).map((t) => this.decorate(t, p, stats));
    const required = tasks.filter((t) => !t.optional);
    const doneCount = required.filter((t) => t.done).length;
    const requiredCount = required.length;
    const weekUnitsDone = week.units.filter((id) => p.unitsLearned[id]).length;
    const hour = new Date().getHours();
    const greet = GREETINGS[hour < 12 ? 1 : hour < 18 ? 2 : 0];
    const minutePct = Math.min(100, Math.round((log.minutes / p.dailyMinutesGoal) * 100));
    const nb = points.nextBadge(p);

    this.setData({
      pos,
      week,
      greet,
      tip: GREETINGS[(pos.dayIndex + 3) % GREETINGS.length],
      streak: progress.streak(p),
      minutes: log.minutes,
      goal: p.dailyMinutesGoal,
      minutePct,
      minuteDeg: Math.round(minutePct * 3.6),
      due: stats.due,
      total: stats.total,
      tasks,
      doneCount,
      requiredCount,
      stars: p.stars || 0,
      badgeHint: nb ? nb.hint : '',
      weekPct: week.units.length ? Math.round((weekUnitsDone / week.units.length) * 100) : Math.round((pos.day / 7) * 100),
      overrides: p.planOverrides
    });
  },

  decorate(t, p, stats) {
    const today = progress.todayStr();
    const d = { ...t };
    if (t.unit && t.unit !== 'all' && t.unit !== 'week') {
      const u = vocab.getUnit(t.unit);
      d.unitTitle = u ? u.title : t.unit;
      d.title = d.title.replace(t.unit, d.unitTitle);
    }
    switch (t.type) {
      case 'review': d.done = stats.due === 0 && stats.total > 0; d.extra = stats.due ? `${stats.due} 张到期` : (stats.total ? '已清空' : '还没有卡片'); break;
      case 'learn': d.done = !!p.unitsLearned[t.unit]; break;
      case 'quiz': d.done = p.quizScores.some((q) => q.date === today && (q.unit === t.unit || t.unit === 'week' || t.unit === 'all')); break;
      case 'mission': d.done = !!p.missions[t.missionKey]; break;
      case 'fidel': d.done = !!p.fidelGroupsDone[t.group]; break;
      case 'dialog': d.done = !!p.unitsLearned[t.unit]; break;
      case 'ai': case 'reflect': d.done = p.aiHistory.some((h) => (h.date || '').slice(0, 10) === today); break;
      default: d.done = false;
    }
    d.stars = TASK_STARS[t.type] || 0;
    return d;
  },

  onTask(e) {
    const t = this.data.tasks[e.currentTarget.dataset.idx];
    const pos = this.data.pos;
    switch (t.type) {
      case 'review': wx.switchTab({ url: '/pages/review/review' }); break;
      case 'learn': case 'dialog': wx.navigateTo({ url: `/pages/lesson/lesson?id=${t.unit}${t.type === 'dialog' ? '&tab=dialog' : ''}` }); break;
      case 'quiz': {
        const scope = t.unit === 'week' ? `week:${pos.week}` : t.unit;
        wx.navigateTo({ url: `/pages/quiz/quiz?scope=${scope}` });
        break;
      }
      case 'fidel': wx.navigateTo({ url: `/pages/fidel/fidel?group=${t.group}` }); break;
      case 'mission': this.confirmMission(t); break;
      case 'ai': case 'reflect': wx.switchTab({ url: '/pages/coach/coach' }); break;
      default: break;
    }
  },

  confirmMission(t) {
    if (t.done) return;
    wx.showModal({
      title: '实战任务',
      content: `${t.desc}\n\n已经在现实中完成了吗？`,
      confirmText: '完成了',
      cancelText: '还没',
      success: (r) => {
        if (r.confirm) {
          progress.completeMission(t.missionKey);
          progress.addMinutes(t.minutes || 10);
          points.award('mission');
          wx.showToast({ title: 'ጥሩ ስራ! +40 星', icon: 'none' });
          points.celebrate();
          this.refresh();
        }
      }
    });
  },

  goPlan() { wx.navigateTo({ url: '/pages/plan/plan' }); },
  goProfile() { wx.switchTab({ url: '/pages/profile/profile' }); },
  goSearch() { wx.navigateTo({ url: '/pages/search/search' }); },
  goReview() { wx.switchTab({ url: '/pages/review/review' }); },
  goFidel() { wx.navigateTo({ url: `/pages/fidel/fidel?group=${this.data.week.fidelGroup}` }); }
});
