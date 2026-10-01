// 8 周奥罗莫语学习计划：结构与阿姆哈拉语计划相同（同一周、同一场景、同样的字母批次节奏），以工作沟通为主线。
// 设计依据（成人学习特性）同阿姆哈拉语计划：知道为什么学、自我导向、挂到已有经验、问题驱动即学即用、
// 时间碎片化（每天约 33 分钟）、间隔重复与主动回忆、拼写渐进（Qubee 规则分 5 批）。
// 实战任务里的示范句都取自奥罗莫语词库，内容为初稿，需母语者校对。

// units: 主单元（计入周完成度）；extra: 自选补充单元（第 5、6 天出现，不计入完成度）
const weeks = [
  {
    week: 1,
    theme: '打招呼 + 数字 1–10',
    goal: '第 7 天能和门卫、司机、同事完整问候一个来回，能说 1–10 和自己的电话号码。',
    why: '奥罗莫人见面要连着问候好几句，不回问候会被当作冷淡；用对方的母语问一句 Akkam?，最能拉近距离。数字每天要用。第一周先拿到"能开口"的成就感。',
    units: ['om-u01', 'om-u02'],
    extra: null,
    alphabetGroup: 1,
    mission: '明天上班路上，向门卫、司机、一位本地同事各用 Akkam? + Akkam bulte? 问候，并回答 Nagaa dha，再回问一句 Ati hoo?（你呢？）。',
    milestone: '问候一个来回 + 报出自己的电话号码'
  },
  {
    week: 2,
    theme: '安排工作 + 时间',
    goal: '能给司机、后勤安排一件明天的事：几点、在哪、做什么。',
    why: '这是你每天都要做的事。奥罗莫语同样按埃塞时间说钟点（当地 sa\'aatii lama = 早上 8 点），约错时间是最常见的失误。',
    units: ['om-u10', 'om-u06'],
    extra: 'om-u13',
    alphabetGroup: 2,
    mission: '用奥罗莫语给司机安排一次明天的行程：时间（如 Boru ganama sa\'aatii lama，明早埃塞时间 2 点 = 国际 8 点，再用 Sa\'aatii Itoophiyaatiin? 确认）+ 地点（如 gara waajjiraa，去办公室）。',
    milestone: '完整安排一件事并被正确执行'
  },
  {
    week: 3,
    theme: '电话沟通 + 交通方位',
    goal: '接打电话不慌：能说我在哪、几点到、听不清请再说一遍；能指路。',
    why: '电话没有手势表情，是最难的场景；本周先把 Haloo、Karaa irran jira、Irra deebi\'i 这些"撑住一通电话"的句子练到反射。',
    units: ['om-u15', 'om-u05'],
    extra: 'om-u03',
    alphabetGroup: 3,
    mission: '给一位本地同事打一个奥罗莫语电话：用 Karaa irran jira（我在路上）说明你在哪，用 Daqiiqaa kudhan keessatti（十分钟内）说几点到，听不清就说 Irra deebi\'i。',
    milestone: '独立完成一通 1 分钟的电话'
  },
  {
    week: 4,
    theme: '现场与班组 + 第一次复盘',
    goal: '在站点、机房向班组布置任务、确认完成、提醒安全。本周只加一个单元，复习占 60%。',
    why: '前三周已学了一百多个词，遗忘曲线开始起作用；同时现场用语是交付工作的核心，要练扎实。周末回顾一次错得最多的词。',
    units: ['om-u14'],
    extra: 'om-u07',
    alphabetGroup: 3,
    reviewWeek: true,
    mission: '在现场用奥罗莫语向班组布置一件事（装什么、几个人、今天完成，如 Har\'a keebilii ni diriirsina），提醒 Of eeggadhaa!，再用 Xumurteettaa? 向班组长确认。周末回顾本周说出口的句子。',
    milestone: '前 4 周复习正确率 ≥ 75%，现场布置一次任务'
  },
  {
    week: 5,
    theme: '句子骨架：代词、有 / 在、疑问词、形容词',
    goal: '能自己造句提问，而不只是背固定句。',
    why: '成人擅长归纳：7 个代词 + jira / dha + 7 个疑问词，能把前 4 周的词重组成上百个工作句子。',
    units: ['om-u08', 'om-u09'],
    extra: 'om-u04',
    alphabetGroup: 4,
    mission: '每天用当天学的疑问词向同事问一个真实的工作问题（如 Meeshaan eessa jira? 货在哪？）并听懂回答。',
    milestone: '现场造出 10 个没背过的句子'
  },
  {
    week: 6,
    theme: '动词 + 正式场合与敬称',
    goal: '能表达意图（我要、我能、我明天来），能用敬称接待客户和官员。',
    why: '动词让你从"指着说词"升级到"说想做什么"；敬称（isin 系列，命令式以 -aa 结尾）决定客户和政府是否把你当可靠的合作方。',
    units: ['om-u11', 'om-u16'],
    extra: null,
    alphabetGroup: 4,
    mission: '用敬称接待一位客户或合作方：欢迎（Baga nagaan dhuftan）、请坐（Taa\'aa）、谈项目（Pirojektii kana ilaalchisee haa mari\'annu）、感谢合作（Tumsa keessaniif isin galateeffanna）。',
    milestone: '一次完整的敬称接待 + 3 个动词句'
  },
  {
    week: 7,
    theme: '健康紧急 + 综合工作对话',
    goal: '生病、出事、停电停水时能求助；把前 6 周的工作对话串起来练。',
    why: '紧急场景没有时间查词典，要练到条件反射。第 3、4 天用综合小测把工作对话全部过一遍。',
    units: ['om-u12'],
    extra: null,
    alphabetGroup: 5,
    mission: '向后勤或房东用奥罗莫语报告一个问题（Ibsaan hin jiru 停电、Hin hojjetu 坏了、Neetworkiin hin jiru 没网），并跟进到解决。',
    milestone: '紧急 20 句脱口而出，一个问题从报告到解决全程用奥罗莫语'
  },
  {
    week: 8,
    theme: '综合复习 + 5 个工作实战',
    goal: '不加新词，完成 5 个真实工作任务，并为下一阶段挑出还没掌握的场景。',
    why: '成人学习最怕"学完就忘、学完不用"。最后一周只做提取练习和实战，检验并巩固。',
    units: [],
    extra: null,
    alphabetGroup: 5,
    reviewWeek: true,
    mission: '5 个实战：给司机安排行程 / 电话约时间 / 现场布置任务 / 敬称接待 / 报告并解决一个问题。全部完成后回顾哪些场景还开不了口。',
    milestone: '全部词汇复习正确率 ≥ 85%，5 个实战任务完成'
  }
];

const WEEK8_MISSIONS = ['给司机安排行程', '电话约时间', '现场布置任务', '敬语接待客户', '报告并解决一个问题'];

const principles = [
  { title: '先知道为什么学', desc: '每个单元都写明真实场景和收益，学的每句话都能立刻用上。' },
  { title: '你说了算', desc: '每日时长、学习顺序、新词上限都可调，节奏由你自己定。' },
  { title: '挂到已有经验上', desc: '数字、时间、货币都和你已经熟悉的概念对照（如埃塞时间 = 国际时间 − 6）。' },
  { title: '问题驱动、即学即用', desc: '每周一个真实工作任务：安排行程、打电话、现场布置、敬称接待……说出口才算学会。' },
  { title: '每天 30 分钟左右', desc: '8 分钟复习 + 15 分钟新内容 + 10 分钟小测或实战。连续比时长更重要。' },
  { title: '间隔重复 + 主动回忆', desc: '闪卡按遗忘曲线安排，小测用选择题做提取练习，遗忘的词会更频繁出现。' },
  { title: '拼写渐进', desc: 'Qubee 用拉丁字母，难点在长短元音、双写辅音、喉塞音和 ch/dh/ny/ph/sh/c/q/x，分 5 批和当周词汇绑定学。' },
  { title: '定期复盘、动态调整', desc: '第 4 周和第 8 周专门用来复盘，按自己的实际情况调整节奏。' }
];

const { createPlan } = require('../plan-engine.js');

module.exports = createPlan({
  weeks,
  week8Missions: WEEK8_MISSIONS,
  principles,
  alphabet: { name: 'Qubee 字母', groupDesc: '读本批拼写规则与例词，做 10 题小测', finalDesc: '全部拼写规则综合自测' },
  // 没有转写、暂无跟读评分：对话读到不看中文
  dialog: { desc: '本周单元的对话，读到不看中文', secondDesc: '第二个单元的对话，同样读到不看中文' }
});
