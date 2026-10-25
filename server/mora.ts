import kuromoji from "kuromoji";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dicPath = path.join(path.dirname(require.resolve("kuromoji/package.json")), "dict");

type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

let tokenizerPromise: Promise<Tokenizer> | null = null;

export function getTokenizer(): Promise<Tokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    });
  }
  return tokenizerPromise;
}

const SMALL_KANA = new Set("ァィゥェォャュョヮぁぃぅぇぉゃゅょゎ");

function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

function isKana(c: string): boolean {
  return /[ぁ-ゖァ-ヺー]/.test(c);
}

export function countKanaMora(kana: string): number {
  let n = 0;
  for (const c of toKatakana(kana)) {
    if (!isKana(c)) continue;
    if (SMALL_KANA.has(c)) continue;
    n++;
  }
  return n;
}

export type LineMora = {
  text: string;
  reading: string;
  mora: number;
  /** 辞書に読みがなく、推定に頼った語があるか */
  uncertain: boolean;
};

/**
 * LLM は読みを付けるのは得意だが音を数えるのは苦手なので、
 * 読みが渡されたらそれを優先し、数えるのはこちらで行う。
 */
export async function analyzeLine(text: string, givenReading?: string): Promise<LineMora> {
  if (givenReading && givenReading.trim()) {
    const reading = toKatakana(givenReading.replace(/\s+/g, ""));
    return { text, reading, mora: countKanaMora(reading), uncertain: false };
  }
  const tokenizer = await getTokenizer();
  const tokens = tokenizer.tokenize(text.replace(/\s+/g, ""));
  let reading = "";
  let uncertain = false;
  for (const t of tokens) {
    if (t.reading && t.reading !== "*") {
      reading += t.reading;
    } else if ([...t.surface_form].every((c) => isKana(c) || !/\p{L}/u.test(c))) {
      reading += toKatakana(t.surface_form);
    } else {
      uncertain = true;
      reading += t.surface_form;
    }
  }
  return { text, reading, mora: countKanaMora(reading), uncertain };
}

export const TARGET = [5, 7, 5] as const;

export async function analyzeHaiku(lines: string[], readings?: string[]) {
  const result = await Promise.all(lines.map((l, i) => analyzeLine(l, readings?.[i])));
  const ok = result.every((r, i) => r.mora === TARGET[i]);
  return { lines: result, ok };
}

/** 句の切れ目が単語の途中に来ていないか。「のぼ／る」のような分け方を見つける */
export async function splitsWord(lines: string[]): Promise<boolean> {
  const tokenizer = await getTokenizer();
  const clean = lines.map((l) => l.replace(/\s+/g, ""));
  const tokens = tokenizer.tokenize(clean.join(""));
  const starts = new Set<number>();
  let pos = 0;
  for (const t of tokens) {
    starts.add(pos);
    pos += t.surface_form.length;
  }
  starts.add(pos);
  let cut = 0;
  for (const l of clean.slice(0, -1)) {
    cut += l.length;
    if (!starts.has(cut)) return true;
  }
  return false;
}

/** 句末に来ると、文が途中で止まって聞こえる助詞。「〜を」「〜に」「〜ば」など */
const DANGLING = new Set(["を", "に", "へ", "が", "と", "で", "の", "ば", "ても", "でも"]);

/**
 * 句全体が途中で切れたように終わっていないか。
 * 辞書は崩した言葉を誤って読むことがあるので、確実に分かる形だけを見る。残りは AI の判定に任せる。
 */
export async function endsAbruptly(lines: string[]): Promise<boolean> {
  const tokenizer = await getTokenizer();
  const text = lines.join("").replace(/[\s！!？?。、…ー〜]+$/u, "");
  const tokens = tokenizer.tokenize(text);
  const last = tokens[tokens.length - 1];
  if (!last) return true;
  if (last.pos === "助詞" && (last.pos_detail_1 === "格助詞" || last.pos_detail_1 === "接続助詞" || last.pos_detail_1 === "連体化") && DANGLING.has(last.surface_form)) {
    return true;
  }
  return false;
}
