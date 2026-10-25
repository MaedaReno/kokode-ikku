import Anthropic from "@anthropic-ai/sdk";
import { analyzeHaiku, endsAbruptly, splitsWord, TARGET } from "./mora.js";
import { analyzeImage, imageBlocks, type Analysis, type Style } from "./analyze.js";

export type Season = "spring" | "summer" | "autumn" | "winter" | "newyear" | "none";

export type HaikuRequest = {
  images: { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }[];
  isVideo?: boolean;
  moods?: string[];
  notes?: string;
  season?: Season | "auto";
  previous?: { lines: string[] };
  extraConditions?: string[];
  /** 先に済ませた画像の分析。なければここで分析する */
  analysis?: Analysis;
  /** 利用者が選んだ文体。分析の判断より優先する */
  style?: Style;
};

export type HaikuResult = {
  lines: string[];
  readings: string[];
  mora: number[];
  ok: boolean;
  kigo: string;
  season: Season;
  note: string;
  /** 隠してはいけない主役の範囲。画像の幅と高さを1とした割合 */
  subject: { x: number; y: number; w: number; h: number } | null;
  analysis: Analysis;
  attempts: number;
  mock?: boolean;
};

const MODEL = process.env.HAIKU_MODEL ?? "claude-sonnet-5-5";
const EFFORT = (process.env.HAIKU_EFFORT ?? "low") as "low" | "medium" | "high";
/** 候補をまとめて出させ、型に収まるものをコードで選ぶ。全滅したらずれを伝えて詠み直させる */
const CANDIDATES = 4;
const MAX_ROUNDS = 3;

export const isMock =
  process.env.MOCK === "1" || (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN);

export const client = isMock ? null : new Anthropic();

const SYSTEM = `あなたは、写真に一句添える現代の俳人です。写真（動画なら切り出した場面）と、事前に済ませた画像の分析をもとに句を詠みます。

方針:
- 分析で示された主役と要素を中心に詠む。主役ではないものを主題にしない。
- 写っているものを並べて説明するのではなく、その場の一瞬の空気や気分を切り取る。
- 季語か、季節を感じる言葉を一つ入れる。伝統的な季語でなくてもよい。
- 撮った人の気持ちや文章は、句の内容や調子に必ず反映する。
- 言葉づかいは、分析で決めた文体に従う。俳句らしくない言葉づかいでもよい。派手で今っぽい言葉を恐れない。
- 追加条件がある場合は、前の句の良さを残しつつ条件を満たすように詠み直す。

音の数（最重要）:
- 上五は5音、中七は7音、下五は5音。これより長い句は失格になる。
- 音の数え方: かな1文字が1音。ただし小さい「ゃ・ゅ・ょ・ぁ・ぃ・ぅ・ぇ・ぉ」は前の文字と合わせて1音。「っ」「ん」「ー」はそれぞれ1音。カタカナ語も同じ数え方。
- 中七に言葉を詰め込みすぎない。描写は一つに絞る。
- 各句は、先に音を1音ずつ配列に書き出してから（kami_on, naka_on, shimo_on）、その音に合う表記を書く。配列の要素は、上五なら5個、中七なら7個、下五なら5個ちょうど。拗音は「きゃ」のように1要素にまとめる。
- 中七に下五の言葉を入れない。三つの句は、それぞれ独立した区切りにする。単語の途中で句を分けない（「のぼ／る」は失格）。
- 音数を合わせるために、言葉を途中で切ったり、語尾を削ったりしない。たとえば「釣れない」を「つれ」、「最高だ」を「さいこ」にするのは失格。助詞（を・に・で・ば など）で途切れたまま終えるのも失格。
- 下五は、名詞止め、言い切り、終助詞、切れ字などで、句として終わった形にする。書いたら句全体を声に出して読み、自然な日本語として意味が通るか確かめる。

出力:
- candidates に、違う言い回しの候補を${CANDIDATES}つ、良いと思う順に並べる。どれも上の方針と音の数を守る。
- 各候補の note には、句に込めた場面や気分を40字以内で一言書く。文体に合わせた口調でよい。`;

const STYLE_GUIDE: Record<Style, string> = {
  wakamono:
    "テンション最大の若者言葉の句にする。上品さはいらない。友達同士のノリで、ネットスラング、カタカナ語、略語、叫び、「〜すぎ」「マジ」「ガチ」「エグい」「優勝」「爆〇〇」「〜しか勝たん」「ぶち上げ」「神」のような言い回しを大胆に使う。語尾も「〜じゃん」「〜っしょ」「〜すぎん？」など思い切りくだけてよい。「！」も使ってよい。静かで無難な表現や、文語、切れ字は使わない。",
  hashagu:
    "はしゃぐ楽しさが爆発する句にする。擬音や擬態語（わちゃわちゃ、どかーん、きゃっきゃ等）、呼びかけ、叫び、子供のような無邪気な言葉を大胆に使う。「！」も使ってよい。落ち着いた表現や古風な言い回しは使わない。",
  wabisabi:
    "侘び寂びの効いた句にする。文語や切れ字（や・かな・けり）も使い、静けさや余白、ものの移ろいを感じさせる言葉を選ぶ。流行語は使わない。",
  shibui:
    "渋い大人の句にする。寡黙でハードボイルド。多くを語らず、名詞止めや短い言い切りで決める。哀愁、孤独、意地、やせ我慢をにじませ、感情は直接言わずに物や仕草に託す。漢語や硬い言葉を選び、季語は重く効かせる。若者言葉、カタカナの流行語、擬音、「！」、甘い言葉は使わない。",
};

const STYLES = new Set<Style>(["wakamono", "hashagu", "wabisabi", "shibui"]);

const CANDIDATE_SCHEMA = {
  type: "object",
  properties: {
    kami_on: { type: "array", items: { type: "string" }, description: "上五の音を1音ずつ。ちょうど5個" },
    kami: { type: "string", description: "上五の表記" },
    naka_on: { type: "array", items: { type: "string" }, description: "中七の音を1音ずつ。ちょうど7個" },
    naka: { type: "string", description: "中七の表記" },
    shimo_on: { type: "array", items: { type: "string" }, description: "下五の音を1音ずつ。ちょうど5個" },
    shimo: { type: "string", description: "下五の表記" },
    kigo: { type: "string" },
    season: { type: "string", enum: ["spring", "summer", "autumn", "winter", "newyear", "none"] },
    note: { type: "string" },
  },
  required: ["kami_on", "kami", "naka_on", "naka", "shimo_on", "shimo", "kigo", "season", "note"],
  additionalProperties: false,
} as const;

const SCHEMA = {
  type: "object",
  properties: {
    candidates: { type: "array", items: CANDIDATE_SCHEMA },
  },
  required: ["candidates"],
  additionalProperties: false,
} as const;

type RawCandidate = {
  kami_on: string[];
  kami: string;
  naka_on: string[];
  naka: string;
  shimo_on: string[];
  shimo: string;
  kigo: string;
  season: Season;
  note: string;
};

type Raw = {
  candidates: RawCandidate[];
};

const SEASON_JA: Record<string, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
  newyear: "新年",
};

const PART = ["上五", "中七", "下五"];

function buildUserText(req: HaikuRequest, a: Analysis): string {
  const parts: string[] = [];
  parts.push(
    [
      "画像の分析:",
      `- 主役: ${a.mainSubject}`,
      `- 人物: ${a.people}`,
      `- 句で扱う要素: ${a.keyPoints.join("、")}`,
      `- 場面: ${a.scene}`,
      `- 空気: ${a.mood}`,
      `- 文体: ${STYLE_GUIDE[a.style]}`,
    ].join("\n"),
  );
  parts.push(
    req.isVideo
      ? "これは動画から切り出した場面です。時間の流れも感じ取って詠んでください。"
      : "この写真の場面で詠んでください。",
  );
  if (req.moods?.length) parts.push(`気持ち: ${req.moods.join("、")}`);
  if (req.notes?.trim()) parts.push(`補足情報: ${req.notes.trim()}`);
  if (req.season && req.season !== "auto" && SEASON_JA[req.season]) {
    parts.push(`季節: ${SEASON_JA[req.season]}`);
  }
  if (req.previous) {
    parts.push(`前に詠んだ句: ${req.previous.lines.join(" ")}`);
  }
  if (req.extraConditions?.length) {
    parts.push(`追加条件:\n${req.extraConditions.map((c) => `- ${c}`).join("\n")}`);
  }
  return parts.join("\n");
}

function parseRaw(message: Anthropic.Beta.BetaMessage): Raw {
  if (message.stop_reason === "refusal") {
    throw new Error("この素材では句を詠めませんでした。別の写真でお試しください。");
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text) as Raw;
}

type Checked = {
  cand: RawCandidate;
  lines: string[];
  readings: string[];
  mora: number[];
  broken: boolean;
  /** 助詞で途切れるなど、句が終わっていない */
  abrupt: boolean;
  exact: boolean;
  acceptable: boolean;
  /** AI に聞いた、日本語として不自然な理由。自然なら null */
  unnatural?: string | null;
};

/**
 * 型の判定。五七五ぴったりか、どこか1句だけ1音多い字余りまでを認める。
 * 読みは LLM のものを数えるが、読みを短く書いてごまかしていないか、辞書の読みでも数えて確かめる。
 */
async function check(cand: RawCandidate): Promise<Checked> {
  const lines = [cand.kami, cand.naka, cand.shimo].map((x) => x.trim());
  const readings = [cand.kami_on, cand.naka_on, cand.shimo_on].map((on) => on.join("").replace(/\s+/g, ""));
  const byReading = await analyzeHaiku(lines, readings);
  const byDict = await analyzeHaiku(lines);
  const mora = byReading.lines.map((l, i) => {
    const d = byDict.lines[i];
    return !d.uncertain && Math.abs(d.mora - l.mora) >= 2 ? Math.max(d.mora, l.mora) : l.mora;
  });
  const over = mora.map((m, i) => m - TARGET[i]);
  const broken = await splitsWord(lines);
  const abrupt = await endsAbruptly(lines);
  const exact = !broken && !abrupt && over.every((o) => o === 0);
  const acceptable = !broken && !abrupt && over.every((o) => o === 0 || o === 1) && over.filter((o) => o === 1).length <= 1;
  return { cand, lines, readings, mora, broken, abrupt, exact, acceptable };
}

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          natural: { type: "boolean" },
          reason: { type: "string", description: "不自然なときだけ、どこがおかしいかを20字以内で" },
        },
        required: ["natural", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

/**
 * 型に収まった候補が、日本語として最後まで言い切れているかを AI に確かめる。
 * 音数合わせで語尾を削った句（「ぜんぜんつれ」など）は、辞書では見抜けないため。
 * 確かめられなかったときは、全部を自然とみなして先に進む。
 */
export async function judgeNatural(cands: Checked[]): Promise<void> {
  if (!client || cands.length === 0) return;
  const list = cands.map((c, i) => `${i + 1}. ${c.lines.join(" ")}`).join("\n");
  try {
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "あなたは俳句の校正者です。口語、若者言葉、ネットスラング、擬音、文語、切れ字はどれも認めます。判定するのは、日本語として意味が通り、最後まで言い切れているかだけです。音数を合わせるために語が途中で切られている（例: 「釣れない」を「つれ」にする）、活用語尾や助詞が欠けて文が途切れている、語の並びが壊れて意味が取れない、のどれかなら不自然とします。",
      output_config: { effort: "low", format: { type: "json_schema", schema: JUDGE_SCHEMA } },
      messages: [{ role: "user", content: `次の句を、番号順にそれぞれ判定してください。\n${list}` }],
    });
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const { results } = JSON.parse(text) as { results: { natural: boolean; reason: string }[] };
    cands.forEach((c, i) => {
      const r = results[i];
      c.unnatural = r && !r.natural ? r.reason || "不自然" : null;
    });
  } catch (e) {
    console.warn("[haiku] 自然さの確認に失敗したため省略:", e instanceof Error ? e.message : e);
  }
}

export async function generateHaiku(req: HaikuRequest): Promise<HaikuResult> {
  const analyzed =
    req.analysis ??
    (await analyzeImage(client, { images: req.images, isVideo: req.isVideo, moods: req.moods, notes: req.notes, season: req.season }));
  const analysis: Analysis = req.style && STYLES.has(req.style) ? { ...analyzed, style: req.style } : analyzed;
  if (!client) return mockHaiku(req, analysis);

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        ...imageBlocks(req.images),
        { type: "text", text: buildUserText(req, analysis) },
      ],
    },
  ];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: EFFORT, format: { type: "json_schema", schema: SCHEMA } },
      messages,
    });
    const raw = parseRaw(message);
    const checked = await Promise.all(raw.candidates.map(check));
    await judgeNatural(checked.filter((c) => c.acceptable));
    console.log(
      `[haiku] round ${round}: ${checked
        .map((c) => `${c.lines.join("/")}(${c.mora.join("-")}${c.abrupt ? " 途切れ" : ""}${c.unnatural ? ` 不自然:${c.unnatural}` : ""})`)
        .join(" | ")}`,
    );

    // 良い順に並んでいるので、まず五七五ぴったりの最上位、なければ字余りの最上位を採る
    const usable = checked.filter((c) => !c.unnatural);
    const pick = usable.find((c) => c.exact) ?? usable.find((c) => c.acceptable);
    if (pick) {
      return {
        lines: pick.lines,
        readings: pick.readings,
        mora: pick.mora,
        ok: pick.exact,
        kigo: pick.cand.kigo,
        season: pick.cand.season,
        note: pick.cand.note,
        subject: analysis.subject,
        analysis,
        attempts: round,
      };
    }

    const wrong = checked
      .slice(0, 3)
      .map(
        (c, k) =>
          `候補${k + 1}: ${c.mora
            .map((m, i) => `${PART[i]}「${c.readings[i]}」${m}音`)
            .join("、")}${c.broken ? "（単語の途中で句が切れている）" : ""}${c.abrupt ? "（助詞で途切れて終わっている）" : ""}${
            c.unnatural ? `（日本語として不自然: ${c.unnatural}）` : ""
          }`,
      )
      .join("\n");
    messages.push({ role: "assistant", content: message.content });
    messages.push({
      role: "user",
      content: `使える候補がありませんでした。\n${wrong}\n長すぎる句は言葉を削り、上五5音・中七7音・下五5音ちょうどで詠み直してください。音数を合わせるために語を途中で切るのは禁止です。言葉を入れ替えて、最後まで言い切った句にしてください。新しい候補を${CANDIDATES}つ出してください。`,
    });
  }
  throw new Error("五七五に収まる句を詠めませんでした。もう一度お試しください。");
}

const MOCKS: Record<Season, Omit<HaikuResult, "mora" | "ok" | "attempts" | "subject" | "analysis">> = {
  spring: {
    lines: ["春の昼", "誰も座らぬ", "長椅子に"],
    readings: ["はるのひる", "だれもすわらぬ", "ながいすに"],
    kigo: "春の昼",
    season: "spring",
    note: "空いた椅子に、春ののどけさだけが腰かけている。",
  },
  summer: {
    lines: ["炎昼や", "影を踏まずに", "ひとり行く"],
    readings: ["えんちゅうや", "かげをふまずに", "ひとりゆく"],
    kigo: "炎昼",
    season: "summer",
    note: "照りつける昼、影さえ避けて歩く背中。",
  },
  autumn: {
    lines: ["秋の暮", "缶の珈琲", "ぬるく持つ"],
    readings: ["あきのくれ", "かんのこーひー", "ぬるくもつ"],
    kigo: "秋の暮",
    season: "autumn",
    note: "飲み干せないまま、夕暮れだけが深くなる。",
  },
  winter: {
    lines: ["冬灯", "消し忘れたる", "部屋ひとつ"],
    readings: ["ふゆともし", "けしわすれたる", "へやひとつ"],
    kigo: "冬灯",
    season: "winter",
    note: "夜更けの窓に、誰かの気配だけが残っている。",
  },
  newyear: {
    lines: ["初空や", "昨日と同じ", "電線に"],
    readings: ["はつぞらや", "きのうとおなじ", "でんせんに"],
    kigo: "初空",
    season: "newyear",
    note: "特別な朝も、見慣れた景色の上に広がる。",
  },
  none: {
    lines: ["秋の暮", "缶の珈琲", "ぬるく持つ"],
    readings: ["あきのくれ", "かんのこーひー", "ぬるくもつ"],
    kigo: "秋の暮",
    season: "autumn",
    note: "飲み干せないまま、夕暮れだけが深くなる。",
  },
};

async function mockHaiku(req: HaikuRequest, analysis: Analysis): Promise<HaikuResult> {
  await new Promise((r) => setTimeout(r, 1200));
  const season = req.season && req.season !== "auto" ? req.season : "autumn";
  const base = MOCKS[season];
  const counted = await analyzeHaiku(base.lines, base.readings);
  return {
    ...base,
    mora: counted.lines.map((l) => l.mora),
    ok: counted.ok,
    subject: analysis.subject,
    analysis,
    attempts: 1,
    mock: true,
  };
}
