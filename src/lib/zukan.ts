export type Example = { verse: string; author: string };
export type Kigo = { word: string; reading: string; meaning: string; examples: Example[] };
export type Basic = { title: string; body: string; examples: Example[] };

const BASHO = "松尾芭蕉";
const BUSON = "与謝蕪村";
const ISSA = "小林一茶";
const SHIKI = "正岡子規";

/** 例句は著作権の切れた古典から選んでいる */
export const BASICS: Basic[] = [
  {
    title: "五七五",
    body: "上五・中七・下五の三つ、合わせて十七音で詠みます。音は声に出したときの数で数えます。",
    examples: [{ verse: "古池や　蛙飛びこむ　水の音", author: BASHO }],
  },
  {
    title: "音の数え方",
    body: "「きゃ」「しゅ」のような小さい文字を含む音は、まとめて1音。「っ」「ん」「ー」は、それぞれ1音です。たとえば「ほうりゅうじ」は5音です。",
    examples: [{ verse: "柿くへば　鐘が鳴るなり　法隆寺", author: SHIKI }],
  },
  {
    title: "季語",
    body: "季節を表す言葉を一つ入れます。季語があると、短い句の中に季節の空気や時間が立ち上がります。",
    examples: [{ verse: "夏草や　兵どもが　夢の跡", author: BASHO }],
  },
  {
    title: "切れ字",
    body: "「や」「かな」「けり」などで句を切ると、言葉と言葉の間に余韻が生まれます。",
    examples: [
      { verse: "春の海　終日のたり　のたりかな", author: BUSON },
      { verse: "いくたびも　雪の深さを　尋ねけり", author: SHIKI },
    ],
  },
  {
    title: "字余り・字足らず",
    body: "音が型より多いのが字余り、少ないのが字足らずです。名句にも字余りはありますが、このアプリでは一音の字余りまでにしています。",
    examples: [{ verse: "旅に病んで　夢は枯野を　かけ廻る", author: BASHO }],
  },
  {
    title: "自由律",
    body: "五七五や季語にとらわれずに詠む俳句もあります。短い言葉で、心の動きをそのまま書き留めます。",
    examples: [
      { verse: "咳をしても一人", author: "尾崎放哉" },
      { verse: "分け入つても分け入つても青い山", author: "種田山頭火" },
    ],
  },
];

export const SEASONS: { season: string; items: Kigo[] }[] = [
  {
    season: "春",
    items: [
      { word: "蛙", reading: "かわず", meaning: "春の水辺で鳴きはじめるかえる", examples: [{ verse: "古池や　蛙飛びこむ　水の音", author: BASHO }, { verse: "痩蛙　まけるな一茶　是に有り", author: ISSA }] },
      { word: "菜の花", reading: "なのはな", meaning: "畑や土手を黄色に染める花", examples: [{ verse: "菜の花や　月は東に　日は西に", author: BUSON }] },
      { word: "春の海", reading: "はるのうみ", meaning: "のどかに凪いだ春の海", examples: [{ verse: "春の海　終日のたり　のたりかな", author: BUSON }] },
      { word: "雀の子", reading: "すずめのこ", meaning: "春に巣立つ子雀", examples: [{ verse: "雀の子　そこのけそこのけ　御馬が通る", author: ISSA }] },
      { word: "朧月", reading: "おぼろづき", meaning: "春の夜に、かすんで見える月", examples: [] },
    ],
  },
  {
    season: "夏",
    items: [
      { word: "蝉", reading: "せみ", meaning: "夏の盛りに鳴く虫", examples: [{ verse: "閑さや　岩にしみ入る　蝉の声", author: BASHO }] },
      { word: "夏草", reading: "なつくさ", meaning: "夏に生い茂る草", examples: [{ verse: "夏草や　兵どもが　夢の跡", author: BASHO }] },
      { word: "五月雨", reading: "さみだれ", meaning: "梅雨どきの長雨", examples: [{ verse: "五月雨を　あつめて早し　最上川", author: BASHO }] },
      { word: "蠅", reading: "はえ", meaning: "夏の暮らしの身近な虫", examples: [{ verse: "やれ打つな　蠅が手をすり　足をする", author: ISSA }] },
      { word: "夕立", reading: "ゆうだち", meaning: "夏の午後に急に降る強い雨", examples: [] },
    ],
  },
  {
    season: "秋",
    items: [
      { word: "柿", reading: "かき", meaning: "秋に実る、色づいた果実", examples: [{ verse: "柿くへば　鐘が鳴るなり　法隆寺", author: SHIKI }] },
      { word: "名月", reading: "めいげつ", meaning: "旧暦八月十五日の満月", examples: [{ verse: "名月を　取つてくれろと　泣く子かな", author: ISSA }] },
      { word: "秋の暮", reading: "あきのくれ", meaning: "秋の夕暮れ。物寂しさを帯びる", examples: [{ verse: "枯枝に　烏のとまりたるや　秋の暮", author: BASHO }] },
      { word: "天の川", reading: "あまのがわ", meaning: "秋の夜空に澄んで見える星の川", examples: [{ verse: "荒海や　佐渡によこたふ　天河", author: BASHO }] },
      { word: "虫の音", reading: "むしのね", meaning: "秋の夜に聞こえる虫の声", examples: [] },
    ],
  },
  {
    season: "冬",
    items: [
      { word: "雪", reading: "ゆき", meaning: "冬を代表する景物", examples: [{ verse: "いくたびも　雪の深さを　尋ねけり", author: SHIKI }, { verse: "是がまあ　つひの栖か　雪五尺", author: ISSA }] },
      { word: "枯野", reading: "かれの", meaning: "草木の枯れはてた冬の野", examples: [{ verse: "旅に病んで　夢は枯野を　かけ廻る", author: BASHO }] },
      { word: "凩", reading: "こがらし", meaning: "初冬に吹く、冷たく強い風", examples: [{ verse: "凩の　果はありけり　海の音", author: "池西言水" }] },
      { word: "冬灯", reading: "ふゆともし", meaning: "寒い夜にともる明かり", examples: [] },
      { word: "小春", reading: "こはる", meaning: "初冬の、春のように暖かい日", examples: [] },
    ],
  },
];
