// 8 周计划的任务生成逻辑，两个语言包共用；语言包只提供周数据、第 8 周实战、学习原则和字母批次名称。
const DAILY_TEMPLATE = {
  reviewMinutes: 8,
  learnMinutes: 15,
  practiceMinutes: 10
};

/**
 * @param {object} cfg
 * @param {Array} cfg.weeks 周数据：{ week, theme, goal, why, units, extra, alphabetGroup, mission, milestone, reviewWeek? }
 * @param {string[]} cfg.week8Missions 第 8 周 5 个实战任务名
 * @param {Array} cfg.principles 学习原则 [{ title, desc }]
 * @param {object} cfg.alphabet { name: 字母页名称, groupDesc: 每批字母任务说明, finalDesc: 结业字母自测说明 }
 * @param {object} [cfg.dialog] { desc: 第 5 天对话任务说明, secondDesc: 第二个单元的对话任务说明 }；缺省为阿姆哈拉语原文
 */
const DEFAULT_DIALOG = { desc: '本周单元的对话，读到不看转写，再用跟读页评分', secondDesc: '第二个单元的对话，同样读到不看转写' };

function createPlan(cfg) {
  const { weeks, week8Missions, principles, alphabet } = cfg;
  const dialog = { ...DEFAULT_DIALOG, ...(cfg.dialog || {}) };

  function extraTask(w, kind) {
    if (!w.extra) return null;
    if (kind === 'dialog') {
      // 自选单元也有对话，不给跟读任务的话这 4 个单元的对话永远练不到
      return { type: 'dialog', title: `自选对话：${w.extra}`, desc: '补充单元的对话，时间充裕再练', minutes: 6, unit: w.extra, optional: true };
    }
    return { type: 'learn', title: `自选：${w.extra}`, desc: '生活场景补充单元，时间充裕再学', minutes: 10, unit: w.extra, optional: true };
  }

  /**
   * 生成某周第 day 天（1–7）的任务列表。
   * 节奏：第 1–2 天学单元 A，第 3–4 天学单元 B，第 5 天对话与小测，第 6 天实战任务，第 7 天复盘。
   * 自选单元（extra）在第 5 天出词句、第 6 天出对话，都是可选任务。
   */
  function getDayTasks(week, day) {
    const w = weeks[week - 1];
    if (!w) return [];
    const tasks = [{ type: 'review', title: '闪卡复习', desc: '先复习到期卡片（约 8 分钟）', minutes: DAILY_TEMPLATE.reviewMinutes }];
    const [ua, ub] = w.units;

    if (w.units.length === 0) {
      // 第 8 周：纯复习 + 实战
      if (day <= 5) {
        tasks.push({ type: 'quiz', title: '综合小测', desc: '10 题混合所有单元', minutes: 5, unit: 'all' });
        tasks.push({ type: 'mission', title: `实战任务 ${day}/5：${week8Missions[day - 1]}`, desc: '完成后在"今日"页打钩', minutes: 10, missionKey: `w8m${day}` });
      } else if (day === 6) {
        tasks.push({ type: 'quiz', title: '综合小测', desc: '10 题混合所有单元', minutes: 5, unit: 'all' });
        tasks.push({ type: 'alphabet', title: `${alphabet.name} 全表自测`, desc: alphabet.finalDesc, minutes: 8, group: 5 });
      } else {
        tasks.push({ type: 'reflect', title: '结业复盘', reflectKey: 'final', desc: '回顾 8 周：哪些场景已经能开口，哪些还要练，写下下一阶段想攻的 3 个场景', minutes: 10 });
      }
      return tasks;
    }

    switch (day) {
      case 1:
      case 2:
        tasks.push({ type: 'learn', title: `学习单元：${ua}`, desc: day === 1 ? '通读单元，把生词加入复习' : '再读一遍，重点看对话和用法提示', minutes: DAILY_TEMPLATE.learnMinutes, unit: ua });
        tasks.push({ type: 'alphabet', title: `${alphabet.name} 第 ${w.alphabetGroup} 批`, desc: alphabet.groupDesc, minutes: DAILY_TEMPLATE.practiceMinutes, group: w.alphabetGroup });
        break;
      case 3:
      case 4:
        if (ub) {
          tasks.push({ type: 'learn', title: `学习单元：${ub}`, desc: day === 3 ? '通读单元，把生词加入复习' : '再读一遍，重点看对话和用法提示', minutes: DAILY_TEMPLATE.learnMinutes, unit: ub });
        } else {
          tasks.push({ type: 'quiz', title: '综合小测', desc: '10 题混合前几周内容', minutes: 5, unit: 'all' });
        }
        tasks.push({ type: 'quiz', title: `单元小测：${ua}`, desc: '10 道选择题，做提取练习', minutes: DAILY_TEMPLATE.practiceMinutes, unit: ua });
        break;
      case 5:
        // 原来只跟读 ub，单元 A 的对话永远被跳过（含第 1 单元的问候对话）
        tasks.push({ type: 'dialog', title: '对话跟读', desc: dialog.desc, minutes: 10, unit: ua });
        if (ub) tasks.push({ type: 'dialog', title: `对话跟读：${ub}`, desc: dialog.secondDesc, minutes: 6, unit: ub });
        tasks.push({ type: 'quiz', title: `单元小测：${ub || ua}`, desc: '10 道选择题', minutes: 5, unit: ub || ua });
        if (extraTask(w)) tasks.push(extraTask(w));
        break;
      case 6:
        tasks.push({ type: 'mission', title: '本周实战任务', desc: w.mission, minutes: 10, missionKey: `w${week}` });
        if (extraTask(w, 'dialog')) tasks.push(extraTask(w, 'dialog'));
        break;
      default:
        tasks.push({ type: 'quiz', title: '本周综合小测', desc: '混合本周单元', minutes: 5, unit: 'week' });
        tasks.push({ type: 'reflect', title: '一周复盘', reflectKey: `w${w.week}`, desc: w.reviewWeek ? '回顾本周错得最多的词，挑 3 个下周重点用的场景' : '写下这周在工作里说出口的 3 句话，想想下周想在哪个场景用', minutes: 5 });
    }
    return tasks;
  }

  /** 计划大纲（精简版） */
  function planOutline() {
    return {
      totalWeeks: weeks.length,
      dailyMinutes: DAILY_TEMPLATE.reviewMinutes + DAILY_TEMPLATE.learnMinutes + DAILY_TEMPLATE.practiceMinutes,
      goal: '工作沟通优先（IT/通信/设备交付：司机后勤、一线班组、办公室同事、客户与政府），生活场景为自选补充',
      weeks: weeks.map((w) => ({ week: w.week, theme: w.theme, units: w.units, extra: w.extra, mission: w.mission, milestone: w.milestone, reviewWeek: !!w.reviewWeek }))
    };
  }

  return { weeks, getDayTasks, planOutline, principles, DAILY_TEMPLATE };
}

module.exports = { createPlan, DAILY_TEMPLATE };
