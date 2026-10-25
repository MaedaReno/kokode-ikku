export type Scene = "city" | "rain" | "night" | "station" | "room" | "riverside";

export type Post = {
  id: string;
  author: string;
  lines: string[];
  scene: Scene;
  likes: number;
  ago: string;
};

/** 投稿機能ができるまでの見本。句と俳号は架空のもの */
export const SAMPLE_POSTS: Post[] = [
  { id: "s1", author: "路地裏亭", lines: ["夕立や", "傘を持たない", "背中たち"], scene: "rain", likes: 128, ago: "3分前" },
  { id: "s2", author: "夜更け", lines: ["冬灯", "コンビニだけが", "起きている"], scene: "night", likes: 96, ago: "18分前" },
  { id: "s3", author: "坂の人", lines: ["秋の暮", "自転車押して", "坂の上"], scene: "city", likes: 74, ago: "1時間前" },
  { id: "s4", author: "千葉の雀", lines: ["春雨や", "駅の時計の", "遅れがち"], scene: "station", likes: 61, ago: "2時間前" },
  { id: "s5", author: "古書店主", lines: ["風鈴の", "音だけ残る", "空き家かな"], scene: "room", likes: 52, ago: "昨日" },
  { id: "s6", author: "雨宿り", lines: ["蝉しぐれ", "部室の鍵を", "返しけり"], scene: "riverside", likes: 40, ago: "2日前" },
];
