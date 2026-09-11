const progress = require('../../utils/progress.js');
const plan = require('../../data/plan.js');
const vocab = require('../../data/vocab.js');

const GREETINGS = [
  { am: 'ሰላም', rom: 'selam', zh: '你好' },
  { am: 'እንደምን አደርክ?', rom: 'indemin aderk?', zh: '早上好（对男）' },
  { am: 'እንደምን ዋልሽ?', rom: 'indemin walsh?', zh: '下午好（对女）' },
  { am: 'ጥሩ ስራ!', rom: 'tiru sira!', zh: '干得好！' },
  { am: 'አማርኛ እማራለሁ', rom: 'Amarigna imaralehu', zh: '我在学阿姆哈拉语' }
];

Page({
  data: {},
  onShow() { this.refresh(); },

  refresh() {
    const p = progress.load();
    const pos = progress.currentPosition(p);
    const week = plan.weeks[pos.week - 1];
    const log = progress.todayLog(p);
    const stats = progress.srsStats(p);
    const tasks = plan.getDayTasks(pos.week, pos.day).map((t) => this.decorate(t, p, stats));
    const doneCount = tasks.filter((t) => t.done).length;
    const weekUnitsDone = week.units.filter((id) => p.unitsLearned[id]).length;
    const hour = new Date().getHours();
    const greet = GREETINGS[hour < 12 ? 1 : hour < 18 ? 2 : 0];

    this.setData({
      pos,
      week,
      greet,
      tip: GREETINGS[(pos.dayIndex + 3) % GREETINGS.length],
      streak: progress.streak(p),
      minutes: log.minutes,
      goal: p.dailyMinutesGoal,
      minutePct: Math.min(100, Math.round((log.minutes / p.dailyMinutesGoal) * 100)),
      due: stats.due,
      total: stats.total,
      tasks,
      doneCount,
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
          wx.showToast({ title: 'ጥሩ ስራ! 干得好', icon: 'none' });
          this.refresh();
        }
      }
    });
  },

  goPlan() { wx.navigateTo({ url: '/pages/plan/plan' }); },
  goProfile() { wx.navigateTo({ url: '/pages/profile/profile' }); },
  goFidel() { wx.navigateTo({ url: `/pages/fidel/fidel?group=${this.data.week.fidelGroup}` }); }
});
