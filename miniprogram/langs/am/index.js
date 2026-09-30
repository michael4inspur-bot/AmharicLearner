// 阿姆哈拉语语言包：词库、8 周计划、Fidel 字母表与界面文案。
const vocab = require('./vocab.js');
const plan = require('./plan.js');
const alphabet = require('./alphabet.js');

const meta = {
  code: 'am',
  name: '阿姆哈拉语',
  native: 'አማርኛ',
  script: 'ethiopic',
  hasRom: true,
  voices: ['female', 'male'],
  scoring: true,
  beta: false,
  strings: {
    langName: '阿姆哈拉语',
    askSay: '阿姆哈拉语怎么说？',
    thinkSay: '在心里说出阿姆哈拉语',
    modeShort: '看阿',
    praise: 'ጥሩ ስራ!',
    praiseHigh: 'በጣም ጥሩ!',
    praiseMid: 'ጥሩ ነው',
    praiseLow: 'ችግር የለም',
    searchPlaceholder: '输入中文 / 转写 / 阿姆哈拉语，例如：多少钱、sint、ውሃ',
    searchHint: '长按阿姆哈拉语原文可复制，直接给对方看。',
    copyHint: '长按原文可复制',
    loginHello: 'ሰላም!',
    loginSub: '在埃塞工作的你，8 周学会用阿姆哈拉语沟通工作',
    about: '面向在埃塞俄比亚的中文使用者的阿姆哈拉语速成。'
  }
};

// 首页问候语。顺序约定（首页按下标取）：0 通用问候，1 早上好，2 下午好；全部也轮换作「每日一句」
const greetings = [
  { text: 'ሰላም', rom: 'selam', zh: '你好' },
  { text: 'እንደምን አደርክ?', rom: 'indemin aderk?', zh: '早上好（对男）' },
  { text: 'እንደምን ዋልሽ?', rom: 'indemin walsh?', zh: '下午好（对女）' },
  { text: 'ጥሩ ስራ!', rom: 'tiru sira!', zh: '干得好！' },
  { text: 'አማርኛ እማራለሁ', rom: 'Amarigna imaralehu', zh: '我在学阿姆哈拉语' }
];

// 徽章绑定的单元：电话达人 / 现场指挥 / 敬语大师
const badgeUnits = { phone: 'u15', site: 'u14', formal: 'u16' };

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
