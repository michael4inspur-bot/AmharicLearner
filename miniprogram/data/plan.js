// 8 周阿姆哈拉语学习计划：以工作沟通（IT/通信/设备交付）为主线。
// 设计依据（成人学习特性）：
//  1. 需要知道"为什么学"    -> 每周、每单元都写明 why 与真实场景
//  2. 自我导向             -> 每天任务是建议而非强制，可调节每日时长，可让 AI 改计划
//  3. 经验为本             -> 数字、时间等与已有经验对照（埃塞时间制 vs 国际时间）
//  4. 问题中心、即学即用    -> 每周一个真实工作任务（mission），必须在现实中说出口；生活场景为自选补充
//  5. 时间碎片化           -> 每天约 33 分钟：8 分钟复习 + 15 分钟新内容 + 10 分钟小测/实战
//  6. 间隔重复与主动回忆    -> SRS 闪卡每天优先，小测用选择题做提取练习
//  7. 文字渐进             -> Fidel 分 5 批，每周只学 6 个左右基础辅音

const DAILY_TEMPLATE = {
  reviewMinutes: 8,
  learnMinutes: 15,
  practiceMinutes: 10
};

// units: 主单元（计入周完成度）；extra: 自选补充单元（第 5、6 天出现，不计入完成度）
const weeks = [
  {
    week: 1,
    theme: '打招呼 + 数字 1–10',
    goal: '第 7 天能和门卫、司机、同事完整问候一个来回，能说 1–10 和自己的电话号码。',
    why: '问候是埃塞职场的入场券：不回问候会被当作冷淡。数字每天要用。第一周先拿到"能开口"的成就感。',
    units: ['u01', 'u02'],
    extra: null,
    fidelGroup: 1,
    mission: '明天上班路上，向门卫、司机、一位本地同事各用 ሰላም + እንደምን አደርክ/አደርሽ 问候，并回答 ደህና ነኝ。',
    milestone: '问候一个来回 + 报出自己的电话号码'
  },
  {
    week: 2,
    theme: '安排工作 + 时间',
    goal: '能给司机、后勤安排一件明天的事：几点、在哪、做什么。',
    why: '这是你每天都要做的事。埃塞用 12 小时制（当地"2 点"= 早上 8 点），约错时间是最常见的失误。',
    units: ['u10', 'u06'],
    extra: 'u13',
    fidelGroup: 2,
    mission: '用阿姆哈拉语给司机安排一次明天的行程：时间（用埃塞时间并确认）+ 地点。',
    milestone: '完整安排一件事并被正确执行'
  },
  {
    week: 3,
    theme: '电话沟通 + 交通方位',
    goal: '接打电话不慌：能说我在哪、几点到、听不清请再说一遍；能指路。',
    why: '电话没有手势表情，是最难的场景；本周先把"撑住一通电话"的十句练到反射。',
    units: ['u15', 'u05'],
    extra: 'u03',
    fidelGroup: 3,
    mission: '给一位本地同事打一个阿姆哈拉语电话：说明你在哪、几点到，并听懂对方的回答。',
    milestone: '独立完成一通 1 分钟的电话'
  },
  {
    week: 4,
    theme: '现场与班组 + 第一次复盘',
    goal: '在站点、机房向班组布置任务、确认完成、提醒安全。本周只加一个单元，复习占 60%。',
    why: '前三周约 120 个词，遗忘曲线开始起作用；同时现场用语是交付工作的核心，要练扎实。周末让 AI 诊断一次。',
    units: ['u14'],
    extra: 'u07',
    fidelGroup: 3,
    reviewWeek: true,
    mission: '在现场用阿姆哈拉语向班组布置一件事（装什么、几个人、今天完成），并用 ጨርሰሃል? 确认。周末在"AI 教练"做诊断。',
    milestone: '前 4 周复习正确率 ≥ 75%，现场布置一次任务'
  },
  {
    week: 5,
    theme: '句子骨架：代词、有 / 在、疑问词、形容词',
    goal: '能自己造句提问，而不只是背固定句。',
    why: '成人擅长归纳：8 个代词 + አለ/ነው + 7 个疑问词，能把前 4 周的词重组成上百个工作句子。',
    units: ['u08', 'u09'],
    extra: 'u04',
    fidelGroup: 4,
    mission: '每天用当天学的疑问词向同事问一个真实的工作问题（如 እቃው የት ነው? 货在哪？）并听懂回答。',
    milestone: '现场造出 10 个没背过的句子'
  },
  {
    week: 6,
    theme: '动词 + 正式场合与敬语',
    goal: '能表达意图（我要、我能、我明天来），能用敬语接待客户和官员。',
    why: '动词让你从"指着说词"升级到"说想做什么"；敬语决定客户和政府是否把你当可靠的合作方。',
    units: ['u11', 'u16'],
    extra: null,
    fidelGroup: 4,
    mission: '用敬语接待一位客户或合作方：欢迎、请坐、谈项目、感谢合作。',
    milestone: '一次完整的敬语接待 + 3 个动词句'
  },
  {
    week: 7,
    theme: '健康紧急 + 综合工作对话',
    goal: '生病、出事、停电停水时能求助；把前 6 周的工作对话串起来练。',
    why: '紧急场景没有时间查词典，要练到条件反射。第 3、4 天用综合小测把工作对话全部过一遍。',
    units: ['u12'],
    extra: null,
    fidelGroup: 5,
    mission: '向后勤或房东用阿姆哈拉语报告一个问题（停电、坏了、没网），并跟进到解决。',
    milestone: '紧急 20 句脱口而出，一个问题从报告到解决全程用阿姆哈拉语'
  },
  {
    week: 8,
    theme: '综合复习 + 5 个工作实战',
    goal: '不加新词，完成 5 个真实工作任务，做 AI 结业诊断并生成下一阶段计划。',
    why: '成人学习最怕"学完就忘、学完不用"。最后一周只做提取练习和实战，检验并巩固。',
    units: [],
    extra: null,
    fidelGroup: 5,
    reviewWeek: true,
    mission: '5 个实战：给司机安排行程 / 电话约时间 / 现场布置任务 / 敬语接待 / 报告并解决一个问题。全部完成后做 AI 结业诊断。',
    milestone: '全部词汇复习正确率 ≥ 85%，5 个实战任务完成'
  }
];

const WEEK8_MISSIONS = ['给司机安排行程', '电话约时间', '现场布置任务', '敬语接待客户', '报告并解决一个问题'];

function extraTask(w) {
  if (!w.extra) return null;
  return { type: 'learn', title: `自选：${w.extra}`, desc: '生活场景补充单元，时间充裕再学', minutes: 10, unit: w.extra, optional: true };
}

/**
 * 生成某周第 day 天（1–7）的任务列表。
 * 节奏：第 1–2 天学单元 A，第 3–4 天学单元 B，第 5 天对话与小测，第 6 天实战任务，第 7 天复盘。
 * 自选单元（extra）在第 5、6 天以可选任务出现。
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
      tasks.push({ type: 'mission', title: `实战任务 ${day}/5：${WEEK8_MISSIONS[day - 1]}`, desc: '完成后在"今日"页打钩', minutes: 10, missionKey: `w8m${day}` });
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
        tasks.push({ type: 'quiz', title: '综合小测', desc: '10 题混合前几周内容', minutes: 5, unit: 'all' });
      }
      tasks.push({ type: 'quiz', title: `单元小测：${ua}`, desc: '10 道选择题，做提取练习', minutes: DAILY_TEMPLATE.practiceMinutes, unit: ua });
      break;
    case 5:
      tasks.push({ type: 'dialog', title: '对话跟读', desc: '本周单元的对话，读到不看转写，再用跟读页评分', minutes: 10, unit: ub || ua });
      tasks.push({ type: 'quiz', title: `单元小测：${ub || ua}`, desc: '10 道选择题', minutes: 5, unit: ub || ua });
      if (extraTask(w)) tasks.push(extraTask(w));
      break;
    case 6:
      tasks.push({ type: 'mission', title: '本周实战任务', desc: w.mission, minutes: 10, missionKey: `w${week}` });
      if (extraTask(w)) tasks.push(extraTask(w));
      break;
    default:
      tasks.push({ type: 'quiz', title: '本周综合小测', desc: '混合本周单元', minutes: 5, unit: 'week' });
      tasks.push({ type: 'reflect', title: '一周复盘', desc: w.reviewWeek ? '让 AI 教练做一次学习诊断，并按建议调整计划' : '写下这周在工作里说出口的 3 句话，想想下周想在哪个场景用', minutes: 5 });
  }
  return tasks;
}

/** 给 AI 的计划大纲（精简版） */
function planOutline() {
  return {
    totalWeeks: weeks.length,
    dailyMinutes: DAILY_TEMPLATE.reviewMinutes + DAILY_TEMPLATE.learnMinutes + DAILY_TEMPLATE.practiceMinutes,
    goal: '工作沟通优先（IT/通信/设备交付：司机后勤、一线班组、办公室同事、客户与政府），生活场景为自选补充',
    weeks: weeks.map((w) => ({ week: w.week, theme: w.theme, units: w.units, extra: w.extra, mission: w.mission, milestone: w.milestone, reviewWeek: !!w.reviewWeek }))
  };
}

const principles = [
  { title: '先知道为什么学', desc: '每个单元都写明真实场景和收益，学的每句话都能立刻用上。' },
  { title: '你说了算', desc: '每日时长、学习顺序都可调；AI 只给建议和理由，最终由你决定。' },
  { title: '挂到已有经验上', desc: '数字、时间、货币都和你已经熟悉的概念对照（如埃塞时间 = 国际时间 − 6）。' },
  { title: '问题驱动、即学即用', desc: '每周一个真实工作任务：安排行程、打电话、现场布置、敬语接待……说出口才算学会。' },
  { title: '每天 30 分钟左右', desc: '8 分钟复习 + 15 分钟新内容 + 10 分钟小测或实战。连续比时长更重要。' },
  { title: '间隔重复 + 主动回忆', desc: '闪卡按遗忘曲线安排，小测用选择题做提取练习，遗忘的词会更频繁出现。' },
  { title: '文字渐进', desc: 'Fidel 字母分 5 批，每周约 6 个辅音，和当周词汇绑定学。' },
  { title: '定期诊断、动态调整', desc: '第 4 周和第 8 周让 AI 根据数据诊断进度并修改计划。' }
];

module.exports = { weeks, getDayTasks, planOutline, principles, DAILY_TEMPLATE };
