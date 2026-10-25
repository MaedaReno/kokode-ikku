import { useEffect, useState } from "react";
import type { Gafu } from "./finish";
import type { FontStyle } from "./render";
import type { Style } from "./api";

export type Settings = {
  sealName: string;
  /** 仕上がりの色調の初期値 */
  defaultTone: "auto" | "original";
  /** 詠んだ句を自動でギャラリーに残すか */
  autoGallery: boolean;
  /** 仕上げの好み。前回選んだものを次の句にも使う */
  /** "auto" は句の文体に合わせて選ぶ */
  font: FontStyle | "auto";
  gafu: Gafu;
  blur: boolean;
  smudge: boolean;
  grain: boolean;
  /** 句の文体の好み。"auto" は写真から決める */
  style: Style | "auto";
  /** 作品全体を色紙のような枠で囲むか */
  frame: boolean;
  /** 筆の音や落款の音を鳴らすか */
  sound: boolean;
  /** 保存形式の版。初期値を変えたときに、古い保存内容を直すために使う */
  v: number;
};

const KEY = "settings";
const DEFAULTS: Settings = {
  sealName: "一句",
  defaultTone: "auto",
  autoGallery: true,
  font: "auto",
  gafu: "none",
  blur: false,
  smudge: true,
  grain: true,
  style: "auto",
  frame: true,
  sound: true,
  v: 2,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const legacySeal = localStorage.getItem("sealName");
    const parsed = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    if ((parsed.v ?? 1) < 2) {
      // 版2で、ぼかしを既定でオフに、文字をおまかせに、ざらざらを既定でオンに変えた
      Object.assign(parsed, { blur: false, font: "auto", grain: true, v: 2 });
    }
    return { ...DEFAULTS, ...(legacySeal ? { sealName: legacySeal } : {}), ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* 保存できない環境では、開いている間だけ覚えておく */
    }
  }, [settings]);
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  return [settings, update] as const;
}
