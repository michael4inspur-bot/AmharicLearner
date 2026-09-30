// 阿姆哈拉语 Fidel（ፊደል）音节文字：每个基础辅音有 7 个"序"（元音变体）。
// Unicode 埃塞俄比亚文区块中每个辅音占 8 个码位，前 7 个即 7 序，因此用基础字 + 偏移即可生成。
// 序：1 ä  2 u  3 i  4 a  5 é  6 ə  7 o
//
// 转写方案与词库（langs/am/vocab.js）保持一致，三处与学术转写不同，都是迁就词库里的实际写法：
//   1 序写 -e；但喉音（ሀ ሐ ኀ አ ዐ）的 1 序实际读 [a]，写 -a（አዎ awo、ሐሙስ hamus）。
//   6 序写 -i，不写 ə（ብር birr、ችግር chigir）。词尾和辅音丛里这个元音常常不发音，
//     词库里就直接省掉（ደህና dehna），逐字表里仍标 -i。
//   喉塞音（ጠ ጨ ጸ ፀ ጰ）不加撇号，写 t / ch / ts / p，与 ተ ቸ ሰ ፐ 同形。
//     代价是由转写反推 Fidel 不唯一，但词库全部如此，两边必须一致。
const ORDERS = ['e', 'u', 'i', 'a', 'é', 'i', 'o'];
const ORDER_LABELS = ['1序 -e', '2序 -u', '3序 -i', '4序 -a', '5序 -é', '6序 -i', '7序 -o'];

// 喉音：1 序读 [a] 而不是 [ä]
const LARYNGEALS = ['h', "'"];

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
  { base: 'ሀ', c: 'h', name: 'ha', group: 2, example: 'ሁለት hulet 二' },
  { base: 'ገ', c: 'g', name: 'ge', group: 3, example: 'ገበያ gebeya 市场' },
  { base: 'ቀ', c: 'q', name: 'qe', group: 3, example: 'ቀኝ qegn 右' },
  { base: 'የ', c: 'y', name: 'ye', group: 3, example: 'የለም yelem 没有' },
  { base: 'ሸ', c: 'sh', name: 'she', group: 3, example: 'ሺህ shih 一千' },
  { base: 'ቸ', c: 'ch', name: 'che', group: 3, example: 'ችግር chigir 问题' },
  { base: 'ፈ', c: 'f', name: 'fe', group: 3, example: 'ፋርማሲ farmasi' },
  { base: 'ዘ', c: 'z', name: 'ze', group: 4, example: 'ዘጠኝ zetegn 九' },
  { base: 'ጀ', c: 'j', name: 'je', group: 4, example: 'እንጀራ injera' },
  { base: 'ኘ', c: 'gn', name: 'gne', group: 4, example: 'አማርኛ Amarigna' },
  { base: 'ጠ', c: 't', name: 'te', group: 4, example: 'ጠዋት tewat 早上' },
  { base: 'ጨ', c: 'ch', name: 'che', group: 4, example: 'ጨው chew 盐' },
  { base: 'ጸ', c: 'ts', name: 'tse', group: 4, example: 'ጸሐይ tsehay 太阳' },
  { base: 'ፐ', c: 'p', name: 'pe', group: 5, example: 'ፖሊስ polis 警察' },
  { base: 'ጰ', c: 'p', name: 'pe', group: 5, example: 'ጳጳስ papas 主教' },
  { base: 'ቨ', c: 'v', name: 've', group: 5, example: '外来词' },
  { base: 'ዠ', c: 'zh', name: 'zhe', group: 5, example: 'ዠ 少见' },
  { base: 'ሐ', c: 'h', name: 'ḥa', group: 5, example: 'ሐሙስ hamus 周四（与 ሀ 同音）' },
  { base: 'ኀ', c: 'h', name: 'ḫa', group: 5, example: '与 ሀ 同音，少见' },
  { base: 'ሠ', c: 's', name: 'śe', group: 5, example: '与 ሰ 同音，见于旧拼写' },
  { base: 'ዐ', c: "'", name: 'ʿa', group: 5, example: 'ዓመት amet 年（与 አ 同音）' },
  { base: 'ፀ', c: 'ts', name: 'tse', group: 5, example: 'ፀሐይ 太阳的另一种拼写' }
];

function formsOf(base) {
  const code = base.charCodeAt(0);
  const forms = [];
  for (let i = 0; i < 7; i++) forms.push(String.fromCharCode(code + i));
  return forms;
}

function romanOf(consonant, orderIdx) {
  // 喉音的 1 序读 [a]：አዎ awo、ሐሙስ hamus、ዓመት amet
  const first = LARYNGEALS.indexOf(consonant) >= 0 ? 'a' : 'e';
  const v = [first, 'u', 'i', 'a', 'é', 'i', 'o'][orderIdx];
  if (consonant === "'") return v; // 元音载体本身不发辅音
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

module.exports = { name: 'Fidel 字母表', page: '/pages/fidel/fidel', ORDERS, ORDER_LABELS, consonants, buildTable, groupsUpTo, formsOf };
