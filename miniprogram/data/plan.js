// 8 周阿姆哈拉语生存学习计划。
// 设计依据（成人学习特性）：
//  1. 需要知道"为什么学"    -> 每周、每单元都写明 why 与真实场景
//  2. 自我导向             -> 每天任务是建议而非强制，可调节每日时长，可让 AI 改计划
//  3. 经验为本             -> 数字、时间等与已有经验对照（埃塞时间制 vs 国际时间）
//  4. 问题中心、即学即用    -> 每周一个真实任务（mission），必须在现实中说出口
//  5. 时间碎片化           -> 每天 15–25 分钟：5 分钟复习 + 10 分钟新内容 + 5 分钟小测/实战
//  6. 间隔重复与主动回忆    -> SRS 闪卡每天优先，小测用选择题做提取练习
//  7. 文字渐进             -> Fidel 分 5 批，每周只学 6 个左右基础辅音

const DAILY_TEMPLATE = {
  reviewMinutes: 5,
  learnMinutes: 10,
  practiceMinutes: 5
};

const weeks = [
  {
    week: 1,
    theme: '打招呼 + 数字 1–10',
    goal: '第 7 天能用阿姆哈拉语和门卫/同事完整问候一个来回，能说 1–10。',
    why: '问候是埃塞社交的入场券，数字每天都要用。第一周先拿到"能开口"的成就感。',
    units: ['u01', 'u02'],
    fidelGroup: 1,
    mission: '明天早上用 ሰላም + እንደምን አደርክ/አደርሽ 向至少 3 个人打招呼，并回答 ደህና ነኝ。',
    milestone: '问候一个来回 + 报出自己的电话号码'
  },
  {
    week: 2,
    theme: '市场购物 + 大数字',
    goal: '独立在市场问价、砍价、付钱。',
    why: '这是回报最直接的场景：会说 ውድ ነው、ቀንስ 立刻能省钱，还能避免"外国人价"。',
    units: ['u03', 'u04'],
    fidelGroup: 2,
    mission: '去一次市场或水果摊，全程用阿姆哈拉语问价并砍价一次，记录省了多少。',
    milestone: '听懂 1–1000 的报价并砍价成功'
  },
  {
    week: 3,
    theme: '交通方位 + 时间日期',
    goal: '自己打车、指路、约时间不出错。',
    why: '亚的斯出租车靠口头谈价和指路；埃塞 12 小时制不搞清会约错时间。',
    units: ['u05', 'u06'],
    fidelGroup: 3,
    mission: '打一次车，用阿姆哈拉语谈价、指路（ቀኝ/ግራ/ቀጥታ/ቁም）。和一个当地人用埃塞时间约一次时间。',
    milestone: '完整打车流程 + 正确换算埃塞时间'
  },
  {
    week: 4,
    theme: '餐馆点餐 + 第一次复盘',
    goal: '看懂常见菜名、点菜、说不要辣、结账；本周后半段做整体复盘。',
    why: '前三周学了 ~130 个词，遗忘曲线开始起作用。第 4 周减少新词，把复习比例提高到 60%，并让 AI 做一次诊断。',
    units: ['u07'],
    fidelGroup: 3,
    reviewWeek: true,
    mission: '在本地餐馆全程用阿姆哈拉语点一餐并结账。周末在"AI 教练"做一次学习诊断。',
    milestone: '前 4 周词汇复习正确率 ≥ 75%'
  },
  {
    week: 5,
    theme: '句子骨架：代词、有/在、疑问词、形容词',
    goal: '能自己造简单句，而不只是背固定句。',
    why: '成人学习者擅长抽象归纳：有了 8 个代词 + አለ/ነው + 疑问词，就能把前 4 周的词重新组合成上百个句子。',
    units: ['u08', 'u09'],
    fidelGroup: 4,
    mission: '每天用当天学的疑问词向同事问一个真实问题（如 ስብሰባው መቼ ነው?）并听懂回答。',
    milestone: '现场造出 10 个没背过的句子'
  },
  {
    week: 6,
    theme: '工作场景 + 常用动词',
    goal: '在办公室、和司机保安沟通时能表达意图（我要、我能、我明天来）。',
    why: '工作是你在埃塞的主线；动词第一人称让你从"指着说词"升级到"说想做什么"。',
    units: ['u10', 'u11'],
    fidelGroup: 4,
    mission: '给本地同事或司机用阿姆哈拉语安排一件明天的事（时间 + 地点 + 做什么）。',
    milestone: '用 3 个动词句安排一件真实事务'
  },
  {
    week: 7,
    theme: '健康紧急 + 住宿日常',
    goal: '生病、停电停水、丢东西时能求助。',
    why: '这些场景发生时没时间查词典，要练到条件反射。放在第 7 周是因为它们依赖前面的句子骨架。',
    units: ['u12', 'u13'],
    fidelGroup: 5,
    mission: '去一次药店用阿姆哈拉语买一种常备药；向房东或保安用阿姆哈拉语报告一个问题。',
    milestone: '紧急 20 句不看提示脱口而出'
  },
  {
    week: 8,
    theme: '综合复习 + 实战挑战周',
    goal: '把 8 周内容融会贯通，完成 5 个真实任务，并让 AI 做结业诊断、生成下一阶段计划。',
    why: '成人学习最怕"学完就忘、学完不用"。最后一周不加新词，只做提取练习和实战，检验并巩固。',
    units: [],
    fidelGroup: 5,
    reviewWeek: true,
    mission: '5 个实战任务：市场砍价、打车指路、点餐结账、和同事约时间、向保安/房东描述一个问题。全部完成后做 AI 结业诊断。',
    milestone: '全部词汇复习正确率 ≥ 85%，5 个实战任务完成'
  }
];

/**
 * 生成某周第 day 天（1–7）的任务列表。
 * 节奏：第 1–2 天学单元 A，第 3–4 天学单元 B，第 5 天对话与小测，第 6 天实战任务，第 7 天复盘。
 */
function getDayTasks(week, day) {
  const w = weeks[week - 1];
  if (!w) return [];
  const tasks = [{ type: 'review', title: '闪卡复习', desc: '先复习到期卡片（约 5 分钟）', minutes: DAILY_TEMPLATE.reviewMinutes }];
  const [ua, ub] = w.units;

  if (w.reviewWeek && w.units.length === 0) {
    // 第 8 周：纯复习 + 实战
    const missions = ['市场砍价', '打车指路', '点餐结账', '和同事约时间', '向保安/房东描述一个问题'];
    if (day <= 5) {
      tasks.push({ type: 'quiz', title: '综合小测', desc: '10 题混合所有单元', minutes: 5, unit: 'all' });
      tasks.push({ type: 'mission', title: `实战任务 ${day}/5：${missions[day - 1]}`, desc: '完成后在"今日"页打钩', minutes: 10, missionKey: `w8m${day}` });
    } else if (day === 6) {
      tasks.push({ type: 'quiz', title: '综合小测', desc: '10 题混合所有单元', minutes: 5, unit: 'all' });
      tasks.push({ type: 'fidel', title: 'Fidel 全表自测', desc: '认读全部 33 个基础辅音', minutes: 8, group: 5 });
    } else {
      tasks.push({ type: 'ai', title: 'AI 结业诊断', desc: '在"AI 教练"做诊断并生成下一阶段计划', minutes: 10 });
    }
    return tasks;
  }

  switch (day) {
    case 1:
    case 2:
      tasks.push({ type: 'learn', title: `学习单元：${ua}`, desc: day === 1 ? '通读单元，把生词加入复习' : '再读一遍，重点看对话和用法提示', minutes: DAILY_TEMPLATE.learnMinutes, unit: ua });
      tasks.push({ type: 'fidel', title: `Fidel 第 ${w.fidelGroup} 批`, desc: '认读本批字母的 7 序', minutes: DAILY_TEMPLATE.practiceMinutes, group: w.fidelGroup });
      break;
    case 3:
    case 4:
      if (ub) {
        tasks.push({ type: 'learn', title: `学习单元：${ub}`, desc: day === 3 ? '通读单元，把生词加入复习' : '再读一遍，重点看对话和用法提示', minutes: DAILY_TEMPLATE.learnMinutes, unit: ub });
      } else {
        tasks.push({ type: 'quiz', title: '复习周小测', desc: '10 题混合前几周内容', minutes: 5, unit: 'all' });
      }
      tasks.push({ type: 'quiz', title: `单元小测：${ua}`, desc: '10 道选择题，做提取练习', minutes: DAILY_TEMPLATE.practiceMinutes, unit: ua });
      break;
    case 5:
      tasks.push({ type: 'dialog', title: '对话跟读', desc: '本周单元的对话，读到不看转写', minutes: 8, unit: ub || ua });
      tasks.push({ type: 'quiz', title: `单元小测：${ub || ua}`, desc: '10 道选择题', minutes: 5, unit: ub || ua });
      break;
    case 6:
      tasks.push({ type: 'mission', title: '本周实战任务', desc: w.mission, minutes: 10, missionKey: `w${week}` });
      break;
    default:
      tasks.push({ type: 'quiz', title: '本周综合小测', desc: '混合本周两个单元', minutes: 5, unit: 'week' });
      tasks.push({ type: 'reflect', title: '一周复盘', desc: w.reviewWeek ? '让 AI 教练做一次学习诊断，并按建议调整计划' : '写下这周说出口的 3 句话，想想下周想在哪个场景用', minutes: 5 });
  }
  return tasks;
}

/** 给 AI 的计划大纲（精简版） */
function planOutline() {
  return {
    totalWeeks: weeks.length,
    dailyMinutes: DAILY_TEMPLATE.reviewMinutes + DAILY_TEMPLATE.learnMinutes + DAILY_TEMPLATE.practiceMinutes,
    weeks: weeks.map((w) => ({ week: w.week, theme: w.theme, units: w.units, mission: w.mission, milestone: w.milestone, reviewWeek: !!w.reviewWeek }))
  };
}

const principles = [
  { title: '先知道为什么学', desc: '每个单元都写明真实场景和收益，学的每句话都能立刻用上。' },
  { title: '你说了算', desc: '每日时长、学习顺序都可调；AI 只给建议和理由，最终由你决定。' },
  { title: '挂到已有经验上', desc: '数字、时间、货币都和你已经熟悉的概念对照（如埃塞时间 = 国际时间 − 6）。' },
  { title: '问题驱动、即学即用', desc: '每周一个真实任务：市场砍价、打车指路、点餐结账……说出口才算学会。' },
  { title: '每天 20 分钟', desc: '5 分钟复习 + 10 分钟新内容 + 5 分钟小测。连续比时长更重要。' },
  { title: '间隔重复 + 主动回忆', desc: '闪卡按遗忘曲线安排，小测用选择题做提取练习，遗忘的词会更频繁出现。' },
  { title: '文字渐进', desc: 'Fidel 字母分 5 批，每周约 6 个辅音，和当周词汇绑定学。' },
  { title: '定期诊断、动态调整', desc: '第 4 周和第 8 周让 AI 根据数据诊断进度并修改计划。' }
];

module.exports = { weeks, getDayTasks, planOutline, principles, DAILY_TEMPLATE };
