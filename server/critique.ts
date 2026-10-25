import Anthropic from "@anthropic-ai/sdk";
import { imageBlocks } from "./analyze.js";
import { analyzeHaiku } from "./mora.js";

export type CritiqueRequest = {
  images: { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }[];
  lines: string[];
};

export type Critique = {
  /** 渋さの点数。0〜100 */
  shibusa: number;
  /** 点数に添える一言の称号。例: 「いぶし銀」 */
  title: string;
  good: string;
  improve: string;
  /** 直した一案。五七五に収まらなかったときは null */
  revision: { lines: string[]; reason: string } | null;
  mock?: boolean;
};

const MODEL = process.env.HAIKU_MODEL ?? "claude-sonnet-5-5";

const SYSTEM = `あなたは句会の選者です。写真に添えて利用者が自分で詠んだ一句を講評します。

方針:
- まず良いところを具体的に一つ褒める。言葉の選び方、写真との響き合い、季語の効き方など。
- 次に、直すともっと良くなるところを一つだけ、やさしく具体的に言う。
- 口調は、気さくだが品のある先生。長くしない。good と improve はそれぞれ60字以内。
- shibusa は句の渋さを0〜100で採点する。寡黙さ、余韻、言い切りの強さ、季語の重み、大人の哀愁が高いほど高い。明るくはしゃいだ句は低くてよいが、それは欠点ではない。
- title は点数に添える称号を8字以内で。例: 「いぶし銀」「燻製級の渋み」「まだ青い柿」「縁側の老師」。
- revision は、利用者の句の良さを残して直した一案。上五5音、中七7音、下五5音ちょうどにする。音数を合わせるために語を途中で切らない。reason に直した意図を30字以内で書く。`;

const SCHEMA = {
  type: "object",
  properties: {
    shibusa: { type: "integer" },
    title: { type: "string" },
    good: { type: "string" },
    improve: { type: "string" },
    revision: {
      type: "object",
      properties: {
        kami: { type: "string" },
        naka: { type: "string" },
        shimo: { type: "string" },
        reason: { type: "string" },
      },
      required: ["kami", "naka", "shimo", "reason"],
      additionalProperties: false,
    },
  },
  required: ["shibusa", "title", "good", "improve", "revision"],
  additionalProperties: false,
} as const;

type Raw = {
  shibusa: number;
  title: string;
  good: string;
  improve: string;
  revision: { kami: string; naka: string; shimo: string; reason: string };
};

export async function critique(client: Anthropic | null, req: CritiqueRequest): Promise<Critique> {
  if (!client) {
    return {
      shibusa: 72,
      title: "いぶし銀",
      good: "景色を説明しすぎず、最後の五音で気分を言い切ったのが効いています。",
      improve: "中七に動きのある言葉を入れると、写真の一瞬がもっと立ち上がります。",
      revision: { lines: ["秋の暮", "缶をころがす", "指の先"], reason: "仕草に気持ちを託した" },
      mock: true,
    };
  }
  const message = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [...imageBlocks(req.images.slice(0, 3)), { type: "text", text: `利用者の句: ${req.lines.join("　")}` }],
      },
    ],
  });
  if (message.stop_reason === "refusal") throw new Error("この句は講評できませんでした。");
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const raw = JSON.parse(text) as Raw;

  // 添削案も五七五をコードで確かめ、外れていれば出さない
  const lines = [raw.revision.kami, raw.revision.naka, raw.revision.shimo].map((l) => l.trim());
  const same = lines.join("") === req.lines.join("");
  const { ok } = await analyzeHaiku(lines);
  return {
    shibusa: Math.max(0, Math.min(100, Math.round(raw.shibusa))),
    title: raw.title,
    good: raw.good,
    improve: raw.improve,
    revision: ok && !same ? { lines, reason: raw.revision.reason } : null,
  };
}
