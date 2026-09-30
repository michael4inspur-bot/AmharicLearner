// 临时版本：周结构与阿姆哈拉语相同，单元 id 换成 om- 前缀。Task 5 替换为正式的奥罗莫语计划。
const amWeeks = require('../am/plan.js').weeks;
const { createPlan } = require('../plan-engine.js');

const om = (id) => (id ? `om-${id}` : id);
const weeks = amWeeks.map((w) => ({ ...w, units: w.units.map(om), extra: om(w.extra) }));

module.exports = createPlan({
  weeks,
  week8Missions: ['给司机安排行程', '电话约时间', '现场布置任务', '敬语接待客户', '报告并解决一个问题'],
  principles: [],
  alphabet: { name: 'Qubee 字母', groupDesc: '读本批拼写规则与例词', finalDesc: '全部拼写规则自测' }
});
