// Qubee（奥罗莫语拉丁字母）拼写与发音规则，分 5 批，和 8 周计划的 alphabetGroup 对应。
// Qubee 一字一音、按读音拼写；中文使用者的难点是：长短元音、双写辅音（重读）、双字母、挤喉音 c q x 与喉塞音 '。
// 例词尽量取自奥罗莫语词库（zh 与词库一致）；词库外的词：hara（湖）、baddaa（高地）。内容为初稿，需母语者校对。

const groups = [
  {
    group: 1,
    title: '元音与长短',
    intro: '5 个元音读音固定，不像英语那样变音。长元音写两个字母、读长一倍，长短不同就是不同的词。',
    rules: [
      {
        pattern: 'a e i o u',
        zh: '短元音：a 读「啊」，e 读「诶」，i 读「衣」，o 读「哦」，u 读「乌」，短促清楚',
        examples: [
          { text: 'Lama', zh: '二' },
          { text: 'Sagal', zh: '九' },
          { text: 'Boru', zh: '明天' },
          { text: 'Miti', zh: '不是' }
        ]
      },
      {
        pattern: 'aa ee ii oo uu',
        zh: '长元音：同一个元音写两次，音质不变，只是拖长一倍（约两拍）',
        examples: [
          { text: 'Maaloo', zh: '请' },
          { text: 'Muuzii', zh: '香蕉' },
          { text: 'Sadii', zh: '三' },
          { text: 'Gabaa', zh: '市场' }
        ]
      },
      {
        pattern: 'hara / haaraa',
        zh: '长短区分词义：少读或多读一拍，意思就变了',
        examples: [
          { text: 'Hara', zh: '湖' },
          { text: 'Haaraa', zh: '新' }
        ]
      },
      {
        pattern: '词尾元音',
        zh: '词尾的元音也要读出来：短元音轻读，长元音读满，不能吞掉',
        examples: [
          { text: 'Buna', zh: '咖啡' },
          { text: 'Galgala', zh: '晚上' },
          { text: 'Kuduraa', zh: '蔬菜' }
        ]
      }
    ]
  },
  {
    group: 2,
    title: '辅音双写（重读）',
    intro: '同一个辅音写两次表示重读：发音时停顿一下、把辅音拉长。单写和双写是不同的词。',
    rules: [
      {
        pattern: 'dd kk tt …',
        zh: '双写的塞音：前一个音节收住、停顿半拍，再从后一个音节爆发出来，如 Tokko 读 tok-ko',
        examples: [
          { text: 'Tokko', zh: '一' },
          { text: 'Saddeet', zh: '八' },
          { text: 'Soddoma', zh: '三十' },
          { text: 'Guddaa', zh: '大' }
        ]
      },
      {
        pattern: 'badaa / baddaa',
        zh: '单写与双写区分词义：辅音少停一拍就成了另一个词',
        examples: [
          { text: 'Badaa', zh: '坏' },
          { text: 'Baddaa', zh: '高地' }
        ]
      },
      {
        pattern: 'll mm nn rr yy',
        zh: '双写的响音：把音拖长，nn 像「嗯—n」，ll 像拉长的 l',
        examples: [
          { text: 'Aannan', zh: '牛奶' },
          { text: 'Boqonnaa', zh: '休息 / 假期' },
          { text: 'Eeyyee', zh: '是' }
        ]
      },
      {
        pattern: '双写 + 长元音',
        zh: '一个词里常同时有双写辅音和长元音，按音节逐个读：Waajjira 读 waaj-ji-ra',
        examples: [
          { text: 'Waajjira', zh: '办公室' },
          { text: 'Mallattoo', zh: '签名' },
          { text: 'Qulqulluu', zh: '干净' }
        ]
      }
    ]
  },
  {
    group: 3,
    title: '双字母 ch dh ny ph sh',
    intro: '两个字母合起来表示一个音，不要拆开读。dh 和 ph 是汉语里没有的音，要多听多练。',
    rules: [
      {
        pattern: 'ch',
        zh: '像英语 church 的 ch，近似「吃」但不卷舌',
        examples: [
          { text: 'Qoricha', zh: '药' },
          { text: 'Bitachuu', zh: '买' },
          { text: 'Chaaw', zh: '再见（口语，电话常用）' }
        ]
      },
      {
        pattern: 'dh',
        zh: '内爆的 d：舌尖顶上齿龈，喉咙往下一沉发 d，比 d 更闷更重；不是英语 the 的 th',
        examples: [
          { text: 'Dhufuu', zh: '来' },
          { text: 'Kudhan', zh: '十' },
          { text: 'Dhiifama', zh: '对不起 / 打扰一下' }
        ]
      },
      {
        pattern: 'ny',
        zh: '一个音，像西班牙语的 ñ：n 和 y 同时发，nya 近似「尼呀」快读成一个音节',
        examples: [
          { text: 'Nyaachuu', zh: '吃' },
          { text: 'Mana nyaataa', zh: '餐馆' },
          { text: 'Nyaata soomaa', zh: '斋饭 / 素食' }
        ]
      },
      {
        pattern: 'ph',
        zh: '挤喉的 p：双唇闭紧、憋住气再突然放开，声音短促「脆」；不送气，不是英语的 f',
        examples: [
          { text: 'Salphaa', zh: '容易 / 轻' },
          { text: 'Suphuu', zh: '修理' },
          { text: 'Qophaa\'eeraa?', zh: '准备好了吗？' }
        ]
      },
      {
        pattern: 'sh',
        zh: '读「诗」的 sh，舌头不用卷',
        examples: [
          { text: 'Shan', zh: '五' },
          { text: 'Shaayii', zh: '茶' },
          { text: 'Shiroo', zh: '鹰嘴豆酱（素）' }
        ]
      }
    ]
  },
  {
    group: 4,
    title: '挤喉音 c q x 与喉塞音 \'',
    intro: 'c q x 在 Qubee 里不是英语的读法，而是憋气后爆发的挤喉音；撇号 \' 叫 hudhaa，表示喉咙里短暂卡一下。',
    rules: [
      {
        pattern: 'c',
        zh: '挤喉的 ch：憋住气再爆发，声音短促「脆」、不送气；和 ch 是两个不同的音',
        examples: [
          { text: 'Cufi', zh: '关掉（电源 / 灯）（熟人）' },
          { text: 'Cuunfaa', zh: '果汁' },
          { text: 'Miicuu', zh: '洗（衣服）' }
        ]
      },
      {
        pattern: 'q',
        zh: '挤喉的 k：舌根顶住软腭、憋气后爆发，像「咔」但更紧；不读英语的 kw',
        examples: [
          { text: 'Qarshii', zh: '比尔（埃塞货币）/ 钱' },
          { text: 'Qaalii dha', zh: '太贵了' },
          { text: 'Qajeelaa deemi', zh: '直走' }
        ]
      },
      {
        pattern: 'x',
        zh: '挤喉的 t：舌尖顶上齿龈、憋气后爆发，短促有力；不读 ks',
        examples: [
          { text: 'Xiqqaa', zh: '小' },
          { text: 'Xumurameera', zh: '完成了' },
          { text: 'Xiqqoo eegi', zh: '稍等（熟人）' }
        ]
      },
      {
        pattern: '\'（hudhaa）',
        zh: '喉塞音：读到撇号时声音在喉咙里停顿一下再接着读，Har\'a 读 har-a，中间断开',
        examples: [
          { text: 'Har\'a', zh: '今天' },
          { text: 'Sa\'aatii', zh: '时间 / 小时 / 点钟' },
          { text: 'Baay\'ee', zh: '很多 / 非常' },
          { text: 'Ji\'a', zh: '月' }
        ]
      }
    ]
  },
  {
    group: 5,
    title: '其余辅音与拼读',
    intro: '其余辅音大多和汉语拼音接近。Qubee 每个字母都发音、没有不发音的字母，会拼就会读。',
    rules: [
      {
        pattern: 'b d f g k t',
        zh: '和汉语拼音的 b d f g k t 接近；g 总是读「哥」的 g。p v z 只出现在借词里',
        examples: [
          { text: 'Daabboo', zh: '面包' },
          { text: 'Foon', zh: '肉' },
          { text: 'Gaarii', zh: '好' },
          { text: 'Poolisii', zh: '警察' }
        ]
      },
      {
        pattern: 'h j',
        zh: 'h 从喉咙轻轻呼气，比汉语的 h 轻；j 读英语 jeep 的 j，不读拼音的 j',
        examples: [
          { text: 'Hojii', zh: '工作' },
          { text: 'Jaha', zh: '六' },
          { text: 'Jimaata', zh: '周五' }
        ]
      },
      {
        pattern: 'l m n r s w y',
        zh: 'r 是舌尖轻弹一下的弹舌音；s 总是清音；w、y 和英语相同',
        examples: [
          { text: 'Rooba', zh: '雨' },
          { text: 'Mirga', zh: '右' },
          { text: 'Waggaa', zh: '年' },
          { text: 'Yoom?', zh: '什么时候？' }
        ]
      },
      {
        pattern: '整词拼读',
        zh: '长词按音节拆开读，每个字母都发音：Kon-ko-laa-chi-saa',
        examples: [
          { text: 'Konkolaachisaa', zh: '司机' },
          { text: 'Dhaggeeffachuu', zh: '听' },
          { text: 'Walqabsiisuu', zh: '连接' }
        ]
      },
      {
        pattern: '句子',
        zh: '照拼写读整句；语序是「主语—宾语—动词」，动词放在句尾',
        examples: [
          { text: 'Buna nan dhuga', zh: '我喝咖啡' },
          { text: 'Gara hojii nan deema', zh: '我去上班' },
          { text: 'Afaan Oromoo xiqqoo nan beeka', zh: '我会一点奥罗莫语' }
        ]
      }
    ]
  }
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 若干批次的全部例词，同一个词只出现一次 */
function examplesOf(list) {
  const seen = new Set();
  return list.flatMap((g) => g.rules.flatMap((r) => r.examples)).filter((ex) => {
    if (seen.has(ex.text)) return false;
    seen.add(ex.text);
    return true;
  });
}

/**
 * 小测：给出例词，从 4 个中文里选意思。
 * @param {number} group 1–5；0 表示全部批次
 * @param {number} n 题数上限，实际为 min(n, 题池大小)
 * 干扰项从全部批次例词的中文里取，与答案不同且互不重复，所以单批例词少时也能凑满 4 个选项。
 */
function buildQuiz(group, n) {
  const all = examplesOf(groups);
  const pool = group === 0 ? all : examplesOf(groups.filter((g) => g.group === group));
  const zhAll = [...new Set(all.map((ex) => ex.zh))];
  return shuffle(pool).slice(0, Math.min(n, pool.length)).map((ex) => ({
    text: ex.text,
    answer: ex.zh,
    options: shuffle([ex.zh, ...shuffle(zhAll.filter((z) => z !== ex.zh)).slice(0, 3)])
  }));
}

module.exports = { name: 'Qubee 字母', page: '/pages/qubee/qubee', groups, buildQuiz };
