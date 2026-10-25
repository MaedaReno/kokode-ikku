export type Emotion = "喜" | "怒" | "哀" | "楽";

/** 正方形を対角線（×）で四つに分け、上・右・下・左に喜怒哀楽を置く */
const ITEMS: { value: Emotion; reading: string; pos: "top" | "right" | "bottom" | "left" }[] = [
  { value: "喜", reading: "よろこび", pos: "top" },
  { value: "怒", reading: "いかり", pos: "right" },
  { value: "哀", reading: "かなしみ", pos: "bottom" },
  { value: "楽", reading: "たのしみ", pos: "left" },
];

export function EmotionPicker({ value, onChange }: { value: Emotion | null; onChange: (e: Emotion) => void }) {
  return (
    <div className="emotion" role="radiogroup" aria-label="句の気持ち">
      {ITEMS.map((it) => (
        <button
          key={it.value}
          role="radio"
          aria-checked={value === it.value}
          aria-label={`${it.value}（${it.reading}）`}
          className={`emotion-cell ${it.pos} ${value === it.value ? "on" : ""}`}
          onClick={() => onChange(it.value)}
        >
          <span className="emotion-char">{it.value}</span>
          <span className="emotion-reading">{it.reading}</span>
        </button>
      ))}
      <svg className="emotion-cross" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 2L98 98M98 2L2 98" />
      </svg>
    </div>
  );
}
