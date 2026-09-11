// 阿姆哈拉语词汇与句子：按在埃塞俄比亚生活的真实场景分单元。
// 字段：id、am（Fidel 原文）、rom（拉丁转写）、zh（中文）、note（用法/性别形式）
// 第二人称有对男（m）/对女（f）之分，note 中标注。

const units = [
  {
    id: 'u01',
    week: 1,
    title: '问候与礼貌',
    scene: '每天早上见到同事、门卫、邻居的第一句话',
    why: '埃塞人非常看重问候，哪怕只会一句 ሰላም，对方态度都会明显不同。这是回报最高的 10 个词。',
    tips: [
      '问候要"来回一次"：对方问你好，你必须回问一句，否则显得冷淡。',
      '对男性用 -ህ/-ክ 结尾，对女性用 -ሽ 结尾。不确定时先用 ሰላም，万能。',
      '握手时轻碰右肩是熟人礼节，新认识的人握手即可。'
    ],
    items: [
      { id: 'u01-01', am: 'ሰላም', rom: 'selam', zh: '你好 / 平安（万能问候）' },
      { id: 'u01-02', am: 'እንደምን አደርክ?', rom: 'indemin aderk?', zh: '早上好（对男）', note: '字面：你夜里过得怎样' },
      { id: 'u01-03', am: 'እንደምን አደርሽ?', rom: 'indemin adersh?', zh: '早上好（对女）' },
      { id: 'u01-04', am: 'እንደምን ዋልክ?', rom: 'indemin walk?', zh: '下午好（对男）', note: '对女：እንደምን ዋልሽ? (walsh)' },
      { id: 'u01-05', am: 'እንደምን አመሸህ?', rom: 'indemin amesheh?', zh: '晚上好（对男）', note: '对女：እንደምን አመሸሽ? (ameshesh)' },
      { id: 'u01-06', am: 'ደህና ነኝ', rom: 'dehna negn', zh: '我很好' },
      { id: 'u01-07', am: 'እንዴት ነህ?', rom: 'indét neh?', zh: '你好吗？（对男）', note: '对女：እንዴት ነሽ? (nesh)' },
      { id: 'u01-08', am: 'አመሰግናለሁ', rom: 'ameseginalehu', zh: '谢谢' },
      { id: 'u01-09', am: 'እባክህ', rom: 'ibakih', zh: '请（对男）', note: '对女：እባክሽ (ibakish)' },
      { id: 'u01-10', am: 'ይቅርታ', rom: 'yiqirta', zh: '对不起 / 打扰一下' },
      { id: 'u01-11', am: 'እሺ', rom: 'ishi', zh: '好的 / 行' },
      { id: 'u01-12', am: 'አዎ', rom: 'awo', zh: '是' },
      { id: 'u01-13', am: 'አይ', rom: 'ay', zh: '不' },
      { id: 'u01-14', am: 'ደህና ሁን', rom: 'dehna hun', zh: '再见（对男）', note: '对女：ደህና ሁኚ (hunyi)；对多人：ደህና ሁኑ (hunu)' },
      { id: 'u01-15', am: 'ችግር የለም', rom: 'chigir yelem', zh: '没问题 / 没关系' },
      { id: 'u01-16', am: 'ስሜ ... ነው', rom: 'simé ... new', zh: '我叫 ……' },
      { id: 'u01-17', am: 'ስምህ ማን ነው?', rom: 'simih man new?', zh: '你叫什么名字？（对男）', note: '对女：ስምሽ ማን ነው? (simish)' },
      { id: 'u01-18', am: 'ከቻይና ነኝ', rom: 'ke Chayna negn', zh: '我来自中国' },
      { id: 'u01-19', am: 'ትንሽ አማርኛ እችላለሁ', rom: 'tinish Amarigna ichilalehu', zh: '我会一点阿姆哈拉语' },
      { id: 'u01-20', am: 'አልገባኝም', rom: 'algebagnim', zh: '我没听懂', note: '听懂了：ገባኝ (gebagn)' }
    ],
    dialog: [
      { who: 'A', am: 'ሰላም! እንደምን አደርክ?', rom: 'selam! indemin aderk?', zh: '你好！早上好？' },
      { who: 'B', am: 'ደህና ነኝ፣ አመሰግናለሁ። አንተስ?', rom: 'dehna negn, ameseginalehu. antess?', zh: '我很好，谢谢。你呢？' },
      { who: 'A', am: 'ደህና ነኝ። ስምህ ማን ነው?', rom: 'dehna negn. simih man new?', zh: '我很好。你叫什么？' },
      { who: 'B', am: 'ስሜ ሊ ነው። ከቻይና ነኝ።', rom: 'simé Li new. ke Chayna negn.', zh: '我叫李。我来自中国。' },
      { who: 'A', am: 'እሺ፣ ደህና ሁን!', rom: 'ishi, dehna hun!', zh: '好，再见！' }
    ]
  },
  {
    id: 'u02',
    week: 1,
    title: '数字 1–10 与"是 / 不是"',
    scene: '报电话号码、问价、点几份、说房间号',
    why: '数字每天都要用；ነው / አይደለም 是阿姆哈拉语最核心的句型骨架，学会就能造句。',
    tips: [
      '阿姆哈拉语句子动词在最后："这是水" = ይህ ውሃ ነው（这 水 是）。',
      '数字后面直接接名词，不需要量词：ሁለት ቡና = 两杯咖啡。'
    ],
    items: [
      { id: 'u02-01', am: 'አንድ', rom: 'and', zh: '一' },
      { id: 'u02-02', am: 'ሁለት', rom: 'hulet', zh: '二' },
      { id: 'u02-03', am: 'ሶስት', rom: 'sost', zh: '三' },
      { id: 'u02-04', am: 'አራት', rom: 'arat', zh: '四' },
      { id: 'u02-05', am: 'አምስት', rom: 'amist', zh: '五' },
      { id: 'u02-06', am: 'ስድስት', rom: 'sidist', zh: '六' },
      { id: 'u02-07', am: 'ሰባት', rom: 'sebat', zh: '七' },
      { id: 'u02-08', am: 'ስምንት', rom: 'simint', zh: '八' },
      { id: 'u02-09', am: 'ዘጠኝ', rom: 'zetegn', zh: '九' },
      { id: 'u02-10', am: 'አስር', rom: 'asir', zh: '十' },
      { id: 'u02-11', am: 'ነው', rom: 'new', zh: '是（第三人称单数）', note: '放句尾' },
      { id: 'u02-12', am: 'አይደለም', rom: 'aydelem', zh: '不是' },
      { id: 'u02-13', am: 'ይህ', rom: 'yih', zh: '这个' },
      { id: 'u02-14', am: 'ያ', rom: 'ya', zh: '那个' },
      { id: 'u02-15', am: 'ምንድን ነው?', rom: 'mindin new?', zh: '是什么？', note: 'ይህ ምንድን ነው? 这是什么？' },
      { id: 'u02-16', am: 'ስንት?', rom: 'sint?', zh: '多少？' },
      { id: 'u02-17', am: 'ስልክ ቁጥር', rom: 'silk qutir', zh: '电话号码' },
      { id: 'u02-18', am: 'ዜሮ', rom: 'zéro', zh: '零' }
    ],
    dialog: [
      { who: 'A', am: 'ይህ ምንድን ነው?', rom: 'yih mindin new?', zh: '这是什么？' },
      { who: 'B', am: 'ይህ ቡና ነው።', rom: 'yih buna new.', zh: '这是咖啡。' },
      { who: 'A', am: 'ስንት ነው?', rom: 'sint new?', zh: '多少钱？' },
      { who: 'B', am: 'አስር ብር ነው።', rom: 'asir birr new.', zh: '十比尔。' }
    ]
  },
  {
    id: 'u03',
    week: 3,
    title: '市场与购物',
    scene: 'Merkato、街边水果摊、小超市',
    why: '在埃塞买东西几乎都要问价、砍价。会说"太贵了，便宜点"能立刻省钱，也是最容易获得成就感的场景。',
    tips: [
      '砍价是常态，起价通常高 30–50%。用 ውድ ነው + ቀንስ 基本都有效。',
      '外国人价（ፈረንጅ ዋጋ）很常见，用阿姆哈拉语问价会明显不一样。',
      '称重单位是公斤（ኪሎ），水果常按"个"或"堆"卖。'
    ],
    items: [
      { id: 'u03-01', am: 'ስንት ነው?', rom: 'sint new?', zh: '多少钱？' },
      { id: 'u03-02', am: 'ብር', rom: 'birr', zh: '比尔（埃塞货币）' },
      { id: 'u03-03', am: 'ውድ ነው', rom: 'wid new', zh: '太贵了' },
      { id: 'u03-04', am: 'ቀንስ', rom: 'qenis', zh: '便宜点（对男）', note: '对女：ቀንሺ (qenishi)' },
      { id: 'u03-05', am: 'ርካሽ', rom: 'rikash', zh: '便宜的' },
      { id: 'u03-06', am: 'እፈልጋለሁ', rom: 'ifeligalehu', zh: '我想要' },
      { id: 'u03-07', am: 'አልፈልግም', rom: 'alfeligim', zh: '我不要' },
      { id: 'u03-08', am: 'አለ?', rom: 'alle?', zh: '有吗？' },
      { id: 'u03-09', am: 'የለም', rom: 'yelem', zh: '没有' },
      { id: 'u03-10', am: 'ስጠኝ', rom: 'siteny', zh: '给我（对男）', note: '对女：ስጪኝ (sichign)' },
      { id: 'u03-11', am: 'ኪሎ', rom: 'kilo', zh: '公斤' },
      { id: 'u03-12', am: 'ገበያ', rom: 'gebeya', zh: '市场' },
      { id: 'u03-13', am: 'ሱቅ', rom: 'suq', zh: '商店' },
      { id: 'u03-14', am: 'ገንዘብ', rom: 'genzeb', zh: '钱' },
      { id: 'u03-15', am: 'መልስ', rom: 'melis', zh: '找零' },
      { id: 'u03-16', am: 'ውሃ', rom: 'wiha', zh: '水' },
      { id: 'u03-17', am: 'ዳቦ', rom: 'dabo', zh: '面包' },
      { id: 'u03-18', am: 'ሙዝ', rom: 'muz', zh: '香蕉' },
      { id: 'u03-19', am: 'ብርቱካን', rom: 'birtukan', zh: '橙子' },
      { id: 'u03-20', am: 'እንቁላል', rom: 'inqulal', zh: '鸡蛋' },
      { id: 'u03-21', am: 'ሩዝ', rom: 'ruz', zh: '米' },
      { id: 'u03-22', am: 'ስኳር', rom: 'sikwar', zh: '糖' },
      { id: 'u03-23', am: 'ጨው', rom: 'chew', zh: '盐' },
      { id: 'u03-24', am: 'ዘይት', rom: 'zeyit', zh: '食用油' },
      { id: 'u03-25', am: 'አትክልት', rom: 'atkilt', zh: '蔬菜' },
      { id: 'u03-26', am: 'ፍራፍሬ', rom: 'firafiré', zh: '水果' }
    ],
    dialog: [
      { who: 'A', am: 'ሙዝ አለ?', rom: 'muz alle?', zh: '有香蕉吗？' },
      { who: 'B', am: 'አዎ አለ። ስንት ኪሎ?', rom: 'awo alle. sint kilo?', zh: '有。要几公斤？' },
      { who: 'A', am: 'ሁለት ኪሎ። ስንት ነው?', rom: 'hulet kilo. sint new?', zh: '两公斤。多少钱？' },
      { who: 'B', am: 'ሰማንያ ብር።', rom: 'semanya birr.', zh: '八十比尔。' },
      { who: 'A', am: 'ውድ ነው! ቀንስ እባክህ።', rom: 'wid new! qenis ibakih.', zh: '太贵了！便宜点吧。' },
      { who: 'B', am: 'እሺ፣ ሰባ ብር።', rom: 'ishi, seba birr.', zh: '好吧，七十。' }
    ]
  },
  {
    id: 'u04',
    week: 5,
    title: '数字 11–1000 与价格',
    scene: '听懂报价、付钱、找零、看账单',
    why: '市场报价常是几十到几百比尔，只会 1–10 不够用。听懂大数字才能不被多收。',
    tips: [
      '11–19 = አስራ + 个位：አስራ አንድ (11)，አስራ ሁለት (12)。',
      '几十几 = 十位 + 个位：ሃያ አምስት (25)，መቶ ሃምሳ (150)。',
      '价格常省略 ብር，直接说数字。'
    ],
    items: [
      { id: 'u04-01', am: 'አስራ አንድ', rom: 'asra and', zh: '十一' },
      { id: 'u04-02', am: 'አስራ አምስት', rom: 'asra amist', zh: '十五' },
      { id: 'u04-03', am: 'ሃያ', rom: 'haya', zh: '二十' },
      { id: 'u04-04', am: 'ሰላሳ', rom: 'selasa', zh: '三十' },
      { id: 'u04-05', am: 'አርባ', rom: 'arba', zh: '四十' },
      { id: 'u04-06', am: 'ሃምሳ', rom: 'hamsa', zh: '五十' },
      { id: 'u04-07', am: 'ስልሳ', rom: 'silsa', zh: '六十' },
      { id: 'u04-08', am: 'ሰባ', rom: 'seba', zh: '七十' },
      { id: 'u04-09', am: 'ሰማንያ', rom: 'semanya', zh: '八十' },
      { id: 'u04-10', am: 'ዘጠና', rom: 'zetena', zh: '九十' },
      { id: 'u04-11', am: 'መቶ', rom: 'meto', zh: '一百' },
      { id: 'u04-12', am: 'ሁለት መቶ', rom: 'hulet meto', zh: '两百' },
      { id: 'u04-13', am: 'አምስት መቶ', rom: 'amist meto', zh: '五百' },
      { id: 'u04-14', am: 'ሺህ', rom: 'shih', zh: '一千' },
      { id: 'u04-15', am: 'ግማሽ', rom: 'gimash', zh: '一半', note: 'ግማሽ ኪሎ 半公斤' },
      { id: 'u04-16', am: 'ዋጋ', rom: 'waga', zh: '价格' },
      { id: 'u04-17', am: 'ሂሳብ', rom: 'hisab', zh: '账单 / 结账' },
      { id: 'u04-18', am: 'ክፍያ', rom: 'kifiya', zh: '付款' },
      { id: 'u04-19', am: 'ደረሰኝ', rom: 'derasegn', zh: '收据' },
      { id: 'u04-20', am: 'ብዙ', rom: 'bizu', zh: '很多' },
      { id: 'u04-21', am: 'ትንሽ', rom: 'tinish', zh: '一点 / 小' }
    ],
    dialog: [
      { who: 'A', am: 'ሂሳብ እባክህ።', rom: 'hisab ibakih.', zh: '请结账。' },
      { who: 'B', am: 'ሶስት መቶ ሃምሳ ብር።', rom: 'sost meto hamsa birr.', zh: '三百五十比尔。' },
      { who: 'A', am: 'እሺ። ደረሰኝ አለ?', rom: 'ishi. derasegn alle?', zh: '好。有收据吗？' },
      { who: 'B', am: 'አዎ፣ አለ።', rom: 'awo, alle.', zh: '有。' }
    ]
  },
  {
    id: 'u05',
    week: 3,
    title: '交通与方位',
    scene: '打出租车、坐蓝白小巴（minibus）、告诉司机怎么走',
    why: '亚的斯的出租车没有计价器，全靠口头谈价和指路。会说左右直走停，就能自己出门。',
    tips: [
      '小巴售票员喊的是目的地，要下车喊 ውራጅ አለ (wuraj alle)。',
      '打车先问价再上车：ወደ ቦሌ ስንት ነው?',
      '地标比路名好用：说 "ቦሌ"、"ፒያሳ"、"መገናኛ" 比说街道名有效。'
    ],
    items: [
      { id: 'u05-01', am: 'ታክሲ', rom: 'taksi', zh: '出租车' },
      { id: 'u05-02', am: 'ወዴት?', rom: 'wedét?', zh: '去哪儿？' },
      { id: 'u05-03', am: 'ወደ ... እሄዳለሁ', rom: 'wede ... ihédalehu', zh: '我要去……' },
      { id: 'u05-04', am: 'ወደ ቦሌ ስንት ነው?', rom: 'wede Bolé sint new?', zh: '去博莱多少钱？' },
      { id: 'u05-05', am: 'እዚህ', rom: 'izih', zh: '这里' },
      { id: 'u05-06', am: 'እዚያ', rom: 'iziya', zh: '那里' },
      { id: 'u05-07', am: 'ቀኝ', rom: 'qegn', zh: '右' },
      { id: 'u05-08', am: 'ግራ', rom: 'gira', zh: '左' },
      { id: 'u05-09', am: 'ቀጥታ', rom: 'qetita', zh: '直走' },
      { id: 'u05-10', am: 'ቁም', rom: 'qum', zh: '停（对男）', note: '对女：ቁሚ (qumi)' },
      { id: 'u05-11', am: 'ውራጅ አለ', rom: 'wuraj alle', zh: '有人下车（小巴用语）' },
      { id: 'u05-12', am: 'የት ነው?', rom: 'yet new?', zh: '在哪儿？' },
      { id: 'u05-13', am: 'ሩቅ ነው?', rom: 'ruq new?', zh: '远吗？' },
      { id: 'u05-14', am: 'ቅርብ ነው', rom: 'qirb new', zh: '很近' },
      { id: 'u05-15', am: 'መንገድ', rom: 'menged', zh: '路' },
      { id: 'u05-16', am: 'አየር ማረፊያ', rom: 'ayer marefiya', zh: '机场' },
      { id: 'u05-17', am: 'ሆቴል', rom: 'hotél', zh: '酒店' },
      { id: 'u05-18', am: 'ባንክ', rom: 'bank', zh: '银行' },
      { id: 'u05-19', am: 'ቢሮ', rom: 'biro', zh: '办公室' },
      { id: 'u05-20', am: 'ቤት', rom: 'bét', zh: '家 / 房子' },
      { id: 'u05-21', am: 'ምግብ ቤት', rom: 'migib bét', zh: '餐馆' },
      { id: 'u05-22', am: 'ሆስፒታል', rom: 'hospital', zh: '医院' },
      { id: 'u05-23', am: 'ቀስ ብለህ', rom: 'qes bileh', zh: '慢点（对男）', note: '对女：ቀስ ብለሽ (bilesh)' },
      { id: 'u05-24', am: 'ቶሎ', rom: 'tolo', zh: '快点' }
    ],
    dialog: [
      { who: 'A', am: 'ሰላም። ወደ ቦሌ ስንት ነው?', rom: 'selam. wede Bolé sint new?', zh: '你好。去博莱多少钱？' },
      { who: 'B', am: 'ሶስት መቶ ብር።', rom: 'sost meto birr.', zh: '三百比尔。' },
      { who: 'A', am: 'ውድ ነው። ሁለት መቶ?', rom: 'wid new. hulet meto?', zh: '太贵了。两百？' },
      { who: 'B', am: 'እሺ፣ ግባ።', rom: 'ishi, giba.', zh: '好，上车吧。' },
      { who: 'A', am: 'ቀጥታ... እዚህ ቀኝ... እሺ፣ እዚህ ቁም።', rom: 'qetita... izih qegn... ishi, izih qum.', zh: '直走……这里右转……好，这里停。' }
    ]
  },
  {
    id: 'u06',
    week: 2,
    title: '时间与日期',
    scene: '约时间、问几点、说明天见',
    why: '埃塞用自己的 12 小时制：日出算 0 点，当地"2 点"是国际时间早上 8 点。不搞清楚会约错时间。',
    tips: [
      '换算：当地时间 = 国际时间 − 6（早 6 点到晚 6 点）。当地 ሶስት ሰዓት = 上午 9 点。',
      '约时间时问一句 በሀበሻ ሰዓት ወይስ በፈረንጅ ሰዓት?（埃塞时间还是外国时间？）避免误会。',
      '埃塞历法比公历晚 7–8 年，一年 13 个月，新年在 9 月 11 日左右。'
    ],
    items: [
      { id: 'u06-01', am: 'ዛሬ', rom: 'zaré', zh: '今天' },
      { id: 'u06-02', am: 'ነገ', rom: 'nege', zh: '明天' },
      { id: 'u06-03', am: 'ትናንት', rom: 'tinant', zh: '昨天' },
      { id: 'u06-04', am: 'አሁን', rom: 'ahun', zh: '现在' },
      { id: 'u06-05', am: 'ሰዓት', rom: "se'at", zh: '时间 / 小时 / 点钟' },
      { id: 'u06-06', am: 'ስንት ሰዓት ነው?', rom: "sint se'at new?", zh: '几点了？' },
      { id: 'u06-07', am: 'ሶስት ሰዓት ነው', rom: "sost se'at new", zh: '（埃塞时间）三点了 = 国际 9 点' },
      { id: 'u06-08', am: 'ጠዋት', rom: 'tewat', zh: '早上' },
      { id: 'u06-09', am: 'ከሰዓት', rom: "kese'at", zh: '下午' },
      { id: 'u06-10', am: 'ማታ', rom: 'mata', zh: '晚上' },
      { id: 'u06-11', am: 'ቀን', rom: 'qen', zh: '天 / 白天' },
      { id: 'u06-12', am: 'ሳምንት', rom: 'samint', zh: '周' },
      { id: 'u06-13', am: 'ወር', rom: 'wer', zh: '月' },
      { id: 'u06-14', am: 'ዓመት', rom: 'amet', zh: '年' },
      { id: 'u06-15', am: 'ሰኞ', rom: 'segno', zh: '周一' },
      { id: 'u06-16', am: 'ማክሰኞ', rom: 'maksegno', zh: '周二' },
      { id: 'u06-17', am: 'ረቡዕ', rom: 'rebu', zh: '周三' },
      { id: 'u06-18', am: 'ሐሙስ', rom: 'hamus', zh: '周四' },
      { id: 'u06-19', am: 'አርብ', rom: 'arb', zh: '周五' },
      { id: 'u06-20', am: 'ቅዳሜ', rom: 'qidamé', zh: '周六' },
      { id: 'u06-21', am: 'እሁድ', rom: 'ihud', zh: '周日' },
      { id: 'u06-22', am: 'ቀጠሮ', rom: 'qetero', zh: '约定 / 预约' },
      { id: 'u06-23', am: 'ነገ እንገናኝ', rom: 'nege inigenagn', zh: '明天见' },
      { id: 'u06-24', am: 'መቼ?', rom: 'meché?', zh: '什么时候？' }
    ],
    dialog: [
      { who: 'A', am: 'ስብሰባው መቼ ነው?', rom: 'sibsebaw meché new?', zh: '会议什么时候？' },
      { who: 'B', am: 'ነገ ጠዋት ሶስት ሰዓት።', rom: "nege tewat sost se'at.", zh: '明天早上三点（埃塞时间，即 9 点）。' },
      { who: 'A', am: 'በሀበሻ ሰዓት?', rom: "be Habesha se'at?", zh: '埃塞时间？' },
      { who: 'B', am: 'አዎ። ነገ እንገናኝ።', rom: 'awo. nege inigenagn.', zh: '对。明天见。' }
    ]
  },
  {
    id: 'u07',
    week: 4,
    title: '餐馆与咖啡',
    scene: '点英吉拉、要水、说不要辣、结账',
    why: '埃塞餐馆菜单常只有阿姆哈拉语；斋日（周三、周五）很多店只有素食。会点菜就不会饿肚子。',
    tips: [
      '周三、周五及大斋期，很多店只供 ጾም（斋饭 = 素食）。想吃肉问 ስጋ አለ?',
      'በርበሬ 是辣椒粉，怕辣就说 ያለ በርበሬ。',
      '咖啡是社交，被邀请喝 ቡና 尽量别拒绝，至少喝一杯。'
    ],
    items: [
      { id: 'u07-01', am: 'ምናሌ', rom: 'minalé', zh: '菜单' },
      { id: 'u07-02', am: 'እንጀራ', rom: 'injera', zh: '英吉拉（发酵薄饼）' },
      { id: 'u07-03', am: 'ወጥ', rom: 'wet', zh: '炖菜（配英吉拉的酱）' },
      { id: 'u07-04', am: 'ዶሮ ወጥ', rom: 'doro wet', zh: '炖鸡（国菜）' },
      { id: 'u07-05', am: 'ሽሮ', rom: 'shiro', zh: '鹰嘴豆酱（素）' },
      { id: 'u07-06', am: 'ጥብስ', rom: 'tibs', zh: '炒肉' },
      { id: 'u07-07', am: 'ክትፎ', rom: 'kitfo', zh: '生牛肉末' },
      { id: 'u07-08', am: 'ስጋ', rom: 'siga', zh: '肉' },
      { id: 'u07-09', am: 'ዶሮ', rom: 'doro', zh: '鸡' },
      { id: 'u07-10', am: 'ጾም', rom: 'tsom', zh: '斋 / 素食' },
      { id: 'u07-11', am: 'ያለ ስጋ', rom: 'yale siga', zh: '不要肉' },
      { id: 'u07-12', am: 'በርበሬ', rom: 'berberé', zh: '辣椒粉' },
      { id: 'u07-13', am: 'ያለ በርበሬ', rom: 'yale berberé', zh: '不要辣' },
      { id: 'u07-14', am: 'ቡና', rom: 'buna', zh: '咖啡' },
      { id: 'u07-15', am: 'ማኪያቶ', rom: 'makiyato', zh: '玛奇朵' },
      { id: 'u07-16', am: 'ሻይ', rom: 'shay', zh: '茶' },
      { id: 'u07-17', am: 'ወተት', rom: 'wetet', zh: '牛奶' },
      { id: 'u07-18', am: 'ጭማቂ', rom: 'chimaqi', zh: '果汁' },
      { id: 'u07-19', am: 'ቢራ', rom: 'bira', zh: '啤酒' },
      { id: 'u07-20', am: 'ጣፋጭ ነው', rom: 'tafach new', zh: '很好吃 / 很甜' },
      { id: 'u07-21', am: 'ጠግቤያለሁ', rom: 'tegbiyalehu', zh: '我吃饱了' },
      { id: 'u07-22', am: 'ውሃ እባክህ', rom: 'wiha ibakih', zh: '请给我水' },
      { id: 'u07-23', am: 'ሂሳብ እባክህ', rom: 'hisab ibakih', zh: '请结账' },
      { id: 'u07-24', am: 'ሌላ', rom: 'léla', zh: '另一个 / 再来一份' }
    ],
    dialog: [
      { who: 'A', am: 'ምናሌ አለ?', rom: 'minalé alle?', zh: '有菜单吗？' },
      { who: 'B', am: 'አዎ። ምን ትፈልጋለህ?', rom: 'awo. min tifeligaleh?', zh: '有。你想要什么？' },
      { who: 'A', am: 'አንድ ጥብስ፣ ያለ በርበሬ። እና ሁለት ውሃ።', rom: 'and tibs, yale berberé. ina hulet wiha.', zh: '一份炒肉，不要辣。还有两瓶水。' },
      { who: 'B', am: 'እሺ።', rom: 'ishi.', zh: '好的。' },
      { who: 'A', am: 'ጣፋጭ ነው! ሂሳብ እባክህ።', rom: 'tafach new! hisab ibakih.', zh: '很好吃！请结账。' }
    ]
  },
  {
    id: 'u08',
    week: 5,
    title: '代词、"有"与疑问词',
    scene: '把前 4 周的词组合成句子',
    why: '前面学的都是"积木"，这一单元是"粘合剂"。掌握 8 个代词、2 个存在动词、7 个疑问词，就能自己造出大部分生存句。',
    tips: [
      'አለ 既是"有"也是"在"：ውሃ አለ? 有水吗？ አበበ አለ? 阿贝贝在吗？',
      '疑问词放在句子里动词前，不用调整语序：ስምህ ማን ነው? (你的名字 谁 是)。',
      '"我的/你的"用后缀：ስም-ኤ (我的名字)、ስም-ህ (你的名字，对男)。'
    ],
    items: [
      { id: 'u08-01', am: 'እኔ', rom: 'iné', zh: '我' },
      { id: 'u08-02', am: 'አንተ', rom: 'ante', zh: '你（对男）' },
      { id: 'u08-03', am: 'አንቺ', rom: 'anchi', zh: '你（对女）' },
      { id: 'u08-04', am: 'እሱ', rom: 'issu', zh: '他' },
      { id: 'u08-05', am: 'እሷ', rom: 'isswa', zh: '她' },
      { id: 'u08-06', am: 'እኛ', rom: 'igna', zh: '我们' },
      { id: 'u08-07', am: 'እናንተ', rom: 'inante', zh: '你们' },
      { id: 'u08-08', am: 'እነሱ', rom: 'innessu', zh: '他们' },
      { id: 'u08-09', am: 'እርስዎ', rom: 'irswo', zh: '您（敬称）' },
      { id: 'u08-10', am: 'አለ', rom: 'alle', zh: '有 / 在' },
      { id: 'u08-11', am: 'የለም', rom: 'yelem', zh: '没有 / 不在' },
      { id: 'u08-12', am: 'አለኝ', rom: 'allegn', zh: '我有' },
      { id: 'u08-13', am: 'የለኝም', rom: 'yelegnim', zh: '我没有' },
      { id: 'u08-14', am: 'ምን?', rom: 'min?', zh: '什么？' },
      { id: 'u08-15', am: 'ማን?', rom: 'man?', zh: '谁？' },
      { id: 'u08-16', am: 'የት?', rom: 'yet?', zh: '哪里？' },
      { id: 'u08-17', am: 'መቼ?', rom: 'meché?', zh: '什么时候？' },
      { id: 'u08-18', am: 'ለምን?', rom: 'lemin?', zh: '为什么？' },
      { id: 'u08-19', am: 'እንዴት?', rom: 'indét?', zh: '怎么样？' },
      { id: 'u08-20', am: 'የትኛው?', rom: 'yetignaw?', zh: '哪一个？' },
      { id: 'u08-21', am: 'የእኔ', rom: 'ye-iné', zh: '我的' },
      { id: 'u08-22', am: 'የአንተ', rom: 'ye-ante', zh: '你的（对男）' },
      { id: 'u08-23', am: 'እና', rom: 'ina', zh: '和' },
      { id: 'u08-24', am: 'ግን', rom: 'gin', zh: '但是' }
    ],
    dialog: [
      { who: 'A', am: 'አበበ አለ?', rom: 'Abebe alle?', zh: '阿贝贝在吗？' },
      { who: 'B', am: 'የለም። ለምን?', rom: 'yelem. lemin?', zh: '不在。为什么（找他）？' },
      { who: 'A', am: 'ቀጠሮ አለኝ። መቼ ይመጣል?', rom: 'qetero allegn. meché yimetal?', zh: '我有约。他什么时候来？' },
      { who: 'B', am: 'ከሰዓት።', rom: "kese'at.", zh: '下午。' }
    ]
  },
  {
    id: 'u09',
    week: 5,
    title: '常用形容词',
    scene: '评价东西好坏、大小、冷热，描述人和物',
    why: '形容词 + ነው 就是完整句子（ጥሩ ነው = 很好）。10 个形容词能表达大部分态度。',
    tips: [
      '形容词放名词前面：ትልቅ ቤት 大房子。',
      '"很"用 በጣም：በጣም ጥሩ ነው 非常好。'
    ],
    items: [
      { id: 'u09-01', am: 'ጥሩ', rom: 'tiru', zh: '好' },
      { id: 'u09-02', am: 'መጥፎ', rom: 'metfo', zh: '坏' },
      { id: 'u09-03', am: 'ትልቅ', rom: 'tiliq', zh: '大' },
      { id: 'u09-04', am: 'ትንሽ', rom: 'tinish', zh: '小' },
      { id: 'u09-05', am: 'ሙቅ', rom: 'muq', zh: '热' },
      { id: 'u09-06', am: 'ቀዝቃዛ', rom: 'qezqaza', zh: '冷' },
      { id: 'u09-07', am: 'አዲስ', rom: 'addis', zh: '新', note: 'አዲስ አበባ = 新的花' },
      { id: 'u09-08', am: 'አሮጌ', rom: 'arogé', zh: '旧' },
      { id: 'u09-09', am: 'ቆንጆ', rom: 'qonjo', zh: '漂亮' },
      { id: 'u09-10', am: 'ንጹህ', rom: 'nitsuh', zh: '干净' },
      { id: 'u09-11', am: 'ቆሻሻ', rom: 'qoshasha', zh: '脏' },
      { id: 'u09-12', am: 'ፈጣን', rom: 'fetan', zh: '快' },
      { id: 'u09-13', am: 'ቀርፋፋ', rom: 'qerfafa', zh: '慢' },
      { id: 'u09-14', am: 'ቀላል', rom: 'qelal', zh: '容易 / 轻' },
      { id: 'u09-15', am: 'ከባድ', rom: 'kebad', zh: '难 / 重' },
      { id: 'u09-16', am: 'በጣም', rom: 'betam', zh: '非常' },
      { id: 'u09-17', am: 'ደስ ይላል', rom: 'des yilal', zh: '令人愉快 / 我喜欢' },
      { id: 'u09-18', am: 'ደክሞኛል', rom: 'dekimognal', zh: '我累了' },
      { id: 'u09-19', am: 'ርቦኛል', rom: 'ribognal', zh: '我饿了' },
      { id: 'u09-20', am: 'ጠምቶኛል', rom: 'temtognal', zh: '我渴了' }
    ],
    dialog: [
      { who: 'A', am: 'አዲስ አበባ እንዴት ነው?', rom: 'Addis Abeba indét new?', zh: '亚的斯亚贝巴怎么样？' },
      { who: 'B', am: 'በጣም ጥሩ ነው፣ ግን ትንሽ ቀዝቃዛ ነው።', rom: 'betam tiru new, gin tinish qezqaza new.', zh: '非常好，但是有点冷。' },
      { who: 'A', am: 'ቡናው ደስ ይላል!', rom: 'bunaw des yilal!', zh: '咖啡很棒！' }
    ]
  },
  {
    id: 'u10',
    week: 2,
    title: '工作与办公室',
    scene: '和当地同事、司机、保安、客户打交道',
    why: '工作场合用几句阿姆哈拉语，能明显拉近和本地团队的距离，也方便安排司机、门卫等日常事务。',
    tips: [
      '正式场合对长辈或领导用 እርስዎ（您）和敬称形式。',
      '表扬要具体：ጥሩ ስራ (干得好) 比单独 ጥሩ 更有分量。',
      '埃塞同事约时间说 "ነገ" 通常真的是明天，但注意区分埃塞时间。'
    ],
    items: [
      { id: 'u10-01', am: 'ስራ', rom: 'sira', zh: '工作' },
      { id: 'u10-02', am: 'ስብሰባ', rom: 'sibseba', zh: '会议' },
      { id: 'u10-03', am: 'ኩባንያ', rom: 'kubaniya', zh: '公司' },
      { id: 'u10-04', am: 'ደንበኛ', rom: 'denbegna', zh: '客户' },
      { id: 'u10-05', am: 'ሰነድ', rom: 'sened', zh: '文件' },
      { id: 'u10-06', am: 'ፊርማ', rom: 'firma', zh: '签名' },
      { id: 'u10-07', am: 'ስልክ', rom: 'silk', zh: '电话' },
      { id: 'u10-08', am: 'ኢሜይል', rom: 'iméyil', zh: '邮件' },
      { id: 'u10-09', am: 'ኮምፒውተር', rom: 'kompiyuter', zh: '电脑' },
      { id: 'u10-10', am: 'ጥሩ ስራ', rom: 'tiru sira', zh: '干得好' },
      { id: 'u10-11', am: 'ችግር', rom: 'chigir', zh: '问题' },
      { id: 'u10-12', am: 'መፍትሄ', rom: 'mefithé', zh: '解决办法' },
      { id: 'u10-13', am: 'አለቃ', rom: 'aleqa', zh: '老板 / 上司' },
      { id: 'u10-14', am: 'ሰራተኛ', rom: 'seratenya', zh: '员工 / 工人' },
      { id: 'u10-15', am: 'ሹፌር', rom: 'shufér', zh: '司机' },
      { id: 'u10-16', am: 'ዘበኛ', rom: 'zebegna', zh: '保安 / 门卫' },
      { id: 'u10-17', am: 'ደሞዝ', rom: 'demoz', zh: '工资' },
      { id: 'u10-18', am: 'እረፍት', rom: 'irefit', zh: '休息 / 假期' },
      { id: 'u10-19', am: 'ዝግጁ ነው?', rom: 'zigiju new?', zh: '准备好了吗？' },
      { id: 'u10-20', am: 'ተጠናቋል', rom: 'tetenaqwal', zh: '完成了' },
      { id: 'u10-21', am: 'ገና ነው', rom: 'gena new', zh: '还没有' },
      { id: 'u10-22', am: 'ደውልልኝ', rom: 'dewililign', zh: '给我打电话（对男）', note: '对女：ደውይልኝ (dewiyilign)' },
      { id: 'u10-23', am: 'ና', rom: 'na', zh: '来（对男）', note: '对女：ነይ (ney)' },
      { id: 'u10-24', am: 'ጠብቅ', rom: 'tebiq', zh: '等一下（对男）', note: '对女：ጠብቂ (tebiqi)' }
    ],
    dialog: [
      { who: 'A', am: 'ሰነዱ ዝግጁ ነው?', rom: 'senedu zigiju new?', zh: '文件准备好了吗？' },
      { who: 'B', am: 'ገና ነው። ነገ ጠዋት።', rom: 'gena new. nege tewat.', zh: '还没有。明天早上。' },
      { who: 'A', am: 'እሺ። ሲጠናቀቅ ደውልልኝ።', rom: 'ishi. siteneqeq dewililign.', zh: '好。完成了给我打电话。' },
      { who: 'B', am: 'እሺ፣ ችግር የለም።', rom: 'ishi, chigir yelem.', zh: '好，没问题。' }
    ]
  },
  {
    id: 'u11',
    week: 6,
    title: '常用动词与"我要 / 我能"',
    scene: '表达意图：我去、我买、我吃、我能、我想',
    why: '动词让你从"指着东西说词"升级到"说出想做什么"。先学第一人称，够用又不用背整张变位表。',
    tips: [
      '第一人称现在/将来时以 እ- 开头、-ለሁ 结尾：እሄዳለሁ (我去)、እገዛለሁ (我买)。',
      '否定：አል- 开头、-ም 结尾：አልሄድም (我不去)。',
      '"我能 + 动词" 最实用：መሄድ እችላለሁ (我能去)。'
    ],
    items: [
      { id: 'u11-01', am: 'መሄድ', rom: 'mehéd', zh: '去', note: '我去：እሄዳለሁ (ihédalehu)' },
      { id: 'u11-02', am: 'መምጣት', rom: 'memtat', zh: '来', note: '我来：እመጣለሁ (imetalehu)' },
      { id: 'u11-03', am: 'መብላት', rom: 'meblat', zh: '吃', note: '我吃：እበላለሁ (ibelalehu)' },
      { id: 'u11-04', am: 'መጠጣት', rom: 'metetat', zh: '喝', note: '我喝：እጠጣለሁ (itetalehu)' },
      { id: 'u11-05', am: 'መግዛት', rom: 'megzat', zh: '买', note: '我买：እገዛለሁ (igezalehu)' },
      { id: 'u11-06', am: 'መስራት', rom: 'mesrat', zh: '工作 / 做', note: '我工作：እሰራለሁ (iseralehu)' },
      { id: 'u11-07', am: 'ማየት', rom: 'mayet', zh: '看', note: '我看：አያለሁ (ayalehu)' },
      { id: 'u11-08', am: 'መስማት', rom: 'mesmat', zh: '听', note: '我听：እሰማለሁ (isemalehu)' },
      { id: 'u11-09', am: 'መናገር', rom: 'menager', zh: '说', note: '我说：እናገራለሁ (inageralehu)' },
      { id: 'u11-10', am: 'መተኛት', rom: 'metegnat', zh: '睡觉', note: '我睡：እተኛለሁ (itegnalehu)' },
      { id: 'u11-11', am: 'መጠበቅ', rom: 'metebeq', zh: '等待', note: '我等：እጠብቃለሁ (itebiqalehu)' },
      { id: 'u11-12', am: 'መማር', rom: 'memar', zh: '学习', note: '我学：እማራለሁ (imaralehu)' },
      { id: 'u11-13', am: 'እችላለሁ', rom: 'ichilalehu', zh: '我能 / 我会' },
      { id: 'u11-14', am: 'አልችልም', rom: 'alchilim', zh: '我不能 / 我不会' },
      { id: 'u11-15', am: 'እፈልጋለሁ', rom: 'ifeligalehu', zh: '我想要' },
      { id: 'u11-16', am: 'አለብኝ', rom: 'allebign', zh: '我必须' },
      { id: 'u11-17', am: 'ወደ ስራ እሄዳለሁ', rom: 'wede sira ihédalehu', zh: '我去上班' },
      { id: 'u11-18', am: 'አማርኛ እማራለሁ', rom: 'Amarigna imaralehu', zh: '我在学阿姆哈拉语' },
      { id: 'u11-19', am: 'ቡና እጠጣለሁ', rom: 'buna itetalehu', zh: '我喝咖啡' },
      { id: 'u11-20', am: 'ነገ እመጣለሁ', rom: 'nege imetalehu', zh: '我明天来' }
    ],
    dialog: [
      { who: 'A', am: 'ነገ ወደ ገበያ እሄዳለሁ። ትመጣለህ?', rom: 'nege wede gebeya ihédalehu. timetaleh?', zh: '明天我去市场。你来吗？' },
      { who: 'B', am: 'አልችልም፣ መስራት አለብኝ።', rom: 'alchilim, mesrat allebign.', zh: '不行，我必须工作。' },
      { who: 'A', am: 'እሺ፣ ችግር የለም።', rom: 'ishi, chigir yelem.', zh: '好，没关系。' }
    ]
  },
  {
    id: 'u12',
    week: 7,
    title: '健康与紧急情况',
    scene: '去药店、看医生、遇到麻烦求助',
    why: '生病或出事时没有时间查词典。这 20 句要练到不用想就能说出口。',
    tips: [
      '亚的斯高海拔 2300 米，头痛、气短很常见，ራስ ምታት 会经常用到。',
      '药店 ፋርማሲ 很多，常见药不用处方。',
      '紧急电话：警察 991，救护车 907。'
    ],
    items: [
      { id: 'u12-01', am: 'እርዳታ!', rom: 'irdata!', zh: '救命 / 帮帮我！' },
      { id: 'u12-02', am: 'ሐኪም', rom: 'hakim', zh: '医生' },
      { id: 'u12-03', am: 'ፋርማሲ', rom: 'farmasi', zh: '药店' },
      { id: 'u12-04', am: 'መድሃኒት', rom: 'medhanit', zh: '药' },
      { id: 'u12-05', am: 'ታምሜያለሁ', rom: 'tamiméyalehu', zh: '我病了' },
      { id: 'u12-06', am: 'ራስ ምታት', rom: 'ras mitat', zh: '头痛' },
      { id: 'u12-07', am: 'ሆድ', rom: 'hod', zh: '肚子' },
      { id: 'u12-08', am: 'ሆዴን ያመኛል', rom: 'hodén yamegnal', zh: '我肚子疼' },
      { id: 'u12-09', am: 'ትኩሳት', rom: 'tikusat', zh: '发烧' },
      { id: 'u12-10', am: 'ሳል', rom: 'sal', zh: '咳嗽' },
      { id: 'u12-11', am: 'ተቅማጥ', rom: 'teqmat', zh: '腹泻' },
      { id: 'u12-12', am: 'አለርጂ', rom: 'alerji', zh: '过敏' },
      { id: 'u12-13', am: 'ውሃ የተቀቀለ', rom: 'wiha yeteqeqele', zh: '烧开的水' },
      { id: 'u12-14', am: 'ፖሊስ', rom: 'polis', zh: '警察' },
      { id: 'u12-15', am: 'አደጋ', rom: 'adega', zh: '事故 / 危险' },
      { id: 'u12-16', am: 'ተጠንቀቅ', rom: 'tetenqeq', zh: '小心（对男）', note: '对女：ተጠንቀቂ (tetenqeqi)' },
      { id: 'u12-17', am: 'ሌባ!', rom: 'léba!', zh: '小偷！' },
      { id: 'u12-18', am: 'ጠፋብኝ', rom: 'tefabign', zh: '我弄丢了 / 我迷路了' },
      { id: 'u12-19', am: 'ፓስፖርት', rom: 'pasport', zh: '护照' },
      { id: 'u12-20', am: 'ኤምባሲ', rom: 'émbasi', zh: '大使馆' },
      { id: 'u12-21', am: 'ደውል', rom: 'dewil', zh: '打电话（对男，命令式）', note: 'ለፖሊስ ደውል 报警' },
      { id: 'u12-22', am: 'አምቡላንስ', rom: 'ambulans', zh: '救护车' }
    ],
    dialog: [
      { who: 'A', am: 'ይቅርታ፣ ፋርማሲ የት ነው?', rom: 'yiqirta, farmasi yet new?', zh: '打扰一下，药店在哪儿？' },
      { who: 'B', am: 'እዚያ፣ ቀኝ።', rom: 'iziya, qegn.', zh: '那边，右手边。' },
      { who: 'A', am: 'ራስ ምታት አለኝ። መድሃኒት አለ?', rom: 'ras mitat allegn. medhanit alle?', zh: '我头痛。有药吗？' },
      { who: 'C', am: 'አዎ። ይህ ጥሩ ነው።', rom: 'awo. yih tiru new.', zh: '有。这个很好。' }
    ]
  },
  {
    id: 'u13',
    week: 2,
    title: '住宿与日常生活',
    scene: '和房东、保洁、水电工沟通；停水停电',
    why: '亚的斯停水停电常见，和房东、保洁沟通是每周的事。这些词让生活少很多摩擦。',
    tips: [
      '停电说 መብራት የለም，停水说 ውሃ የለም，基本是当地人的日常口头禅。',
      '请保洁或保安帮忙时加 እባክህ/እባክሽ，态度会好很多。'
    ],
    items: [
      { id: 'u13-01', am: 'መብራት', rom: 'mebrat', zh: '电 / 灯' },
      { id: 'u13-02', am: 'መብራት የለም', rom: 'mebrat yelem', zh: '停电了' },
      { id: 'u13-03', am: 'ውሃ የለም', rom: 'wiha yelem', zh: '停水了' },
      { id: 'u13-04', am: 'ኢንተርኔት', rom: 'internét', zh: '网络' },
      { id: 'u13-05', am: 'ቁልፍ', rom: 'qulf', zh: '钥匙' },
      { id: 'u13-06', am: 'በር', rom: 'ber', zh: '门' },
      { id: 'u13-07', am: 'መስኮት', rom: 'meskot', zh: '窗户' },
      { id: 'u13-08', am: 'ክፍል', rom: 'kifil', zh: '房间' },
      { id: 'u13-09', am: 'ሽንት ቤት', rom: 'shint bét', zh: '厕所' },
      { id: 'u13-10', am: 'ኩሽና', rom: 'kushina', zh: '厨房' },
      { id: 'u13-11', am: 'አልጋ', rom: 'alga', zh: '床' },
      { id: 'u13-12', am: 'ኪራይ', rom: 'kiray', zh: '房租' },
      { id: 'u13-13', am: 'ባለቤት', rom: 'balebét', zh: '房东 / 主人' },
      { id: 'u13-14', am: 'ተበላሽቷል', rom: 'tebelashtwal', zh: '坏了' },
      { id: 'u13-15', am: 'መጠገን', rom: 'metegen', zh: '修理' },
      { id: 'u13-16', am: 'ማጽዳት', rom: 'matsdat', zh: '打扫' },
      { id: 'u13-17', am: 'ልብስ', rom: 'libs', zh: '衣服' },
      { id: 'u13-18', am: 'ማጠብ', rom: 'mateb', zh: '洗' },
      { id: 'u13-19', am: 'ቆሻሻ', rom: 'qoshasha', zh: '垃圾' },
      { id: 'u13-20', am: 'ጎረቤት', rom: 'gorebét', zh: '邻居' },
      { id: 'u13-21', am: 'ዝናብ', rom: 'zinab', zh: '雨' },
      { id: 'u13-22', am: 'ፀሐይ', rom: 'tsehay', zh: '太阳' }
    ],
    dialog: [
      { who: 'A', am: 'ሰላም። መብራት የለም።', rom: 'selam. mebrat yelem.', zh: '你好。停电了。' },
      { who: 'B', am: 'አዎ፣ በአካባቢው ሁሉ የለም።', rom: 'awo, be akababiw hulu yelem.', zh: '对，整个片区都停了。' },
      { who: 'A', am: 'መቼ ይመጣል?', rom: 'meché yimetal?', zh: '什么时候来电？' },
      { who: 'B', am: 'ማታ ይመጣል።', rom: 'mata yimetal.', zh: '晚上会来。' }
    ]
  },
  {
    id: 'u14',
    week: 4,
    title: '现场与班组',
    scene: '基站、机房、布线安装、调测验收，向一线班组布置任务',
    why: 'IT/通信交付的核心场景。很多技术词直接借自英语（ኬብል、ኔትወርክ、ጀነሬተር），学起来快，而"做完了吗、有问题、小心"这些句子决定现场效率和安全。',
    tips: [
      '对班组多人说话用复数命令式：ተጠቀሙ（你们用）、ተጠንቀቁ（你们小心）。',
      '"完成了"最常听到的是 ጨርሰናል（我们做完了）和 ገና ነው（还没）。',
      '本地同事说 ኔትወርክ የለም 既指手机没信号，也指网络断了，要追问一句。'
    ],
    items: [
      { id: 'u14-01', am: 'ሳይት', rom: 'sayt', zh: '站点 / 现场（借自 site）' },
      { id: 'u14-02', am: 'ማማ', rom: 'mama', zh: '塔', note: '口语也说 ታወር (tawer)' },
      { id: 'u14-03', am: 'ኬብል', rom: 'kébil', zh: '电缆' },
      { id: 'u14-04', am: 'ፋይበር', rom: 'fayber', zh: '光纤' },
      { id: 'u14-05', am: 'አንቴና', rom: 'anténa', zh: '天线' },
      { id: 'u14-06', am: 'ጀነሬተር', rom: 'jenéréter', zh: '发电机' },
      { id: 'u14-07', am: 'ባትሪ', rom: 'batri', zh: '电池' },
      { id: 'u14-08', am: 'ኤሌክትሪክ', rom: 'éléktrik', zh: '电', note: '停电：መብራት የለም' },
      { id: 'u14-09', am: 'መሳሪያ', rom: 'mesariya', zh: '设备 / 工具' },
      { id: 'u14-10', am: 'እቃ', rom: 'iqa', zh: '物品 / 材料 / 货' },
      { id: 'u14-11', am: 'መግጠም', rom: 'megtem', zh: '安装', note: '我们装：እንገጥማለን (inigetimalen)' },
      { id: 'u14-12', am: 'መሞከር', rom: 'memoker', zh: '测试 / 试一下', note: '试一下（对男）：ሞክር (mokir)' },
      { id: 'u14-13', am: 'መፈተሽ', rom: 'mefetesh', zh: '检查', note: '检查一下（对男）：ፈትሽ (fetish)' },
      { id: 'u14-14', am: 'ማገናኘት', rom: 'magenagnet', zh: '连接' },
      { id: 'u14-15', am: 'አብራ', rom: 'abra', zh: '打开（电源 / 灯）（对男）', note: '对女：አብሪ (abri)' },
      { id: 'u14-16', am: 'አጥፋ', rom: 'atfa', zh: '关掉（电源 / 灯）（对男）', note: '对女：አጥፊ (atfi)' },
      { id: 'u14-17', am: 'ሲግናል', rom: 'signal', zh: '信号' },
      { id: 'u14-18', am: 'ኔትወርክ የለም', rom: 'network yelem', zh: '没信号 / 没网' },
      { id: 'u14-19', am: 'ሰርቨር', rom: 'server', zh: '服务器' },
      { id: 'u14-20', am: 'ደህንነት', rom: 'dehninet', zh: '安全' },
      { id: 'u14-21', am: 'የራስ ቁር', rom: 'yeras qur', zh: '安全帽', note: '口语也说 ሄልሜት (hélmét)' },
      { id: 'u14-22', am: 'አደገኛ ነው', rom: 'adegegna new', zh: '危险' },
      { id: 'u14-23', am: 'መሰላል', rom: 'meselal', zh: '梯子' },
      { id: 'u14-24', am: 'ላይ', rom: 'lay', zh: '上面', note: '下面：ታች (tach)' },
      { id: 'u14-25', am: 'ጨርሰሃል?', rom: 'chersehal?', zh: '你做完了吗？（对男）', note: '对女：ጨርሰሻል? (cherseshal)；我们做完了：ጨርሰናል' },
      { id: 'u14-26', am: 'ገና አልጨረስኩም', rom: 'gena alcheresikum', zh: '我还没做完' },
      { id: 'u14-27', am: 'ችግር አለ', rom: 'chigir alle', zh: '有问题' },
      { id: 'u14-28', am: 'ስንት ሰዎች?', rom: 'sint sewoch?', zh: '几个人？' },
      { id: 'u14-29', am: 'ዛሬ ይጠናቀቃል', rom: 'zaré yitenaqeqal', zh: '今天能完成' },
      { id: 'u14-30', am: 'ነገ እንጀምራለን', rom: 'nege inijemiralen', zh: '我们明天开始' },
      { id: 'u14-31', am: 'ትርፍ ሰዓት', rom: "tirf se'at", zh: '加班' },
      { id: 'u14-32', am: 'እቃው ደርሷል?', rom: 'iqaw dersowal?', zh: '货到了吗？' },
      { id: 'u14-33', am: 'ፈቃድ', rom: 'feqad', zh: '许可 / 准许' }
    ],
    dialog: [
      { who: 'A', am: 'ሰላም! ዛሬ ኬብሉን እንገጥማለን።', rom: 'selam! zaré kébilun inigetimalen.', zh: '大家好！今天我们装电缆。' },
      { who: 'B', am: 'እሺ። እቃው ደርሷል?', rom: 'ishi. iqaw dersowal?', zh: '好。货到了吗？' },
      { who: 'A', am: 'አዎ፣ ደርሷል። ስንት ሰዎች አሉ?', rom: 'awo, dersowal. sint sewoch allu?', zh: '到了。有几个人？' },
      { who: 'B', am: 'አራት ሰዎች።', rom: 'arat sewoch.', zh: '四个人。' },
      { who: 'A', am: 'ጥሩ። የራስ ቁር ተጠቀሙ፣ አደገኛ ነው።', rom: 'tiru. yeras qur teteqemu, adegegna new.', zh: '好。戴上安全帽，危险。' },
      { who: 'B', am: 'እሺ። ዛሬ ይጠናቀቃል።', rom: 'ishi. zaré yitenaqeqal.', zh: '好。今天能完成。' }
    ]
  },
  {
    id: 'u15',
    week: 3,
    title: '电话与沟通',
    scene: '接打电话、约时间、说明自己在哪、听不清怎么办',
    why: '电话里没有手势和表情，是最难的沟通场景，也是和司机、同事、客户每天都要用的。会说"听不清、再说一遍、我在路上"就能撑住一通电话。',
    tips: [
      '接电话说 ሃሎ，对方常问 ማን ነው?（你是谁），回答 ... ነኝ。',
      '埃塞人用 Telegram 远多于 WhatsApp，"发我"就是 በቴሌግራም ላክልኝ。',
      '听不清先说 አይሰማም，再说 እንደገና በል（对女 በይ），不要沉默。'
    ],
    items: [
      { id: 'u15-01', am: 'ሃሎ', rom: 'halo', zh: '喂（接电话）' },
      { id: 'u15-02', am: 'ማን ነው?', rom: 'man new?', zh: '是谁？' },
      { id: 'u15-03', am: '... ነኝ', rom: '... negn', zh: '我是……', note: 'ሊ ነኝ 我是李' },
      { id: 'u15-04', am: 'አይሰማም', rom: 'ayisemam', zh: '听不清 / 听不见' },
      { id: 'u15-05', am: 'እንደገና በል', rom: 'indegena bel', zh: '再说一遍（对男）', note: '对女：እንደገና በይ (bey)；敬称：እንደገና ይበሉ (yibelu)' },
      { id: 'u15-06', am: 'ቀስ ብለህ ተናገር', rom: 'qes bileh tenager', zh: '慢点说（对男）', note: '对女：ቀስ ብለሽ ተናገሪ' },
      { id: 'u15-07', am: 'ትንሽ ጠብቅ', rom: 'tinish tebiq', zh: '稍等（对男）', note: '对女：ትንሽ ጠብቂ (tebiqi)' },
      { id: 'u15-08', am: 'በኋላ እደውልልሃለሁ', rom: 'behwala idewililihalehu', zh: '我一会儿打给你（对男）', note: '对女：እደውልልሻለሁ (idewililishalehu)' },
      { id: 'u15-09', am: 'መልዕክት', rom: "mel'ikt", zh: '消息 / 短信' },
      { id: 'u15-10', am: 'ላክልኝ', rom: 'lakilign', zh: '发给我（对男）', note: '对女：ላኪልኝ (lakilign)' },
      { id: 'u15-11', am: 'ቴሌግራም', rom: 'télégram', zh: 'Telegram', note: 'በቴሌግራም ላክልኝ 用 Telegram 发我' },
      { id: 'u15-12', am: 'ቁጥርህን ስጠኝ', rom: 'qutirihin siteny', zh: '把你的号码给我（对男）', note: '对女：ቁጥርሽን ስጪኝ' },
      { id: 'u15-13', am: 'ስራ በዝቶብኛል', rom: 'sira bezitobignal', zh: '我很忙' },
      { id: 'u15-14', am: 'መንገድ ላይ ነኝ', rom: 'menged lay negn', zh: '我在路上' },
      { id: 'u15-15', am: 'ደርሻለሁ', rom: 'dershalehu', zh: '我到了' },
      { id: 'u15-16', am: 'ዘግይቻለሁ', rom: 'zegiychalehu', zh: '我迟到了 / 我晚了' },
      { id: 'u15-17', am: 'ስንት ሰዓት ትደርሳለህ?', rom: "sint se'at tidersaleh?", zh: '你几点到？（对男）', note: '对女：ትደርሻለሽ (tidershalesh)' },
      { id: 'u15-18', am: 'አሁን እመጣለሁ', rom: 'ahun imetalehu', zh: '我马上来' },
      { id: 'u15-19', am: 'ደቂቃ', rom: 'deqiqa', zh: '分钟', note: 'በአስር ደቂቃ 十分钟内' },
      { id: 'u15-20', am: 'ገባህ?', rom: 'gebah?', zh: '你明白了吗？（对男）', note: '对女：ገባሽ? (gebash)' },
      { id: 'u15-21', am: 'እሺ፣ ገባኝ', rom: 'ishi, gebagn', zh: '好，我明白了' },
      { id: 'u15-22', am: 'ቻው', rom: 'chaw', zh: '再见（口语，电话常用）' },
      { id: 'u15-23', am: 'ስልኩ አይሰራም', rom: 'silku ayseram', zh: '电话打不通 / 手机不工作' },
      { id: 'u15-24', am: 'ደግመህ ደውል', rom: 'degimeh dewil', zh: '再打一次（对男）', note: '对女：ደግመሽ ደውይ' },
      { id: 'u15-25', am: 'እጠብቅሃለሁ', rom: 'itebiqihalehu', zh: '我等你（对男）', note: '对女：እጠብቅሻለሁ (itebiqishalehu)' }
    ],
    dialog: [
      { who: 'A', am: 'ሃሎ፣ ማን ነው?', rom: 'halo, man new?', zh: '喂，是谁？' },
      { who: 'B', am: 'ሰላም፣ አበበ ነኝ። የት ነህ?', rom: 'selam, Abebe negn. yet neh?', zh: '你好，我是阿贝贝。你在哪儿？' },
      { who: 'A', am: 'መንገድ ላይ ነኝ። ዘግይቻለሁ፣ ይቅርታ።', rom: 'menged lay negn. zegiychalehu, yiqirta.', zh: '我在路上。我晚了，抱歉。' },
      { who: 'B', am: 'ችግር የለም። ስንት ሰዓት ትደርሳለህ?', rom: "chigir yelem. sint se'at tidersaleh?", zh: '没关系。你几点到？' },
      { who: 'A', am: 'በአስር ደቂቃ።', rom: 'be asir deqiqa.', zh: '十分钟内。' },
      { who: 'B', am: 'እሺ፣ እጠብቅሃለሁ። ቻው።', rom: 'ishi, itebiqihalehu. chaw.', zh: '好，我等你。再见。' }
    ]
  },
  {
    id: 'u16',
    week: 6,
    title: '正式场合与敬语',
    scene: '接待客户、拜访政府和合作方、开会谈项目',
    why: '对客户和官员用敬语（እርስዎ 系列），态度会被明显认可；用错了对男/对女的普通形式则显得随便。这一单元是"被当作可靠合作方"的关键。',
    tips: [
      '敬称动词结尾 -ሉ/-ዎት：ይቀመጡ（请坐）、ደህና ነዎት?（您好吗）。',
      '称谓：አቶ 先生、ወይዘሮ 女士、ወይዘሪት 小姐；在埃塞 "ኢንጂነር + 名字" 是常见尊称。',
      '正式场合先寒暄再谈事，直接进入正题会显得生硬。'
    ],
    items: [
      { id: 'u16-01', am: 'እንደምን ኖት?', rom: 'indemin not?', zh: '您好吗？（敬）' },
      { id: 'u16-02', am: 'ደህና ነዎት?', rom: 'dehna newot?', zh: '您好吗？（敬，另一种）' },
      { id: 'u16-03', am: 'እንኳን ደህና መጡ', rom: 'inkwan dehna metu', zh: '欢迎（您 / 你们）' },
      { id: 'u16-04', am: 'ይቀመጡ', rom: 'yiqemetu', zh: '请坐（敬）' },
      { id: 'u16-05', am: 'እናመሰግናለን', rom: 'inameseginalen', zh: '我们感谢您' },
      { id: 'u16-06', am: 'እባክዎ', rom: 'ibakwo', zh: '请（敬）' },
      { id: 'u16-07', am: 'አቶ', rom: 'ato', zh: '先生（称谓）', note: 'አቶ ተስፋዬ 特斯法耶先生' },
      { id: 'u16-08', am: 'ወይዘሮ', rom: 'weyzero', zh: '女士（已婚）', note: '小姐：ወይዘሪት (weyzerit)' },
      { id: 'u16-09', am: 'ኢንጂነር', rom: 'injiner', zh: '工程师（常作尊称）' },
      { id: 'u16-10', am: 'ውል', rom: 'wil', zh: '合同' },
      { id: 'u16-11', am: 'ማጽደቅ', rom: 'matsdeq', zh: '批准', note: '已批准：ጸድቋል (tsediqwal)' },
      { id: 'u16-12', am: 'መንግስት', rom: 'mengist', zh: '政府' },
      { id: 'u16-13', am: 'ሚኒስቴር', rom: 'ministér', zh: '部（政府部门）' },
      { id: 'u16-14', am: 'ፕሮጀክት', rom: 'projekt', zh: '项目' },
      { id: 'u16-15', am: 'ትብብር', rom: 'tibibir', zh: '合作' },
      { id: 'u16-16', am: 'ኩባንያችን', rom: 'kubaniyachin', zh: '我们公司' },
      { id: 'u16-17', am: 'ርክክብ', rom: 'rikikib', zh: '交接 / 验收' },
      { id: 'u16-18', am: 'ስልጠና', rom: 'siltena', zh: '培训' },
      { id: 'u16-19', am: 'መርሃ ግብር', rom: 'merha gibir', zh: '日程 / 计划表' },
      { id: 'u16-20', am: 'ሪፖርት', rom: 'riport', zh: '报告' },
      { id: 'u16-21', am: 'ስለ ...', rom: 'sile ...', zh: '关于……', note: 'ስለ ፕሮጀክቱ 关于这个项目' },
      { id: 'u16-22', am: 'ጥያቄ አለኝ', rom: 'tiyaqé allegn', zh: '我有一个问题' },
      { id: 'u16-23', am: 'ተስማምተናል', rom: 'tesmamitenal', zh: '我们同意了 / 达成一致' },
      { id: 'u16-24', am: 'እንነጋገር', rom: 'inenagager', zh: '我们谈一谈' },
      { id: 'u16-25', am: 'በቅርቡ እንገናኝ', rom: 'beqirbu inigenagn', zh: '近期再见' },
      { id: 'u16-26', am: 'ክብር ነው', rom: 'kibir new', zh: '很荣幸' },
      { id: 'u16-27', am: 'ትብብርዎን እናመሰግናለን', rom: 'tibibirwon inameseginalen', zh: '感谢您的合作' }
    ],
    dialog: [
      { who: 'A', am: 'እንኳን ደህና መጡ፣ አቶ ተስፋዬ። ይቀመጡ።', rom: 'inkwan dehna metu, ato Tesfaye. yiqemetu.', zh: '欢迎，特斯法耶先生。请坐。' },
      { who: 'B', am: 'እናመሰግናለን። ደህና ነዎት?', rom: 'inameseginalen. dehna newot?', zh: '谢谢。您好吗？' },
      { who: 'A', am: 'ደህና ነኝ። ስለ ፕሮጀክቱ እንነጋገር።', rom: 'dehna negn. sile projektu inenagager.', zh: '我很好。我们谈谈项目吧。' },
      { who: 'B', am: 'እሺ። መርሃ ግብሩ ጸድቋል?', rom: 'ishi. merha gibiru tsediqwal?', zh: '好。日程批准了吗？' },
      { who: 'A', am: 'አዎ፣ ጸድቋል። ስልጠናው ነገ ይጀምራል።', rom: 'awo, tsediqwal. siltenaw nege yijemiral.', zh: '批准了。培训明天开始。' },
      { who: 'B', am: 'በጣም ጥሩ። ትብብርዎን እናመሰግናለን።', rom: 'betam tiru. tibibirwon inameseginalen.', zh: '非常好。感谢您的合作。' }
    ]
  }
];

const byId = {};
const itemById = {};
units.forEach((u) => {
  byId[u.id] = u;
  u.items.forEach((it) => { itemById[it.id] = { ...it, unit: u.id }; });
});

function getUnit(id) { return byId[id]; }
function getItem(id) { return itemById[id]; }
function allItems() { return Object.values(itemById); }
function unitsForWeek(week) { return units.filter((u) => u.week === week); }

module.exports = { units, getUnit, getItem, allItems, unitsForWeek };
