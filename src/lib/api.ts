import type { Effect } from "./effects";
import type { ApiImage } from "./media";

export type Season = "spring" | "summer" | "autumn" | "winter" | "newyear" | "none";

export type Style = "wakamono" | "hashagu" | "wabisabi" | "shibui";

export const STYLE_LABEL: Record<Style, string> = {
  wakamono: "若者ことば",
  hashagu: "はしゃぎ口語",
  wabisabi: "侘び寂び",
  shibui: "渋い",
};

export type Analysis = {
  mainSubject: string;
  people: string;
  keyPoints: string[];
  scene: string;
  mood: string;
  style: Style;
  styleReason: string;
  season: Season;
  effect: Effect;
  subject: { x: number; y: number; w: number; h: number } | null;
};

export type HaikuResult = {
  lines: string[];
  readings: string[];
  mora: number[];
  ok: boolean;
  kigo: string;
  season: Season;
  note: string;
  subject: { x: number; y: number; w: number; h: number } | null;
  /** 自分で詠んだ句で、写真を読み取っていないときは無い */
  analysis?: Analysis;
  attempts: number;
  mock?: boolean;
  /** 利用者が自分で詠んだ句 */
  self?: boolean;
};

export type Critique = {
  shibusa: number;
  title: string;
  good: string;
  improve: string;
  revision: { lines: string[]; reason: string } | null;
  mock?: boolean;
};

export type HaikuParams = {
  images: ApiImage[];
  isVideo: boolean;
  moods: string[];
  notes: string;
  season: Season | "auto";
  previous?: { lines: string[] };
  extraConditions?: string[];
  analysis?: Analysis;
  style?: Style;
};

export type MoraResult = {
  ok: boolean;
  mora: number[];
  readings: string[];
  uncertain: boolean[];
};

const PASSCODE_KEY = "passcode";

export function getPasscode(): string {
  try {
    return localStorage.getItem(PASSCODE_KEY) ?? "";
  } catch {
    return memoryPasscode;
  }
}

let memoryPasscode = "";

export function setPasscode(v: string) {
  memoryPasscode = v;
  try {
    if (v) localStorage.setItem(PASSCODE_KEY, v);
    else localStorage.removeItem(PASSCODE_KEY);
  } catch {
    /* 保存できない環境ではこの画面を開いている間だけ覚えておく */
  }
}

/** 合言葉が違うと言われたときに、入力画面へ戻すための合図 */
export class PasscodeError extends Error {}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-passcode": getPasscode() || memoryPasscode },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && json.code === "passcode") throw new PasscodeError(json.error);
  if (!res.ok) throw new Error(json.error ?? `通信に失敗しました（${res.status}）`);
  return json as T;
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  const res = await fetch("/api/passcode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode }),
  });
  if (res.status === 429) throw new Error("試行回数が多すぎます。1分ほど待ってください。");
  return res.ok;
}

export const analyzeImage = (p: Omit<HaikuParams, "previous" | "extraConditions" | "analysis">) => post<Analysis>("/api/analyze", p);

export const generateHaiku = (p: HaikuParams) => post<HaikuResult>("/api/haiku", p);

export const critiqueHaiku = (images: ApiImage[], lines: string[]) => post<Critique>("/api/critique", { images, lines });

export const countMora = (lines: string[], readings: string[], signal?: AbortSignal) =>
  post<MoraResult>("/api/mora", { lines, readings }, signal);

export async function fetchStatus(): Promise<{ mock: boolean; passcode: boolean }> {
  try {
    const res = await fetch("/api/status");
    return await res.json();
  } catch {
    return { mock: false, passcode: false };
  }
}
