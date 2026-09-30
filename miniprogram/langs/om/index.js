// 奥罗莫语（Afaan Oromoo）语言包：词库、8 周计划、Qubee 字母规则与界面文案。
// 内容为初稿，母语者校对完成前 meta.beta = true（入口显示「试用版」）；语音在 PR 3 上线前 meta.audio = false。
const vocab = require('./vocab.js');
const plan = require('./plan.js');
const alphabet = require('./alphabet.js');

const meta = {
  code: 'om',
  name: '奥罗莫语',
  native: 'Afaan Oromoo',
  script: 'latin',
  hasRom: false,
  voices: ['female'],
  scoring: false,
  beta: true,
  audio: false,
  strings: {
    langName: '奥罗莫语',
    askSay: '奥罗莫语怎么说？',
    thinkSay: '在心里说出奥罗莫语',
    modeShort: '看奥',
    praise: "Baay'ee gaarii!",
    praiseHigh: "Baay'ee gaarii!",
    praiseMid: 'Gaarii dha',
    praiseLow: 'Rakkoo hin qabu',
    searchPlaceholder: '输入中文 / 奥罗莫语，例如：多少钱、meeqa、bishaan',
    searchHint: '长按奥罗莫语原文可复制，直接给对方看。',
    copyHint: '长按原文可复制',
    loginHello: 'Akkam!',
    loginSub: '在埃塞工作的你，8 周学会用奥罗莫语沟通工作',
    about: '面向在埃塞俄比亚的中文使用者的奥罗莫语速成（试用版，内容待母语者校对）。'
  }
};

// 首页问候语。顺序约定（首页按下标取）：0 通用问候，1 早上好，2 下午好；全部也轮换作「每日一句」
const greetings = [
  { text: 'Akkam?', zh: '你好（万能问候）' },
  { text: 'Akkam bulte?', zh: '早上好（昨晚过得好吗）' },
  { text: 'Akkam oolte?', zh: '下午好（今天过得好吗）' },
  { text: "Baay'ee gaarii!", zh: '非常好！' },
  { text: 'Afaan Oromoo nan barachaa jira', zh: '我在学奥罗莫语' }
];

// 徽章绑定的单元：电话达人 / 现场指挥 / 敬语大师
const badgeUnits = { phone: 'om-u15', site: 'om-u14', formal: 'om-u16' };

module.exports = {
  meta,
  units: vocab.units,
  getUnit: vocab.getUnit,
  getItem: vocab.getItem,
  allItems: vocab.allItems,
  unitsForWeek: vocab.unitsForWeek,
  plan,
  alphabet,
  greetings,
  badgeUnits
};
