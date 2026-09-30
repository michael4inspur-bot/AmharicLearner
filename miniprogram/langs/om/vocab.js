// 奥罗莫语（Afaan Oromoo）词汇与句子：16 个单元，与阿姆哈拉语课程逐单元对应（同一周、同一场景）。
// 字段：id（om-uNN-NN）、text（Qubee 拉丁字母原文）、zh（中文）、note（用法、熟人/敬称形式等，可选）。没有 rom：Qubee 本身就是拉丁字母。
// 奥罗莫语第二人称不分男女，只分熟人（ati，命令式 -i/-u 结尾）和敬称/复数（isin，命令式 -aa 结尾），note 中标注。
// 内容为初稿，需母语者校对；校对完成前语言入口标「试用版」（meta.beta = true）。

const units = [
  {
    id: 'om-u01',
    week: 1,
    title: '问候与礼貌',
    scene: '每天早上见到同事、门卫、邻居的第一句话',
    why: '奥罗莫语是埃塞使用人数最多的语言，奥罗米亚州和亚的斯周边很多同事、司机、工人的母语就是它。用母语问一句 Akkam?，对方会非常惊喜。',
    tips: [
      '问候要"来回一次"：对方问 Akkam?，你答 Nagaa dha 后再回问一句 Ati hoo?（你呢？），否则显得冷淡。',
      '第二人称不分男女，只分熟人和敬称：对长辈、领导、客户用敬称/复数形式，如 Akkam jirtu?、Galatoomaa。',
      '奥罗莫人见面常连着问好几句（身体、家人、工作），每句都答 Nagaa 即可。'
    ],
    items: [
      { id: 'om-u01-01', text: 'Akkam?', zh: '你好（万能问候）', note: '回答：Nagaa dha（很好）' },
      { id: 'om-u01-02', text: 'Akkam bulte?', zh: '早上好（熟人）', note: '字面：你夜里过得怎样' },
      { id: 'om-u01-03', text: 'Akkam bultan?', zh: '早上好（敬称 / 对多人）', note: '敬称和复数同形，对长辈、客户用这个' },
      { id: 'om-u01-04', text: 'Akkam oolte?', zh: '下午好（熟人）', note: '字面：你白天过得怎样；敬称：Akkam ooltan?' },
      { id: 'om-u01-05', text: 'Akkam galgalte?', zh: '晚上好（熟人）', note: '敬称：Akkam galgaltan?' },
      { id: 'om-u01-06', text: 'Nagaa dha', zh: '我很好（平安）', note: '也说 Fayyaa dha' },
      { id: 'om-u01-07', text: 'Akkam jirta?', zh: '你好吗？（熟人）', note: '敬称：Akkam jirtu?' },
      { id: 'om-u01-08', text: 'Galatoomi', zh: '谢谢', note: '敬称 / 对多人：Galatoomaa；非常感谢：Galata guddaa' },
      { id: 'om-u01-09', text: 'Maaloo', zh: '请' },
      { id: 'om-u01-10', text: 'Dhiifama', zh: '对不起 / 打扰一下' },
      { id: 'om-u01-11', text: 'Tole', zh: '好的 / 行' },
      { id: 'om-u01-12', text: 'Eeyyee', zh: '是' },
      { id: 'om-u01-13', text: 'Lakki', zh: '不', note: '"不是"用 miti' },
      { id: 'om-u01-14', text: 'Nagaatti', zh: '再见', note: '走的人对留下的人：Nagaan turi；对要走的人：Nagaan deemi' },
      { id: 'om-u01-15', text: 'Rakkoo hin qabu', zh: '没问题 / 没关系' },
      { id: 'om-u01-16', text: 'Maqaan koo ... dha', zh: '我叫 ……', note: 'Maqaan koo Lii dha 我叫李' },
      { id: 'om-u01-17', text: 'Maqaan kee eenyu?', zh: '你叫什么名字？（熟人）', note: '敬称：Maqaan keessan eenyu?' },
      { id: 'om-u01-18', text: 'Ani Chaayinaa irraa dhufe', zh: '我来自中国', note: '字面：我从中国来' },
      { id: 'om-u01-19', text: 'Afaan Oromoo xiqqoo nan beeka', zh: '我会一点奥罗莫语' },
      { id: 'om-u01-20', text: 'Hin hubanne', zh: '我没听懂', note: '也说 Naaf hin galle；听懂了：Naaf gale' }
    ],
    dialog: [
      { who: 'A', text: 'Akkam! Akkam bulte?', zh: '你好！早上好？' },
      { who: 'B', text: 'Nagaa dha, galatoomi. Ati hoo?', zh: '我很好，谢谢。你呢？' },
      { who: 'A', text: 'Nagaa dha. Maqaan kee eenyu?', zh: '我很好。你叫什么？' },
      { who: 'B', text: 'Maqaan koo Lii dha. Ani Chaayinaa irraa dhufe.', zh: '我叫李。我来自中国。' },
      { who: 'A', text: 'Tole, nagaatti!', zh: '好，再见！' }
    ]
  },
  {
    id: 'om-u02',
    week: 1,
    title: '数字 1–10 与"是 / 不是"',
    scene: '报电话号码、问价、点几份、说房间号',
    why: '数字每天都要用；dha / miti（是 / 不是）是奥罗莫语句子的骨架，放在句尾，学会就能造句。',
    tips: [
      '奥罗莫语的"是"放在句尾："我是李" = Ani Lii dha（我 李 是）。',
      '数字放在名词后面，不需要量词：buna lama = 两杯咖啡（咖啡 两）。'
    ],
    items: [
      { id: 'om-u02-01', text: 'Tokko', zh: '一' },
      { id: 'om-u02-02', text: 'Lama', zh: '二' },
      { id: 'om-u02-03', text: 'Sadii', zh: '三' },
      { id: 'om-u02-04', text: 'Afur', zh: '四' },
      { id: 'om-u02-05', text: 'Shan', zh: '五' },
      { id: 'om-u02-06', text: 'Jaha', zh: '六' },
      { id: 'om-u02-07', text: 'Torba', zh: '七' },
      { id: 'om-u02-08', text: 'Saddeet', zh: '八' },
      { id: 'om-u02-09', text: 'Sagal', zh: '九' },
      { id: 'om-u02-10', text: 'Kudhan', zh: '十' },
      { id: 'om-u02-11', text: 'dha', zh: '是', note: '放句尾，常接在长元音后：Gaarii dha 很好' },
      { id: 'om-u02-12', text: 'Miti', zh: '不是', note: 'Kun bishaan miti 这不是水' },
      { id: 'om-u02-13', text: 'Kun', zh: '这个', note: '作宾语时说 kana：Kana nan barbaada 我要这个' },
      { id: 'om-u02-14', text: 'Sun', zh: '那个', note: '作宾语时说 sana' },
      { id: 'om-u02-15', text: 'Maali?', zh: '是什么？', note: 'Kun maali? 这是什么？' },
      { id: 'om-u02-16', text: 'Meeqa?', zh: '多少？' },
      { id: 'om-u02-17', text: 'Lakkoofsa bilbilaa', zh: '电话号码' },
      { id: 'om-u02-18', text: 'Zeeroo', zh: '零', note: '也说 duwwaa（空）' }
    ],
    dialog: [
      { who: 'A', text: 'Kun maali?', zh: '这是什么？' },
      { who: 'B', text: 'Buna.', zh: '咖啡。' },
      { who: 'A', text: 'Meeqa?', zh: '多少钱？' },
      { who: 'B', text: 'Qarshii kudhan.', zh: '十比尔。' }
    ]
  },
  {
    id: 'om-u03',
    week: 3,
    title: '市场与购物',
    scene: 'Merkato、亚的斯周边城镇的集市、街边水果摊、小超市',
    why: '在埃塞买东西几乎都要问价、砍价。会说"太贵了，便宜点"能立刻省钱，也是最容易获得成就感的场景。',
    tips: [
      '砍价是常态，起价通常高 30–50%。用 Qaalii dha + Xiqqoo hir\'isi 基本都有效。',
      '在亚的斯周边的奥罗米亚城镇（Burayyuu、Sabbataa、Adaamaa）用奥罗莫语问价，摊主会明显更友好。',
      '称重单位是公斤（kiiloo），水果常按"个"或"堆"卖。'
    ],
    items: [
      { id: 'om-u03-01', text: 'Kun meeqa?', zh: '多少钱？', note: '字面：这个多少' },
      { id: 'om-u03-02', text: 'Qarshii', zh: '比尔（埃塞货币）/ 钱', note: '也说 birrii；qarshii 在前、数字在后：qarshii kudhan 十比尔' },
      { id: 'om-u03-03', text: 'Qaalii dha', zh: '太贵了', note: '非常贵：Baay\'ee qaalii dha' },
      { id: 'om-u03-04', text: 'Hir\'isi', zh: '便宜点（熟人）', note: '敬称：Hir\'isaa；少一点：Xiqqoo hir\'isi' },
      { id: 'om-u03-05', text: 'Rakasa', zh: '便宜的' },
      { id: 'om-u03-06', text: 'Nan barbaada', zh: '我想要' },
      { id: 'om-u03-07', text: 'Hin barbaadu', zh: '我不要' },
      { id: 'om-u03-08', text: 'Jiraa?', zh: '有吗？', note: 'Muuziin jiraa? 有香蕉吗？' },
      { id: 'om-u03-09', text: 'Hin jiru', zh: '没有' },
      { id: 'om-u03-10', text: 'Naaf kenni', zh: '给我（熟人）', note: '敬称：Naaf kennaa' },
      { id: 'om-u03-11', text: 'Kiiloo', zh: '公斤' },
      { id: 'om-u03-12', text: 'Gabaa', zh: '市场' },
      { id: 'om-u03-13', text: 'Suuqii', zh: '商店' },
      { id: 'om-u03-14', text: 'Maallaqa', zh: '钱' },
      { id: 'om-u03-15', text: 'Qarshii naaf deebisi', zh: '找零（把钱找给我）', note: '对熟人说；敬称：Qarshii naaf deebisaa' },
      { id: 'om-u03-16', text: 'Bishaan', zh: '水' },
      { id: 'om-u03-17', text: 'Daabboo', zh: '面包' },
      { id: 'om-u03-18', text: 'Muuzii', zh: '香蕉' },
      { id: 'om-u03-19', text: 'Burtukaana', zh: '橙子' },
      { id: 'om-u03-20', text: 'Hanqaaquu', zh: '鸡蛋' },
      { id: 'om-u03-21', text: 'Ruuzii', zh: '米' },
      { id: 'om-u03-22', text: 'Sukkaara', zh: '糖' },
      { id: 'om-u03-23', text: 'Soogidda', zh: '盐' },
      { id: 'om-u03-24', text: 'Zayita', zh: '食用油' },
      { id: 'om-u03-25', text: 'Kuduraa', zh: '蔬菜' },
      { id: 'om-u03-26', text: 'Muduraa', zh: '水果' }
    ],
    dialog: [
      { who: 'A', text: 'Muuzii qabdaa?', zh: '有香蕉吗？（你有香蕉吗）' },
      { who: 'B', text: 'Eeyyee, jira. Kiiloo meeqa?', zh: '有。要几公斤？' },
      { who: 'A', text: 'Kiiloo lama. Meeqa?', zh: '两公斤。多少钱？' },
      { who: 'B', text: 'Qarshii saddeettama.', zh: '八十比尔。' },
      { who: 'A', text: 'Qaalii dha! Maaloo hir\'isi.', zh: '太贵了！便宜点吧。' },
      { who: 'B', text: 'Tole, qarshii torbaatama.', zh: '好吧，七十。' }
    ]
  },
  {
    id: 'om-u04',
    week: 5,
    title: '数字 11–1000 与价格',
    scene: '听懂报价、付钱、找零、看账单',
    why: '市场报价常是几十到几百比尔，只会 1–10 不够用。听懂大数字才能不被多收。',
    tips: [
      '11–19 = kudha + 个位：kudha tokko (11)，kudha lama (12)。',
      '几十几：十位加 -ii 再接个位：digdamii shan (25)，soddomii lama (32)；百位后用 fi 连接：dhibba fi shantama (150)。',
      '报价时 qarshii 在前、数字在后：qarshii dhibba lama（两百比尔），也常省略 qarshii 直接说数字。'
    ],
    items: [
      { id: 'om-u04-01', text: 'Kudha tokko', zh: '十一' },
      { id: 'om-u04-02', text: 'Kudha shan', zh: '十五' },
      { id: 'om-u04-03', text: 'Digdama', zh: '二十' },
      { id: 'om-u04-04', text: 'Soddoma', zh: '三十' },
      { id: 'om-u04-05', text: 'Afurtama', zh: '四十' },
      { id: 'om-u04-06', text: 'Shantama', zh: '五十' },
      { id: 'om-u04-07', text: 'Jaatama', zh: '六十' },
      { id: 'om-u04-08', text: 'Torbaatama', zh: '七十' },
      { id: 'om-u04-09', text: 'Saddeettama', zh: '八十' },
      { id: 'om-u04-10', text: 'Sagaltama', zh: '九十' },
      { id: 'om-u04-11', text: 'Dhibba', zh: '一百', note: '也说 dhibba tokko' },
      { id: 'om-u04-12', text: 'Dhibba lama', zh: '两百' },
      { id: 'om-u04-13', text: 'Dhibba shan', zh: '五百' },
      { id: 'om-u04-14', text: 'Kuma', zh: '一千', note: '也说 kuma tokko' },
      { id: 'om-u04-15', text: 'Walakkaa', zh: '一半', note: 'kiiloo walakkaa 半公斤' },
      { id: 'om-u04-16', text: 'Gatii', zh: '价格' },
      { id: 'om-u04-17', text: 'Herrega', zh: '账单 / 结账' },
      { id: 'om-u04-18', text: 'Kaffaltii', zh: '付款' },
      { id: 'om-u04-19', text: 'Nagahee', zh: '收据' },
      { id: 'om-u04-20', text: 'Baay\'ee', zh: '很多 / 非常' },
      { id: 'om-u04-21', text: 'Xiqqoo', zh: '一点 / 少' }
    ],
    dialog: [
      { who: 'A', text: 'Maaloo, herrega.', zh: '请结账。' },
      { who: 'B', text: 'Qarshii dhibba sadii fi shantama.', zh: '三百五十比尔。' },
      { who: 'A', text: 'Tole. Nagaheen jiraa?', zh: '好。有收据吗？' },
      { who: 'B', text: 'Eeyyee, jira.', zh: '有。' }
    ]
  },
  {
    id: 'om-u05',
    week: 3,
    title: '交通与方位',
    scene: '打出租车、坐蓝白小巴（minibus）、告诉司机怎么走',
    why: '亚的斯和周边城镇的出租车、三轮车（bajaj）没有计价器，全靠口头谈价和指路。会说左右直走停，就能自己出门。',
    tips: [
      '亚的斯市区的小巴售票员多说阿姆哈拉语，但在周边奥罗米亚城镇，Asitti nan bu\'a（我在这儿下）很好用。',
      '打车先问价再上车：Gara Boolee meeqa?',
      '地标比路名好用；很多地方有奥罗莫语名，亚的斯亚贝巴叫 Finfinnee。'
    ],
    items: [
      { id: 'om-u05-01', text: 'Taaksii', zh: '出租车' },
      { id: 'om-u05-02', text: 'Eessa deemta?', zh: '去哪儿？（熟人）', note: '敬称：Eessa deemtu?' },
      { id: 'om-u05-03', text: 'Gara ... nan deema', zh: '我要去……', note: 'Gara waajjiraa nan deema 我去办公室' },
      { id: 'om-u05-04', text: 'Gara Boolee meeqa?', zh: '去博莱多少钱？' },
      { id: 'om-u05-05', text: 'Asitti', zh: '这里', note: '也说 as' },
      { id: 'om-u05-06', text: 'Achitti', zh: '那里', note: '也说 achi' },
      { id: 'om-u05-07', text: 'Mirga', zh: '右', note: '右转：Mirgatti gori' },
      { id: 'om-u05-08', text: 'Bitaa', zh: '左', note: '左转：Bitaatti gori' },
      { id: 'om-u05-09', text: 'Qajeelaa deemi', zh: '直走' },
      { id: 'om-u05-10', text: 'Dhaabi', zh: '停（熟人）', note: '敬称：Dhaabaa；这里停：Asitti dhaabi' },
      { id: 'om-u05-11', text: 'Asitti nan bu\'a', zh: '我在这儿下车（小巴用语）' },
      { id: 'om-u05-12', text: 'Eessa jira?', zh: '在哪儿？' },
      { id: 'om-u05-13', text: 'Fagoo dha?', zh: '远吗？' },
      { id: 'om-u05-14', text: 'Dhihoo dha', zh: '很近' },
      { id: 'om-u05-15', text: 'Karaa', zh: '路' },
      { id: 'om-u05-16', text: 'Buufata xiyyaaraa', zh: '机场', note: '字面：飞机站' },
      { id: 'om-u05-17', text: 'Hoteela', zh: '酒店' },
      { id: 'om-u05-18', text: 'Baankii', zh: '银行' },
      { id: 'om-u05-19', text: 'Waajjira', zh: '办公室' },
      { id: 'om-u05-20', text: 'Mana', zh: '家 / 房子' },
      { id: 'om-u05-21', text: 'Mana nyaataa', zh: '餐馆', note: '字面：吃饭的房子' },
      { id: 'om-u05-22', text: 'Hospitaala', zh: '医院', note: '也说 mana yaalaa' },
      { id: 'om-u05-23', text: 'Suuta oofi', zh: '慢点开（熟人）', note: '敬称：Suuta oofaa' },
      { id: 'om-u05-24', text: 'Dafi', zh: '快点（熟人）', note: '敬称：Dafaa' }
    ],
    dialog: [
      { who: 'A', text: 'Akkam. Gara Boolee meeqa?', zh: '你好。去博莱多少钱？' },
      { who: 'B', text: 'Qarshii dhibba sadii.', zh: '三百比尔。' },
      { who: 'A', text: 'Qaalii dha. Dhibba lama?', zh: '太贵了。两百？' },
      { who: 'B', text: 'Tole, seeni.', zh: '好，上车吧。' },
      { who: 'A', text: 'Qajeelaa deemi... asitti mirgatti gori... tole, asitti dhaabi.', zh: '直走……这里右转……好，这里停。' }
    ]
  },
  {
    id: 'om-u06',
    week: 2,
    title: '时间与日期',
    scene: '约时间、问几点、说明天见',
    why: '埃塞用自己的 12 小时制：日出算 0 点，当地"2 点"是国际时间早上 8 点。奥罗莫语同样按埃塞时间说钟点，不搞清楚会约错时间。',
    tips: [
      '换算：埃塞时间 = 国际时间 − 6（早 6 点到晚 6 点）。当地 sa\'aatii sadii = 上午 9 点。',
      '约时间时确认一句 Sa\'aatii Itoophiyaatiin?（按埃塞时间？）避免误会。',
      '埃塞历法比公历晚 7–8 年，一年 13 个月；奥罗莫人的感恩节 Irreechaa 在 9 月底 10 月初，在 Bishooftuu 和亚的斯举行。'
    ],
    items: [
      { id: 'om-u06-01', text: 'Har\'a', zh: '今天' },
      { id: 'om-u06-02', text: 'Boru', zh: '明天' },
      { id: 'om-u06-03', text: 'Kaleessa', zh: '昨天' },
      { id: 'om-u06-04', text: 'Amma', zh: '现在' },
      { id: 'om-u06-05', text: 'Sa\'aatii', zh: '时间 / 小时 / 点钟' },
      { id: 'om-u06-06', text: 'Sa\'aatiin meeqa?', zh: '几点了？' },
      { id: 'om-u06-07', text: 'Sa\'aatii sadii', zh: '（埃塞时间）三点 = 国际 9 点' },
      { id: 'om-u06-08', text: 'Ganama', zh: '早上' },
      { id: 'om-u06-09', text: 'Waaree booda', zh: '下午', note: '中午：waaree' },
      { id: 'om-u06-10', text: 'Galgala', zh: '晚上' },
      { id: 'om-u06-11', text: 'Guyyaa', zh: '天 / 白天' },
      { id: 'om-u06-12', text: 'Torban', zh: '周', note: '也说 torbee' },
      { id: 'om-u06-13', text: 'Ji\'a', zh: '月' },
      { id: 'om-u06-14', text: 'Waggaa', zh: '年' },
      { id: 'om-u06-15', text: 'Wiixata', zh: '周一' },
      { id: 'om-u06-16', text: 'Kibxata', zh: '周二' },
      { id: 'om-u06-17', text: 'Roobii', zh: '周三' },
      { id: 'om-u06-18', text: 'Kamiisa', zh: '周四' },
      { id: 'om-u06-19', text: 'Jimaata', zh: '周五' },
      { id: 'om-u06-20', text: 'Sanbata xiqqaa', zh: '周六', note: '字面：小安息日' },
      { id: 'om-u06-21', text: 'Sanbata guddaa', zh: '周日', note: '字面：大安息日' },
      { id: 'om-u06-22', text: 'Beellama', zh: '约定 / 预约' },
      { id: 'om-u06-23', text: 'Boru wal agarra', zh: '明天见', note: '字面：明天我们互相见' },
      { id: 'om-u06-24', text: 'Yoom?', zh: '什么时候？' }
    ],
    dialog: [
      { who: 'A', text: 'Walgahiin yoom ta\'a?', zh: '会议什么时候？' },
      { who: 'B', text: 'Boru ganama sa\'aatii sadii.', zh: '明天早上三点（埃塞时间，即 9 点）。' },
      { who: 'A', text: 'Sa\'aatii Itoophiyaatiin?', zh: '埃塞时间？' },
      { who: 'B', text: 'Eeyyee. Boru wal agarra.', zh: '对。明天见。' }
    ]
  },
  {
    id: 'om-u07',
    week: 4,
    title: '餐馆与咖啡',
    scene: '点英吉拉、要水、说不要辣、结账',
    why: '小饭馆菜单常只有本地文字，斋日很多店只有素食。会点菜就不会饿肚子；奥罗米亚西部的 Jimmaa 一带还是著名的咖啡产区。',
    tips: [
      '周三、周五及东正教大斋期很多店只供斋饭（素食）；很多奥罗莫人是穆斯林，不吃猪肉。想吃肉问 Foon jiraa?',
      'Barbaree 是辣椒粉，怕辣就说 Barbaree malee。',
      '咖啡是社交，被邀请喝 buna 尽量别拒绝，至少喝一杯。'
    ],
    items: [
      { id: 'om-u07-01', text: 'Meenuu', zh: '菜单' },
      { id: 'om-u07-02', text: 'Buddeena', zh: '英吉拉（发酵薄饼）', note: '奥罗莫语里也泛指饼类主食' },
      { id: 'om-u07-03', text: 'Ittoo', zh: '炖菜（配英吉拉的酱）' },
      { id: 'om-u07-04', text: 'Ittoo lukkuu', zh: '炖鸡（国菜）', note: '菜单上也常写阿姆哈拉语名 doro wat' },
      { id: 'om-u07-05', text: 'Shiroo', zh: '鹰嘴豆酱（素）' },
      { id: 'om-u07-06', text: 'Foon waadii', zh: '炒肉 / 烤肉', note: '餐馆里也直接说 tibsii' },
      { id: 'om-u07-07', text: 'Kitfoo', zh: '生牛肉末' },
      { id: 'om-u07-08', text: 'Foon', zh: '肉' },
      { id: 'om-u07-09', text: 'Lukkuu', zh: '鸡' },
      { id: 'om-u07-10', text: 'Nyaata soomaa', zh: '斋饭 / 素食' },
      { id: 'om-u07-11', text: 'Foon malee', zh: '不要肉', note: 'malee = 不要 / 没有……' },
      { id: 'om-u07-12', text: 'Barbaree', zh: '辣椒粉' },
      { id: 'om-u07-13', text: 'Barbaree malee', zh: '不要辣' },
      { id: 'om-u07-14', text: 'Buna', zh: '咖啡' },
      { id: 'om-u07-15', text: 'Maakiyaatoo', zh: '玛奇朵' },
      { id: 'om-u07-16', text: 'Shaayii', zh: '茶' },
      { id: 'om-u07-17', text: 'Aannan', zh: '牛奶' },
      { id: 'om-u07-18', text: 'Cuunfaa', zh: '果汁' },
      { id: 'om-u07-19', text: 'Biiraa', zh: '啤酒' },
      { id: 'om-u07-20', text: 'Mi\'aawaa dha', zh: '很好吃 / 很甜' },
      { id: 'om-u07-21', text: 'Quufeera', zh: '我吃饱了' },
      { id: 'om-u07-22', text: 'Maaloo bishaan naaf fidi', zh: '请给我水', note: '字面：请给我拿水来' },
      { id: 'om-u07-23', text: 'Maaloo herrega naaf fidi', zh: '请结账' },
      { id: 'om-u07-24', text: 'Kan biraa', zh: '另一个', note: '再来一份：Tokko dabali' }
    ],
    dialog: [
      { who: 'A', text: 'Meenuun jiraa?', zh: '有菜单吗？' },
      { who: 'B', text: 'Eeyyee. Maal barbaadda?', zh: '有。你想要什么？' },
      { who: 'A', text: 'Foon waadii tokko, barbaree malee. Akkasumas bishaan lama.', zh: '一份炒肉，不要辣。还有两瓶水。' },
      { who: 'B', text: 'Tole.', zh: '好的。' },
      { who: 'A', text: 'Mi\'aawaa dha! Maaloo herrega naaf fidi.', zh: '很好吃！请结账。' }
    ]
  },
  {
    id: 'om-u08',
    week: 5,
    title: '代词、"有"与疑问词',
    scene: '把前 4 周的词组合成句子',
    why: '前面学的都是"积木"，这一单元是"粘合剂"。掌握 7 个代词、"有 / 在"、7 个疑问词和"我的 / 你的"，就能自己造出大部分生存句。',
    tips: [
      'jira 既是"有"也是"在"：Bishaan jiraa? 有水吗？ Caalaan jiraa? 查拉在吗？',
      '疑问词放在动词前，不用调整语序：Maqaan kee eenyu?（你的名字 谁）。',
      '"我的 / 你的"放在名词后面：maqaa koo（我的名字）；名词作主语时加 -n：Maqaan koo Lii dha。'
    ],
    items: [
      { id: 'om-u08-01', text: 'Ani', zh: '我', note: '作宾语：na' },
      { id: 'om-u08-02', text: 'Ati', zh: '你（熟人，不分男女）', note: '作宾语：si' },
      { id: 'om-u08-03', text: 'Isin', zh: '您 / 你们', note: '敬称和复数同形' },
      { id: 'om-u08-04', text: 'Inni', zh: '他', note: '作宾语：isa' },
      { id: 'om-u08-05', text: 'Isheen', zh: '她', note: '作宾语：ishee' },
      { id: 'om-u08-06', text: 'Nuti', zh: '我们', note: '也说 nu\'i；作宾语：nu' },
      { id: 'om-u08-07', text: 'Isaan', zh: '他们' },
      { id: 'om-u08-08', text: 'Jira', zh: '有 / 在' },
      { id: 'om-u08-09', text: 'Hin jiru', zh: '没有 / 不在' },
      { id: 'om-u08-10', text: 'Nan qaba', zh: '我有' },
      { id: 'om-u08-11', text: 'Hin qabu', zh: '我没有' },
      { id: 'om-u08-12', text: 'Maal?', zh: '什么？', note: 'Maal barbaadda? 你要什么？' },
      { id: 'om-u08-13', text: 'Eenyu?', zh: '谁？' },
      { id: 'om-u08-14', text: 'Eessa?', zh: '哪里？' },
      { id: 'om-u08-15', text: 'Yoom?', zh: '什么时候？' },
      { id: 'om-u08-16', text: 'Maaliif?', zh: '为什么？' },
      { id: 'om-u08-17', text: 'Akkamitti?', zh: '怎么？/ 怎么样？' },
      { id: 'om-u08-18', text: 'Kam?', zh: '哪个？', note: 'Isa kam? 哪一个？' },
      { id: 'om-u08-19', text: 'koo', zh: '我的', note: '放在名词后：mana koo 我的家' },
      { id: 'om-u08-20', text: 'kee', zh: '你的（熟人）', note: 'maqaa kee 你的名字' },
      { id: 'om-u08-21', text: 'keessan', zh: '您的 / 你们的' },
      { id: 'om-u08-22', text: 'keenya', zh: '我们的', note: 'dhaabbata keenya 我们公司' },
      { id: 'om-u08-23', text: 'fi', zh: '和' },
      { id: 'om-u08-24', text: 'Garuu', zh: '但是' }
    ],
    dialog: [
      { who: 'A', text: 'Caalaan jiraa?', zh: '查拉在吗？' },
      { who: 'B', text: 'Hin jiru. Maaliif?', zh: '不在。为什么（找他）？' },
      { who: 'A', text: 'Beellama qaba. Yoom dhufa?', zh: '我有约。他什么时候来？' },
      { who: 'B', text: 'Waaree booda.', zh: '下午。' }
    ]
  },
  {
    id: 'om-u09',
    week: 5,
    title: '常用形容词',
    scene: '评价东西好坏、大小、冷热，描述人和物',
    why: '形容词 + dha 就是完整句子（Gaarii dha = 很好）。十几个形容词能表达大部分态度。',
    tips: [
      '形容词放在名词后面（和中文相反）：mana guddaa 大房子。',
      '"很 / 非常"用 baay\'ee：Baay\'ee gaarii dha 非常好。'
    ],
    items: [
      { id: 'om-u09-01', text: 'Gaarii', zh: '好' },
      { id: 'om-u09-02', text: 'Badaa', zh: '坏' },
      { id: 'om-u09-03', text: 'Guddaa', zh: '大' },
      { id: 'om-u09-04', text: 'Xiqqaa', zh: '小' },
      { id: 'om-u09-05', text: 'Ho\'aa', zh: '热' },
      { id: 'om-u09-06', text: 'Qabbanaa\'aa', zh: '冷' },
      { id: 'om-u09-07', text: 'Haaraa', zh: '新', note: '亚的斯亚贝巴的奥罗莫语名是 Finfinnee' },
      { id: 'om-u09-08', text: 'Moofaa', zh: '旧' },
      { id: 'om-u09-09', text: 'Bareedaa', zh: '漂亮' },
      { id: 'om-u09-10', text: 'Qulqulluu', zh: '干净' },
      { id: 'om-u09-11', text: 'Xuraa\'aa', zh: '脏' },
      { id: 'om-u09-12', text: 'Saffisaa', zh: '快' },
      { id: 'om-u09-13', text: 'Suuta', zh: '慢（慢慢地）' },
      { id: 'om-u09-14', text: 'Salphaa', zh: '容易 / 轻' },
      { id: 'om-u09-15', text: 'Ulfaataa', zh: '难 / 重' },
      { id: 'om-u09-16', text: 'Baay\'ee gaarii', zh: '非常好' },
      { id: 'om-u09-17', text: 'Nan jaalladha', zh: '我喜欢' },
      { id: 'om-u09-18', text: 'Dadhabeera', zh: '我累了' },
      { id: 'om-u09-19', text: 'Beela\'eera', zh: '我饿了' },
      { id: 'om-u09-20', text: 'Dheebodheera', zh: '我渴了' }
    ],
    dialog: [
      { who: 'A', text: 'Finfinneen akkam?', zh: '亚的斯亚贝巴怎么样？' },
      { who: 'B', text: 'Baay\'ee gaarii dha, garuu xiqqoo qabbanaa\'aa dha.', zh: '非常好，但是有点冷。' },
      { who: 'A', text: 'Bunni kun baay\'ee mi\'aawaa dha!', zh: '这咖啡很棒！' }
    ]
  },
  {
    id: 'om-u10',
    week: 2,
    title: '工作与办公室',
    scene: '和当地同事、司机、保安、客户打交道',
    why: '亚的斯周边和奥罗米亚的项目上，很多同事、司机、保安的母语是奥罗莫语。工作中说几句，能明显拉近和本地团队的距离，也方便安排日常事务。',
    tips: [
      '对长辈、领导、客户用敬称（isin 系列），命令式以 -aa 结尾：Kottaa（请来）、Eegaa（请等）。',
      '表扬要具体：Hojii gaarii!（干得好）或 Jabaadhu!（加油）会让本地同事很受用。',
      '同事说 boru 通常真的是明天，但约具体钟点要确认是埃塞时间。'
    ],
    items: [
      { id: 'om-u10-01', text: 'Hojii', zh: '工作' },
      { id: 'om-u10-02', text: 'Walgahii', zh: '会议' },
      { id: 'om-u10-03', text: 'Dhaabbata', zh: '公司 / 机构', note: '也说 kaampaanii' },
      { id: 'om-u10-04', text: 'Maamila', zh: '客户' },
      { id: 'om-u10-05', text: 'Sanada', zh: '文件' },
      { id: 'om-u10-06', text: 'Mallattoo', zh: '签名' },
      { id: 'om-u10-07', text: 'Bilbila', zh: '电话' },
      { id: 'om-u10-08', text: 'Imeelii', zh: '邮件' },
      { id: 'om-u10-09', text: 'Kompiitara', zh: '电脑' },
      { id: 'om-u10-10', text: 'Hojii gaarii!', zh: '干得好', note: '鼓励也常说 Jabaadhu!（加油）' },
      { id: 'om-u10-11', text: 'Rakkoo', zh: '问题' },
      { id: 'om-u10-12', text: 'Furmaata', zh: '解决办法' },
      { id: 'om-u10-13', text: 'Hoogganaa', zh: '老板 / 上司' },
      { id: 'om-u10-14', text: 'Hojjetaa', zh: '员工 / 工人', note: '复数：hojjettoota' },
      { id: 'om-u10-15', text: 'Konkolaachisaa', zh: '司机' },
      { id: 'om-u10-16', text: 'Eegduu', zh: '保安 / 门卫' },
      { id: 'om-u10-17', text: 'Mindaa', zh: '工资' },
      { id: 'om-u10-18', text: 'Boqonnaa', zh: '休息 / 假期' },
      { id: 'om-u10-19', text: 'Qophaa\'eeraa?', zh: '准备好了吗？' },
      { id: 'om-u10-20', text: 'Xumurameera', zh: '完成了' },
      { id: 'om-u10-21', text: 'Ammallee hin xumuramne', zh: '还没有（还没完成）' },
      { id: 'om-u10-22', text: 'Naaf bilbili', zh: '给我打电话（熟人）', note: '敬称：Naaf bilbilaa' },
      { id: 'om-u10-23', text: 'Kottu', zh: '来（熟人）', note: '敬称 / 对多人：Kottaa' },
      { id: 'om-u10-24', text: 'Eegi', zh: '等一下（熟人）', note: '敬称 / 对多人：Eegaa' }
    ],
    dialog: [
      { who: 'A', text: 'Sanadni qophaa\'eeraa?', zh: '文件准备好了吗？' },
      { who: 'B', text: 'Ammallee hin xumuramne. Boru ganama.', zh: '还没有。明天早上。' },
      { who: 'A', text: 'Tole. Yoo xumurame naaf bilbili.', zh: '好。完成了给我打电话。' },
      { who: 'B', text: 'Tole, rakkoo hin qabu.', zh: '好，没问题。' }
    ]
  },
  {
    id: 'om-u11',
    week: 6,
    title: '常用动词与"我要 / 我能"',
    scene: '表达意图：我去、我买、我吃、我能、我想',
    why: '动词让你从"指着东西说词"升级到"说出想做什么"。先学原形和第一人称，够用又不用背整张变位表。',
    tips: [
      '动词原形以 -uu 结尾（deemuu 去）；"我去"常说 Nan deema，Nan 是"我 + 强调"。',
      '否定：hin + 动词，词尾变 -u：Hin deemu（我不去）、Hin barbaadu（我不要）。',
      '"必须"：动词原形 + qaba：Hojjechuu qaba（我必须工作）；"我能"：Nan danda\'a。'
    ],
    items: [
      { id: 'om-u11-01', text: 'Deemuu', zh: '去', note: '我去：Nan deema' },
      { id: 'om-u11-02', text: 'Dhufuu', zh: '来', note: '我来：Nan dhufa' },
      { id: 'om-u11-03', text: 'Nyaachuu', zh: '吃', note: '我吃：Nan nyaadha' },
      { id: 'om-u11-04', text: 'Dhuguu', zh: '喝', note: '我喝：Nan dhuga' },
      { id: 'om-u11-05', text: 'Bitachuu', zh: '买', note: '我买：Nan bitadha' },
      { id: 'om-u11-06', text: 'Hojjechuu', zh: '工作 / 做', note: '我工作：Nan hojjedha' },
      { id: 'om-u11-07', text: 'Ilaaluu', zh: '看', note: '我看：Nan ilaala' },
      { id: 'om-u11-08', text: 'Dhaggeeffachuu', zh: '听', note: '我听：Nan dhaggeeffadha' },
      { id: 'om-u11-09', text: 'Dubbachuu', zh: '说', note: '我说：Nan dubbadha' },
      { id: 'om-u11-10', text: 'Rafuu', zh: '睡觉', note: '我睡：Nan rafa' },
      { id: 'om-u11-11', text: 'Eeguu', zh: '等待', note: '我等：Nan eega' },
      { id: 'om-u11-12', text: 'Barachuu', zh: '学习', note: '我学：Nan baradha' },
      { id: 'om-u11-13', text: 'Nan danda\'a', zh: '我能 / 我会' },
      { id: 'om-u11-14', text: 'Hin danda\'u', zh: '我不能 / 我不会' },
      { id: 'om-u11-15', text: 'Nan barbaada', zh: '我想要' },
      { id: 'om-u11-16', text: 'Deemuu qaba', zh: '我必须走', note: '动词原形 + qaba = 必须：Hojjechuu qaba 我必须工作' },
      { id: 'om-u11-17', text: 'Gara hojii nan deema', zh: '我去上班' },
      { id: 'om-u11-18', text: 'Afaan Oromoo nan barachaa jira', zh: '我在学奥罗莫语' },
      { id: 'om-u11-19', text: 'Buna nan dhuga', zh: '我喝咖啡' },
      { id: 'om-u11-20', text: 'Boru nan dhufa', zh: '我明天来' }
    ],
    dialog: [
      { who: 'A', text: 'Boru gara gabaa nan deema. Ni dhufta?', zh: '明天我去市场。你来吗？' },
      { who: 'B', text: 'Hin danda\'u, hojjechuu qaba.', zh: '不行，我必须工作。' },
      { who: 'A', text: 'Tole, rakkoo hin qabu.', zh: '好，没关系。' }
    ]
  },
  {
    id: 'om-u12',
    week: 7,
    title: '健康与紧急情况',
    scene: '去药店、看医生、遇到麻烦求助',
    why: '生病或出事时没有时间查词典。这 20 句要练到不用想就能说出口。',
    tips: [
      '亚的斯海拔约 2300 米，头痛、气短很常见，Mataan na dhukkuba（我头痛）会经常用到。',
      '药店（mana qorichaa）很多，常见药不用处方。',
      '紧急电话：警察 991，救护车 907。'
    ],
    items: [
      { id: 'om-u12-01', text: 'Na gargaaraa!', zh: '救命 / 帮帮我！', note: '对一个熟人：Na gargaari!' },
      { id: 'om-u12-02', text: 'Doktora', zh: '医生', note: '也说 ogeessa fayyaa' },
      { id: 'om-u12-03', text: 'Mana qorichaa', zh: '药店', note: '也说 faarmaasii' },
      { id: 'om-u12-04', text: 'Qoricha', zh: '药' },
      { id: 'om-u12-05', text: 'Dhukkubsadheera', zh: '我病了' },
      { id: 'om-u12-06', text: 'Dhukkubbii mataa', zh: '头痛', note: '我头痛：Mataan na dhukkuba' },
      { id: 'om-u12-07', text: 'Garaa', zh: '肚子' },
      { id: 'om-u12-08', text: 'Garaan na dhukkuba', zh: '我肚子疼' },
      { id: 'om-u12-09', text: 'Ho\'a qaamaa', zh: '发烧（体温高）' },
      { id: 'om-u12-10', text: 'Qufaa', zh: '咳嗽' },
      { id: 'om-u12-11', text: 'Garaa kaasaa', zh: '腹泻' },
      { id: 'om-u12-12', text: 'Alarjii', zh: '过敏' },
      { id: 'om-u12-13', text: 'Bishaan danfaa', zh: '烧开的水' },
      { id: 'om-u12-14', text: 'Poolisii', zh: '警察' },
      { id: 'om-u12-15', text: 'Balaa', zh: '事故 / 危险' },
      { id: 'om-u12-16', text: 'Of eeggadhu!', zh: '小心（熟人）', note: '敬称 / 对多人：Of eeggadhaa!' },
      { id: 'om-u12-17', text: 'Hattuu!', zh: '小偷！' },
      { id: 'om-u12-18', text: 'Na jalaa bade', zh: '我弄丢了', note: 'Paaspoortiin koo na jalaa bade 我的护照丢了' },
      { id: 'om-u12-19', text: 'Paaspoortii', zh: '护照' },
      { id: 'om-u12-20', text: 'Embaasii', zh: '大使馆', note: '中国大使馆：Embaasii Chaayinaa' },
      { id: 'om-u12-21', text: 'Bilbili', zh: '打电话（熟人，命令式）', note: '报警：Poolisiitti bilbili' },
      { id: 'om-u12-22', text: 'Ambulaansii', zh: '救护车' }
    ],
    dialog: [
      { who: 'A', text: 'Dhiifama, manni qorichaa eessa jira?', zh: '打扰一下，药店在哪儿？' },
      { who: 'B', text: 'Achi, gara mirgaatti.', zh: '那边，右手边。' },
      { who: 'A', text: 'Mataan na dhukkuba. Qorichi jiraa?', zh: '我头痛。有药吗？' },
      { who: 'B', text: 'Eeyyee. Kun gaarii dha.', zh: '有。这个很好。' }
    ]
  },
  {
    id: 'om-u13',
    week: 2,
    title: '住宿与日常生活',
    scene: '和房东、保洁、水电工沟通；停水停电',
    why: '亚的斯和周边城镇停水停电常见，和房东、保洁沟通是每周的事。这些词让生活少很多摩擦。',
    tips: [
      '停电说 Ibsaan hin jiru，停水说 Bishaan hin jiru，是当地人的日常口头禅。',
      '请保洁或保安帮忙时加 maaloo；对年长的人用敬称（Kottaa、Galatoomaa），态度会好很多。'
    ],
    items: [
      { id: 'om-u13-01', text: 'Ibsaa', zh: '电 / 灯' },
      { id: 'om-u13-02', text: 'Ibsaan hin jiru', zh: '停电了' },
      { id: 'om-u13-03', text: 'Bishaan hin jiru', zh: '停水了' },
      { id: 'om-u13-04', text: 'Interneetii', zh: '网络' },
      { id: 'om-u13-05', text: 'Furtuu', zh: '钥匙' },
      { id: 'om-u13-06', text: 'Balbala', zh: '门' },
      { id: 'om-u13-07', text: 'Foddaa', zh: '窗户' },
      { id: 'om-u13-08', text: 'Kutaa', zh: '房间' },
      { id: 'om-u13-09', text: 'Mana fincaanii', zh: '厕所' },
      { id: 'om-u13-10', text: 'Kushinaa', zh: '厨房' },
      { id: 'om-u13-11', text: 'Siree', zh: '床' },
      { id: 'om-u13-12', text: 'Kiraa', zh: '房租' },
      { id: 'om-u13-13', text: 'Abbaa mana kiraa', zh: '房东', note: '注意：单说 abbaa manaa 是"丈夫"' },
      { id: 'om-u13-14', text: 'Hin hojjetu', zh: '坏了（不工作了）' },
      { id: 'om-u13-15', text: 'Suphuu', zh: '修理', note: '请修一下：Maaloo suphi' },
      { id: 'om-u13-16', text: 'Qulqulleessuu', zh: '打扫' },
      { id: 'om-u13-17', text: 'Uffata', zh: '衣服' },
      { id: 'om-u13-18', text: 'Miicuu', zh: '洗（衣服）', note: '洗手、洗碗用 dhiquu' },
      { id: 'om-u13-19', text: 'Kosii', zh: '垃圾' },
      { id: 'om-u13-20', text: 'Ollaa', zh: '邻居' },
      { id: 'om-u13-21', text: 'Rooba', zh: '雨' },
      { id: 'om-u13-22', text: 'Aduu', zh: '太阳' }
    ],
    dialog: [
      { who: 'A', text: 'Akkam. Ibsaan hin jiru.', zh: '你好。停电了。' },
      { who: 'B', text: 'Eeyyee, naannoo kana guutuu hin jiru.', zh: '对，整个片区都停了。' },
      { who: 'A', text: 'Yoom dhufa?', zh: '什么时候来电？' },
      { who: 'B', text: 'Galgala ni dhufa.', zh: '晚上会来。' }
    ]
  },
  {
    id: 'om-u14',
    week: 4,
    title: '现场与班组',
    scene: '基站、机房、布线安装、调测验收，向一线班组布置任务',
    why: 'IT/通信交付的核心场景。奥罗米亚的站点上，一线工人多说奥罗莫语。很多技术词直接借自英语（keebilii、jenereetara），学起来快，而"做完了吗、有问题、小心"这些句子决定现场效率和安全。',
    tips: [
      '对班组多人说话用复数命令式（词尾 -aa）：Eegaa（你们等等）、Of eeggadhaa（大家小心）。',
      '"完成了"常听到 Xumurreerra（我们做完了）和 Ammallee（还没）。',
      '本地同事说 Neetworkiin hin jiru 既指手机没信号，也指网络断了，要追问一句。'
    ],
    items: [
      { id: 'om-u14-01', text: 'Saayitii', zh: '站点 / 现场（借自 site）' },
      { id: 'om-u14-02', text: 'Taawara', zh: '塔', note: '借自 tower' },
      { id: 'om-u14-03', text: 'Keebilii', zh: '电缆' },
      { id: 'om-u14-04', text: 'Faayibara', zh: '光纤' },
      { id: 'om-u14-05', text: 'Anteenaa', zh: '天线' },
      { id: 'om-u14-06', text: 'Jenereetara', zh: '发电机' },
      { id: 'om-u14-07', text: 'Baatirii', zh: '电池' },
      { id: 'om-u14-08', text: 'Humna ibsaa', zh: '电（电力）', note: '停电：Ibsaan hin jiru' },
      { id: 'om-u14-09', text: 'Meeshaa hojii', zh: '设备 / 工具' },
      { id: 'om-u14-10', text: 'Meeshaa', zh: '物品 / 材料 / 货', note: '复数：meeshaalee' },
      { id: 'om-u14-11', text: 'Diriirsuu', zh: '安装 / 铺设', note: '我们安装：Ni diriirsina' },
      { id: 'om-u14-12', text: 'Yaaluu', zh: '测试 / 试一下', note: '试一下（熟人）：Yaali' },
      { id: 'om-u14-13', text: 'Sakatta\'uu', zh: '检查', note: '检查一下（熟人）：Sakatta\'i' },
      { id: 'om-u14-14', text: 'Walqabsiisuu', zh: '连接' },
      { id: 'om-u14-15', text: 'Bani', zh: '打开（电源 / 灯）（熟人）', note: '敬称 / 对多人：Banaa' },
      { id: 'om-u14-16', text: 'Cufi', zh: '关掉（电源 / 灯）（熟人）', note: '敬称 / 对多人：Cufaa' },
      { id: 'om-u14-17', text: 'Siginaalii', zh: '信号' },
      { id: 'om-u14-18', text: 'Neetworkiin hin jiru', zh: '没信号 / 没网' },
      { id: 'om-u14-19', text: 'Sarvarii', zh: '服务器' },
      { id: 'om-u14-20', text: 'Nageenya', zh: '安全' },
      { id: 'om-u14-21', text: 'Helmeetii', zh: '安全帽' },
      { id: 'om-u14-22', text: 'Balaa qaba', zh: '危险', note: '字面：有危险' },
      { id: 'om-u14-23', text: 'Gubbaa', zh: '上面', note: '下面：jala' },
      { id: 'om-u14-24', text: 'Xumurteettaa?', zh: '你做完了吗？（熟人）', note: '我们做完了：Xumurreerra' },
      { id: 'om-u14-25', text: 'Ammallee hin xumurre', zh: '我还没做完' },
      { id: 'om-u14-26', text: 'Rakkoon jira', zh: '有问题' },
      { id: 'om-u14-27', text: 'Nama meeqa?', zh: '几个人？' },
      { id: 'om-u14-28', text: 'Har\'a ni xumurama', zh: '今天能完成' },
      { id: 'om-u14-29', text: 'Boru ni jalqabna', zh: '我们明天开始' },
      { id: 'om-u14-30', text: 'Sa\'aatii dabalataa', zh: '加班', note: '字面：额外的时间' },
      { id: 'om-u14-31', text: 'Meeshaan ga\'eeraa?', zh: '货到了吗？' },
      { id: 'om-u14-32', text: 'Hayyama', zh: '许可 / 准许' },
      { id: 'om-u14-33', text: 'Of eeggadhaa!', zh: '大家小心！', note: '对一个熟人：Of eeggadhu!' }
    ],
    dialog: [
      { who: 'A', text: 'Akkam! Har\'a keebilii ni diriirsina.', zh: '大家好！今天我们装电缆。' },
      { who: 'B', text: 'Tole. Meeshaan ga\'eeraa?', zh: '好。货到了吗？' },
      { who: 'A', text: 'Eeyyee, ga\'eera. Namni meeqa jira?', zh: '到了。有几个人？' },
      { who: 'B', text: 'Nama afur.', zh: '四个人。' },
      { who: 'A', text: 'Gaarii. Helmeetii kaa\'adhaa, balaa qaba.', zh: '好。戴上安全帽，危险。' },
      { who: 'B', text: 'Tole. Har\'a ni xumurama.', zh: '好。今天能完成。' }
    ]
  },
  {
    id: 'om-u15',
    week: 3,
    title: '电话与沟通',
    scene: '接打电话、约时间、说明自己在哪、听不清怎么办',
    why: '电话里没有手势和表情，是最难的沟通场景，也是和司机、同事、客户每天都要用的。会说"听不清、再说一遍、我在路上"就能撑住一通电话。',
    tips: [
      '接电话说 Haloo，对方常问 Eenyu dubbata?（谁在说话），回答 Ani ... dha。',
      '埃塞人用 Telegram 远多于 WhatsApp，"发我"就是 Telegiraamiin naaf ergi。',
      '听不清先说 Hin dhaga\'amu，再说 Irra deebi\'i（敬称 Irra deebi\'aa），不要沉默。'
    ],
    items: [
      { id: 'om-u15-01', text: 'Haloo', zh: '喂（接电话）' },
      { id: 'om-u15-02', text: 'Eenyu dubbata?', zh: '是谁？', note: '字面：谁在说话' },
      { id: 'om-u15-03', text: 'Ani ... dha', zh: '我是……', note: 'Ani Lii dha 我是李' },
      { id: 'om-u15-04', text: 'Hin dhaga\'amu', zh: '听不清 / 听不见' },
      { id: 'om-u15-05', text: 'Irra deebi\'i', zh: '再说一遍（熟人）', note: '敬称：Irra deebi\'aa' },
      { id: 'om-u15-06', text: 'Suuta dubbadhu', zh: '慢点说（熟人）', note: '敬称：Suuta dubbadhaa' },
      { id: 'om-u15-07', text: 'Xiqqoo eegi', zh: '稍等（熟人）', note: '敬称：Xiqqoo eegaa' },
      { id: 'om-u15-08', text: 'Booda sitti bilbila', zh: '我一会儿打给你（熟人）', note: '对您：Booda isinitti bilbila' },
      { id: 'om-u15-09', text: 'Ergaa', zh: '消息 / 短信' },
      { id: 'om-u15-10', text: 'Naaf ergi', zh: '发给我（熟人）', note: '敬称：Naaf ergaa' },
      { id: 'om-u15-11', text: 'Telegiraamii', zh: '电报（Telegram，常用聊天软件）', note: 'Telegiraamiin naaf ergi 用 Telegram 发我' },
      { id: 'om-u15-12', text: 'Lakkoofsa kee naaf kenni', zh: '把你的号码给我（熟人）', note: '敬称：Lakkoofsa keessan naaf kennaa' },
      { id: 'om-u15-13', text: 'Hojii baay\'ee qaba', zh: '我很忙', note: '字面：我有很多工作' },
      { id: 'om-u15-14', text: 'Karaa irra jira', zh: '我在路上' },
      { id: 'om-u15-15', text: 'Ga\'eera', zh: '我到了', note: '也说 Nan ga\'e' },
      { id: 'om-u15-16', text: 'Harkifadheera', zh: '我迟到了 / 我晚了' },
      { id: 'om-u15-17', text: 'Sa\'aatii meeqatti geessa?', zh: '你几点到？（熟人）', note: '敬称：Sa\'aatii meeqatti geessu?' },
      { id: 'om-u15-18', text: 'Amma nan dhufa', zh: '我马上来' },
      { id: 'om-u15-19', text: 'Daqiiqaa', zh: '分钟', note: 'Daqiiqaa kudhan keessatti 十分钟内' },
      { id: 'om-u15-20', text: 'Siif galeeraa?', zh: '你明白了吗？（熟人）', note: '敬称：Isiniif galeeraa?' },
      { id: 'om-u15-21', text: 'Tole, naaf gale', zh: '好，我明白了' },
      { id: 'om-u15-22', text: 'Chaaw', zh: '再见（口语，电话常用）', note: '来自意大利语 ciao；正式一点说 Nagaatti' },
      { id: 'om-u15-23', text: 'Bilbilli hin hojjetu', zh: '电话打不通 / 手机不工作' },
      { id: 'om-u15-24', text: 'Ammas bilbili', zh: '再打一次（熟人）', note: '敬称：Ammas bilbilaa' },
      { id: 'om-u15-25', text: 'Si eega', zh: '我等你（熟人）', note: '对您：Isin eega' }
    ],
    dialog: [
      { who: 'A', text: 'Haloo, eenyu dubbata?', zh: '喂，是谁？' },
      { who: 'B', text: 'Akkam, ani Caalaa dha. Eessa jirta?', zh: '你好，我是查拉。你在哪儿？' },
      { who: 'A', text: 'Karaa irra jira. Harkifadheera, dhiifama.', zh: '我在路上。我晚了，抱歉。' },
      { who: 'B', text: 'Rakkoo hin qabu. Sa\'aatii meeqatti geessa?', zh: '没关系。你几点到？' },
      { who: 'A', text: 'Daqiiqaa kudhan keessatti.', zh: '十分钟内。' },
      { who: 'B', text: 'Tole, si eega. Nagaatti.', zh: '好，我等你。再见。' }
    ]
  },
  {
    id: 'om-u16',
    week: 6,
    title: '正式场合与敬语',
    scene: '接待客户、拜访奥罗米亚州政府和合作方、开会谈项目',
    why: '对客户和官员用敬称（isin 系列），态度会被明显认可；用熟人形式（ati）则显得随便。这一单元是"被当作可靠合作方"的关键。',
    tips: [
      '敬称用第二人称复数形式：Akkam jirtu?（您好吗）、Taa\'aa（请坐）、Galatoomaa（谢谢您）。',
      '称谓：Obbo 先生、Aadde 女士，后接名字；在埃塞 "Injinara + 名字" 是常见尊称。',
      '正式场合先寒暄再谈事，直接进入正题会显得生硬。'
    ],
    items: [
      { id: 'om-u16-01', text: 'Akkam jirtu?', zh: '您好吗？（敬）' },
      { id: 'om-u16-02', text: 'Akkam ooltan?', zh: '您好（敬，白天见面问候）', note: '字面：您今天过得怎样' },
      { id: 'om-u16-03', text: 'Baga nagaan dhuftan', zh: '欢迎（您 / 你们）', note: '对一个熟人：Baga nagaan dhufte' },
      { id: 'om-u16-04', text: 'Taa\'aa', zh: '请坐（敬）', note: '更客气：Maaloo taa\'aa' },
      { id: 'om-u16-05', text: 'Isin galateeffanna', zh: '我们感谢您' },
      { id: 'om-u16-06', text: 'Kabajamoo', zh: '尊敬的（正式称呼）', note: 'Kabajamoo Obbo Gammachuu 尊敬的加马丘先生' },
      { id: 'om-u16-07', text: 'Obbo', zh: '先生（称谓）', note: 'Obbo Gammachuu 加马丘先生' },
      { id: 'om-u16-08', text: 'Aadde', zh: '女士（称谓）', note: 'Aadde Caaltuu 查尔图女士' },
      { id: 'om-u16-09', text: 'Injinara', zh: '工程师（常作尊称）' },
      { id: 'om-u16-10', text: 'Waliigaltee', zh: '合同 / 协议' },
      { id: 'om-u16-11', text: 'Raggaasisuu', zh: '批准', note: '已批准：Raggaasifameera' },
      { id: 'om-u16-12', text: 'Mootummaa', zh: '政府' },
      { id: 'om-u16-13', text: 'Ministeera', zh: '部（政府部门）' },
      { id: 'om-u16-14', text: 'Pirojektii', zh: '项目' },
      { id: 'om-u16-15', text: 'Tumsa', zh: '合作 / 支持' },
      { id: 'om-u16-16', text: 'Dhaabbata keenya', zh: '我们公司' },
      { id: 'om-u16-17', text: 'Dabarsanii kennuu', zh: '交接 / 移交' },
      { id: 'om-u16-18', text: 'Leenjii', zh: '培训' },
      { id: 'om-u16-19', text: 'Sagantaa', zh: '日程 / 计划表' },
      { id: 'om-u16-20', text: 'Gabaasa', zh: '报告' },
      { id: 'om-u16-21', text: '... ilaalchisee', zh: '关于……', note: 'Pirojektii kana ilaalchisee 关于这个项目' },
      { id: 'om-u16-22', text: 'Gaaffii qaba', zh: '我有一个问题' },
      { id: 'om-u16-23', text: 'Walii galleerra', zh: '我们同意了 / 达成一致' },
      { id: 'om-u16-24', text: 'Haa mari\'annu', zh: '我们谈一谈' },
      { id: 'om-u16-25', text: 'Dhihootti wal agarra', zh: '近期再见' },
      { id: 'om-u16-26', text: 'Baay\'ee gammadne', zh: '（我们）很高兴', note: '见面或合作时的客气话' },
      { id: 'om-u16-27', text: 'Tumsa keessaniif isin galateeffanna', zh: '感谢您的合作' }
    ],
    dialog: [
      { who: 'A', text: 'Baga nagaan dhuftan, Obbo Gammachuu. Taa\'aa.', zh: '欢迎，加马丘先生。请坐。' },
      { who: 'B', text: 'Galatoomaa. Akkam jirtu?', zh: '谢谢。您好吗？' },
      { who: 'A', text: 'Nagaa dha. Pirojektii kana ilaalchisee haa mari\'annu.', zh: '我很好。我们谈谈这个项目吧。' },
      { who: 'B', text: 'Tole. Sagantaan raggaasifameeraa?', zh: '好。日程批准了吗？' },
      { who: 'A', text: 'Eeyyee, raggaasifameera. Leenjiin boru jalqaba.', zh: '批准了。培训明天开始。' },
      { who: 'B', text: 'Baay\'ee gaarii. Tumsa keessaniif isin galateeffanna.', zh: '非常好。感谢您的合作。' }
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
