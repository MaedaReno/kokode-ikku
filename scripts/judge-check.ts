// 途切れた句を見抜けるか確かめる。API を少しだけ使う
import { judgeNatural } from "../server/haiku.js";
import { endsAbruptly } from "../server/mora.js";

const samples = [
  ["網かまえ", "ガチでにらむよ", "ぜんぜんつれ"],
  ["エグい鯛", "釣ったぜみんな", "爆上がり"],
  ["春の宵", "全員主役", "神すぎん"],
  ["古池や", "蛙飛びこむ", "水の音"],
  ["夕焼けの", "ビルの谷間で", "みんなで"],
  ["マジ鯛だ", "釣れすぎてもう", "さいこう"],
];
for (const s of samples) console.log(s.join(" "), "途切れ:", await endsAbruptly(s));
const cands = samples.map((lines) => ({ lines }) as never);
await judgeNatural(cands);
for (const c of cands as { lines: string[]; unnatural?: string | null }[]) console.log(c.lines.join(" "), "→", c.unnatural ?? "自然");
