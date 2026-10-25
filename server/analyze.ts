import Anthropic from "@anthropic-ai/sdk";

export type Style = "wakamono" | "hashagu" | "wabisabi" | "shibui";
export type Effect = "sakura" | "hanabi" | "momiji" | "yuki" | "kinpaku" | "none";
export type Rect = { x: number; y: number; w: number; h: number };

export type Analysis = {
  /** 写真の主役（人物やもの）を一言で */
  mainSubject: string;
  /** 人物の年代・表情・動き。いなければ「なし」 */
  people: string;
  /** 句で扱うべき要素 */
  keyPoints: string[];
  scene: string;
  mood: string;
  style: Style;
  styleReason: string;
  season: "spring" | "summer" | "autumn" | "winter" | "newyear" | "none";
  effect: Effect;
  subject: Rect | null;
};

export type AnalyzeInput = {
  images: { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }[];
  isVideo?: boolean;
  moods?: string[];
  notes?: string;
  season?: string;
};

const MODEL = process.env.HAIKU_MODEL ?? "claude-sonnet-5-5";
const EFFORT = (process.env.HAIKU_EFFORT ?? "low") as "low" | "medium" | "high";

const SYSTEM = `あなたは写真を読み解く編集者です。俳句を詠む前の下調べとして、写真（動画なら切り出した場面）と、撮った人が添えた気持ちや文章から、句にすべき場面を正確に読み取ります。

読み取ること:
- mainSubject: 写真の主役は誰か、何か。人物なら、どの人が何をしているか。20字以内で。
- people: 写っている人の年代、表情、動き、はしゃぎ具合。いなければ「なし」。
- keyPoints: 句で扱うべき要素を2〜4個。主役の動作、目を引く小物、光や天気など、具体的に。撮った人の文章に書かれたことは必ず含める。
- scene: 場所、時間帯、天気。
- mood: 場の空気を一言で。
- style: 句の言葉づかい。次の基準で一つ選ぶ。
  - wakamono: 楽しそうな若者が主役。若者言葉やカタカナ語、SNS の言い回しが似合う。
  - hashagu: 大人でも子供のようにはしゃいでいる、子供が遊んでいる、宴会やイベントで盛り上がっている。弾む口語や擬音が似合う。
  - wabisabi: 落ち着いた大人、静かな風景、ひとりの時間。侘び寂びの効いた文語が似合う。
  - shibui: 夜の街、酒場、仕事帰り、雨、煙、古い機械や道具など、大人の哀愁や硬派な空気がある。寡黙でハードボイルドな言い切りが似合う。
  迷ったら、写っている人の表情と動きの勢いで決める。撮った人の気持ちが「喜」や「楽」なら明るい側に、「哀」なら静かな側に寄せる。
- styleReason: そう判断した理由を一言。
- season: 写真から読み取れる季節。撮った人が季節を指定していればそれに従う。
- effect: 仕上げに重ねる派手な演出。原則として必ず選ぶ。春は sakura、夏は hanabi、秋は momiji、冬は yuki、正月やお祝いは kinpaku を基本に、場面に合うものを選ぶ。弔事など、演出が明らかに場にそぐわない場合だけ none。
- subject: 主役で文字をかぶせてはいけない範囲を、画像の左上を0、右下を1とした割合で書く。人の顔は必ず含める。動画なら全場面を通して主役が動く範囲。`;

const SCHEMA = {
  type: "object",
  properties: {
    mainSubject: { type: "string" },
    people: { type: "string" },
    keyPoints: { type: "array", items: { type: "string" } },
    scene: { type: "string" },
    mood: { type: "string" },
    style: { type: "string", enum: ["wakamono", "hashagu", "wabisabi", "shibui"] },
    styleReason: { type: "string" },
    season: { type: "string", enum: ["spring", "summer", "autumn", "winter", "newyear", "none"] },
    effect: { type: "string", enum: ["sakura", "hanabi", "momiji", "yuki", "kinpaku", "none"] },
    subject: {
      type: "object",
      properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } },
      required: ["x", "y", "w", "h"],
      additionalProperties: false,
    },
  },
  required: ["mainSubject", "people", "keyPoints", "scene", "mood", "style", "styleReason", "season", "effect", "subject"],
  additionalProperties: false,
} as const;

const SEASON_JA: Record<string, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬", newyear: "新年" };

export function normalizeRect(r: Rect | undefined | null): Rect | null {
  if (!r || ![r.x, r.y, r.w, r.h].every(Number.isFinite)) return null;
  const c = (v: number) => Math.max(0, Math.min(1, v));
  const x = c(r.x);
  const y = c(r.y);
  const w = c(r.w);
  const h = c(r.h);
  if (w <= 0 || h <= 0) return null;
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

export function imageBlocks(images: AnalyzeInput["images"]): Anthropic.Beta.BetaImageBlockParam[] {
  return images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } }));
}

export async function analyzeImage(client: Anthropic | null, input: AnalyzeInput): Promise<Analysis> {
  if (!client) return mockAnalysis(input);

  const lines = [input.isVideo ? "動画から切り出した場面です。" : "この写真を読み解いてください。"];
  if (input.moods?.length) lines.push(`撮った人の気持ち: ${input.moods.join("、")}`);
  if (input.notes?.trim()) lines.push(`撮った人の文章: ${input.notes.trim()}`);
  if (input.season && SEASON_JA[input.season]) lines.push(`撮った人が指定した季節: ${SEASON_JA[input.season]}`);

  const message = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: EFFORT, format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: [...imageBlocks(input.images), { type: "text", text: lines.join("\n") }] }],
  });
  if (message.stop_reason === "refusal") {
    throw new Error("この素材は読み取れませんでした。別の写真でお試しください。");
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const raw = JSON.parse(text) as Analysis;
  return { ...raw, keyPoints: raw.keyPoints.slice(0, 4), subject: normalizeRect(raw.subject) };
}

async function mockAnalysis(input: AnalyzeInput): Promise<Analysis> {
  await new Promise((r) => setTimeout(r, 900));
  const season = (input.season && input.season !== "auto" ? input.season : "autumn") as Analysis["season"];
  const effect: Record<string, Effect> = { spring: "sakura", summer: "hanabi", autumn: "momiji", winter: "yuki", newyear: "kinpaku" };
  return {
    mainSubject: "夕暮れのビル街",
    people: "なし",
    keyPoints: ["沈みかけた夕日", "並ぶビルの影", input.notes?.trim() || "静かな帰り道"],
    scene: "街中、夕方、晴れ",
    mood: "一日の終わりの静けさ",
    style: "wabisabi",
    styleReason: "人がいない静かな夕景のため",
    season,
    effect: effect[season] ?? "none",
    // 見本モードでは、確認用の画像で人物を置いている場所を主役とする
    subject: { x: 0.12, y: 0.5, w: 0.32, h: 0.45 },
  };
}
