// 阿姆哈拉语 Fidel（ፊደል）音节文字：每个基础辅音有 7 个"序"（元音变体）。
// Unicode 埃塞俄比亚文区块中每个辅音占 8 个码位，前 7 个即 7 序，因此用基础字 + 偏移即可生成。
// 序：1 ä(e)  2 u  3 i  4 a  5 é  6 ə(i/无元音)  7 o

const ORDERS = ['e', 'u', 'i', 'a', 'é', 'i/ə', 'o'];
const ORDER_LABELS = ['1序 -e', '2序 -u', '3序 -i', '4序 -a', '5序 -é', '6序 -ə', '7序 -o'];

// 按学习顺序排列：先教出现频率最高、最容易和已学词汇挂钩的字母。
// group: 分批学习的批次（对应计划中的周）
const consonants = [
  { base: 'ሰ', c: 's', name: 'se', group: 1, example: 'ሰላም selam' },
  { base: 'ለ', c: 'l', name: 'le', group: 1, example: 'ሰላም selam' },
  { base: 'መ', c: 'm', name: 'me', group: 1, example: 'መቶ meto 一百' },
  { base: 'ነ', c: 'n', name: 'ne', group: 1, example: 'ነው new 是' },
  { base: 'በ', c: 'b', name: 'be', group: 1, example: 'ብር birr' },
  { base: 'አ', c: "'", name: 'a', group: 1, example: 'አዎ awo 是' },
  { base: 'ተ', c: 't', name: 'te', group: 2, example: 'ታክሲ taksi' },
  { base: 'ደ', c: 'd', name: 'de', group: 2, example: 'ደህና dehna' },
  { base: 'ረ', c: 'r', name: 're', group: 2, example: 'ሩዝ ruz 米' },
  { base: 'ከ', c: 'k', name: 'ke', group: 2, example: 'ኪሎ kilo' },
  { base: 'ወ', c: 'w', name: 'we', group: 2, example: 'ውሃ wiha 水' },
  { base: 'ሀ', c: 'h', name: 'he', group: 2, example: 'ሁለት hulet 二' },
  { base: 'ገ', c: 'g', name: 'ge', group: 3, example: 'ገበያ gebeya 市场' },
  { base: 'ቀ', c: 'q', name: 'qe', group: 3, example: 'ቀኝ qegn 右' },
  { base: 'የ', c: 'y', name: 'ye', group: 3, example: 'የለም yelem 没有' },
  { base: 'ሸ', c: 'sh', name: 'she', group: 3, example: 'ሺህ shih 一千' },
  { base: 'ቸ', c: 'ch', name: 'che', group: 3, example: 'ችግር chigir 问题' },
  { base: 'ፈ', c: 'f', name: 'fe', group: 3, example: 'ፋርማሲ farmasi' },
  { base: 'ዘ', c: 'z', name: 'ze', group: 4, example: 'ዘጠኝ zetegn 九' },
  { base: 'ጀ', c: 'j', name: 'je', group: 4, example: 'እንጀራ injera' },
  { base: 'ኘ', c: 'ny', name: 'nye', group: 4, example: 'አማርኛ Amarigna' },
  { base: 'ጠ', c: "t'", name: "t'e", group: 4, example: 'ጠዋት tewat 早上' },
  { base: 'ጨ', c: "ch'", name: "ch'e", group: 4, example: 'ጨው chew 盐' },
  { base: 'ጸ', c: "ts'", name: "ts'e", group: 4, example: 'ጸሐይ tsehay 太阳' },
  { base: 'ፐ', c: 'p', name: 'pe', group: 5, example: 'ፖሊስ polis 警察' },
  { base: 'ጰ', c: "p'", name: "p'e", group: 5, example: 'ጳጳስ papas 主教' },
  { base: 'ቨ', c: 'v', name: 've', group: 5, example: '外来词' },
  { base: 'ዠ', c: 'zh', name: 'zhe', group: 5, example: 'ዠ 少见' },
  { base: 'ሐ', c: 'h', name: 'ḥe', group: 5, example: 'ሐሙስ hamus 周四（与 ሀ 同音）' },
  { base: 'ኀ', c: 'h', name: 'ḫe', group: 5, example: '与 ሀ 同音，少见' },
  { base: 'ሠ', c: 's', name: 'śe', group: 5, example: '与 ሰ 同音，见于旧拼写' },
  { base: 'ዐ', c: "'", name: 'ʿa', group: 5, example: 'ዓመት amet 年（与 አ 同音）' },
  { base: 'ፀ', c: "ts'", name: "ts'e", group: 5, example: 'ፀሐይ 太阳的另一种拼写' }
];

function formsOf(base) {
  const code = base.charCodeAt(0);
  const forms = [];
  for (let i = 0; i < 7; i++) forms.push(String.fromCharCode(code + i));
  return forms;
}

function romanOf(consonant, orderIdx) {
  const v = ['e', 'u', 'i', 'a', 'é', 'ə', 'o'][orderIdx];
  if (consonant === "'") return v === 'ə' ? 'ə' : v; // 元音载体
  return consonant + v;
}

function buildTable() {
  return consonants.map((c) => ({
    ...c,
    forms: formsOf(c.base).map((ch, i) => ({ ch, rom: romanOf(c.c, i), order: i + 1 }))
  }));
}

function groupsUpTo(g) {
  return buildTable().filter((c) => c.group <= g);
}

module.exports = { ORDERS, ORDER_LABELS, consonants, buildTable, groupsUpTo, formsOf };
