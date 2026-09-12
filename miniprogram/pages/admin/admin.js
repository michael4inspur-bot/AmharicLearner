// 管理端：用户 / 系统 / 公告 三个 Tab。仅管理员可用（鉴权在云函数）。
const api = require('../../utils/api.js');

const STATUS = {
  active: { label: '正常', tag: 'mint' },
  pending: { label: '待批准', tag: 'warn' },
  paused: { label: '已暂停', tag: '' },
  blocked: { label: '已停用', tag: 'gray' }
};

/** openid 尾号（4 位），用于在不暴露全量 id 的前提下区分用户 */
function tailOf(openid) {
  return String(openid == null ? '' : openid).slice(-4);
}

/** 云端用户项 → 列表行展示字段 */
function decorateUser(u) {
  const item = u || {};
  const s = STATUS[item.status] || STATUS.active;
  const t = item.today || {};
  const tail = tailOf(item.openid);
  const nickname = item.nickname || '';
  return {
    openid: item.openid,
    nickname,
    tail,
    name: nickname || `未命名 · 尾号 ${tail}`,
    status: item.status || 'active',
    statusLabel: s.label,
    tagClass: s.tag,
    lastActiveShort: String(item.lastActive || '').slice(0, 10) || '未同步',
    week: item.week || 0,
    streak: item.streak || 0,
    stars: item.stars || 0,
    today: { ai: t.ai || 0, tts: t.tts || 0, stt: t.stt || 0 },
    isSelf: !!item.isSelf
  };
}

/** 14 天调用量 → 柱高百分比（最大值 100%）与每隔 3 天的 MM-DD 标签 */
function decorateDaily(list) {
  const days = Array.isArray(list) ? list : [];
  let max = 0;
  days.forEach((d) => { if ((d.count || 0) > max) max = d.count || 0; });
  return days.map((d, i) => {
    const count = d.count || 0;
    const date = String(d.date || '');
    return {
      date,
      count,
      h: max > 0 ? Math.max(6, Math.round((count / max) * 100)) : 6,
      label: (days.length - 1 - i) % 3 === 0 ? date.slice(5, 10) : ''
    };
  });
}

/** 错误日志 → 展示字段（时间前 16 位、消息前 80 字） */
function decorateError(e) {
  const item = e || {};
  return {
    time: String(item.date || '').slice(0, 16),
    tail: tailOf(item.openid),
    action: item.action || '',
    message: String(item.message || '').slice(0, 80)
  };
}

function percent(used, limit) {
  if (!limit || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

Page({
  data: {
    tab: 'users',
    configured: true,
    loading: false,
    users: [],
    system: null,
    charsPercent: 0,
    aiDaily: [],
    errors: [],
    announcement: null,
    noticeText: '',
    publishing: false
  },

  onShow() {
    const ok = api.configured();
    this.setData({ configured: ok });
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    this.loadTab(this.data.tab);
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab });
    if (api.configured()) this.loadTab(tab);
  },

  loadTab(tab) {
    if (tab === 'system') return this.loadSystem();
    if (tab === 'notice') return this.loadAnnouncement();
    return this.loadUsers();
  },

  fail(err) {
    this.setData({ loading: false, publishing: false });
    wx.showModal({ title: '操作失败', content: (err && err.message) || '请求失败', showCancel: false });
  },

  // ---------- 用户 ----------
  async loadUsers() {
    this.setData({ loading: true });
    try {
      const res = await api.adminUsers();
      const users = ((res && res.users) || []).map(decorateUser);
      this.setData({ users, loading: false });
    } catch (e) {
      this.fail(e);
    }
  },

  onUserTap(e) {
    const openid = e.currentTarget.dataset.id;
    const list = this.data.users.filter((u) => u.openid === openid);
    const user = list[0];
    if (!user || user.isSelf) return;
    const toggle = user.status === 'active' ? '暂停账号' : (user.status === 'pending' ? '批准账号' : '恢复账号');
    wx.showActionSheet({
      itemList: [toggle, '删除用户'],
      success: (res) => {
        if (res.tapIndex === 0) this.setStatus(user, user.status === 'active' ? 'paused' : 'active');
        else if (res.tapIndex === 1) this.confirmDelete(user);
      },
      fail: () => { /* 取消 */ }
    });
  },

  async setStatus(user, status) {
    try {
      await api.adminSetStatus(user.openid, status);
      wx.showToast({ title: status === 'active' ? (user.status === 'pending' ? '已批准' : '已恢复') : '已暂停', icon: 'none' });
      await this.loadUsers();
    } catch (e) {
      this.fail(e);
    }
  },

  confirmDelete(user) {
    const who = `${user.nickname || '未命名用户'}（尾号 ${user.tail}）`;
    wx.showModal({
      title: '删除用户',
      content: `确定删除 ${who}？学习进度与 AI 记录会被清除，账号将停用，不可撤销。`,
      confirmText: '删除',
      confirmColor: '#B23A2E',
      success: (res) => { if (res.confirm) this.deleteUser(user); }
    });
  },

  async deleteUser(user) {
    try {
      await api.adminDeleteUser(user.openid);
      wx.showToast({ title: '已删除', icon: 'none' });
      await this.loadUsers();
    } catch (e) {
      this.fail(e);
    }
  },

  // ---------- 系统 ----------
  async loadSystem() {
    this.setData({ loading: true });
    try {
      const res = (await api.adminSystem()) || {};
      const month = res.monthChars || {};
      const cache = res.ttsCache || {};
      this.setData({
        system: {
          charsUsed: month.used || 0,
          charsLimit: month.limit || 0,
          aiToday: res.aiToday || 0,
          cacheCount: cache.count || 0,
          cacheChars: cache.chars || 0,
          errorCount: (res.errors || []).length
        },
        charsPercent: percent(month.used || 0, month.limit || 0),
        aiDaily: decorateDaily(res.aiDaily),
        errors: (res.errors || []).slice(0, 20).map(decorateError),
        loading: false
      });
    } catch (e) {
      this.fail(e);
    }
  },

  confirmClearCache() {
    wx.showModal({
      title: '清理语音缓存',
      content: '将删除全部已缓存的语音文件，之后首次朗读会重新合成并计入字符用量。',
      confirmText: '清理',
      success: (res) => { if (res.confirm) this.clearCache(); }
    });
  },

  async clearCache() {
    try {
      const res = (await api.adminClearTtsCache()) || {};
      wx.showToast({ title: `已清理 ${res.removed || 0} 条`, icon: 'none' });
      await this.loadSystem();
    } catch (e) {
      this.fail(e);
    }
  },

  // ---------- 公告 ----------
  async loadAnnouncement() {
    this.setData({ loading: true });
    try {
      const res = (await api.announcement()) || {};
      const text = res.text || '';
      this.setData({
        announcement: { text, updatedShort: String(res.updatedAt || '').slice(0, 16) },
        noticeText: text,
        loading: false
      });
    } catch (e) {
      this.fail(e);
    }
  },

  onNoticeInput(e) {
    this.setData({ noticeText: e.detail.value });
  },

  async publishNotice() {
    const text = String(this.data.noticeText || '').trim();
    this.setData({ publishing: true });
    try {
      const res = (await api.adminSetAnnouncement(text)) || {};
      const saved = res.text || '';
      this.setData({
        announcement: { text: saved, updatedShort: String(res.updatedAt || '').slice(0, 16) },
        noticeText: saved,
        publishing: false
      });
      wx.showToast({ title: saved ? '已发布' : '已撤下', icon: 'none' });
    } catch (e) {
      this.fail(e);
    }
  }
});
