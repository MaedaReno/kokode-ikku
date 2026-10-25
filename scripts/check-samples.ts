import { analyzeHaiku } from "../server/mora.js";
import { SAMPLE_POSTS } from "../src/lib/feed.js";
for (const p of SAMPLE_POSTS) {
  const r = await analyzeHaiku(p.lines);
  console.log(p.lines.join(" "), r.lines.map((l) => `${l.reading}(${l.mora})`).join(" "), r.ok ? "OK" : "NG");
}
