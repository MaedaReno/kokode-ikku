import { analyzeHaiku } from "../server/mora.js";
const cases: string[][] = [
  ["古池や", "蛙飛び込む", "水の音"],
  ["柿食えば", "鐘が鳴るなり", "法隆寺"],
  ["閑さや", "岩にしみ入る", "蝉の声"],
  ["夏草や", "兵どもが", "夢の跡"],
  ["秋の暮", "缶の珈琲", "ぬるく持つ"],
  ["エナジードリンク", "徹夜の机", "しずかなり"],
];
for (const c of cases) {
  const r = await analyzeHaiku(c);
  console.log(c.join(" "), r.lines.map((l) => `${l.reading}(${l.mora}${l.uncertain ? "?" : ""})`).join(" / "), r.ok ? "OK" : "NG");
}
