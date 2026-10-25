import { splitsWord } from "../server/mora.js";
for (const l of [["ビルの間や", "うすき月のぼ", "る夕暮"], ["茜空", "ビルのあひだに", "ほの月"], ["古池や", "蛙飛びこむ", "水の音"], ["夕立や", "傘を持たない", "背中たち"], ["秋の暮", "ぬるき缶手に", "帰りけり"]]) {
  console.log(l.join("/"), (await splitsWord(l)) ? "単語の途中で切れている" : "OK");
}
