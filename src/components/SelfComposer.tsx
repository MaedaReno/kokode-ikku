import { useEffect, useRef, useState } from "react";
import { countMora, type Analysis, type MoraResult } from "../lib/api";
import { SEASONS as KIGO_SEASONS } from "../lib/zukan";

const TARGET = [5, 7, 5];
const PART = ["上五", "中七", "下五"];
const PLACEHOLDER = ["古池や", "蛙飛びこむ", "水の音"];

type Props = {
  lines: string[];
  onChange: (lines: string[]) => void;
  onMora: (m: MoraResult | null) => void;
  /** 季語の初めの季節。"春" などの見出し */
  season: string;
  hints: Analysis | null;
  hintLoading: boolean;
  onRequestHints: () => void;
};

/** 自分で詠むための編集欄。音を数えながら、季語や写真のヒントを差し込める */
export function SelfComposer({ lines, onChange, onMora, season, hints, hintLoading, onRequestHints }: Props) {
  const [mora, setMora] = useState<MoraResult | null>(null);
  const [focus, setFocus] = useState(0);
  const [kigoSeason, setKigoSeason] = useState(season);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => setKigoSeason(season), [season]);

  useEffect(() => {
    if (lines.every((l) => !l.trim())) {
      setMora(null);
      onMora(null);
      return;
    }
    const ac = new AbortController();
    const id = setTimeout(() => {
      countMora(lines, ["", "", ""], ac.signal)
        .then((m) => {
          setMora(m);
          onMora(m);
        })
        .catch(() => {});
    }, 220);
    return () => {
      clearTimeout(id);
      ac.abort();
    };
  }, [lines]);

  /** いま選んでいる句の、カーソルの位置に言葉を差し込む */
  const insert = (word: string) => {
    const el = inputs.current[focus];
    const cur = lines[focus];
    const at = el?.selectionStart ?? cur.length;
    const next = [...lines];
    next[focus] = cur.slice(0, at) + word + cur.slice(el?.selectionEnd ?? at);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = at + word.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const kigo = KIGO_SEASONS.find((s) => s.season === kigoSeason) ?? KIGO_SEASONS[0];

  return (
    <div className="self">
      <div className="tanzaku" role="group" aria-label="自分の句">
        {lines.map((l, i) => {
          const n = l.trim() ? mora?.mora[i] ?? null : 0;
          const state = n === null ? "" : n === TARGET[i] ? "ok" : n > TARGET[i] ? "over" : "";
          return (
            <div key={i} className={`self-line ${focus === i ? "focus" : ""} ${state}`}>
              <div className="self-line-head">
                <span className="self-part">{PART[i]}</span>
                <span className="meter" aria-label={`${n ?? "-"}音 / ${TARGET[i]}音`}>
                  {Array.from({ length: Math.max(TARGET[i], n ?? 0) }, (_, k) => (
                    <i key={k} className={k < (n ?? 0) ? (k >= TARGET[i] ? "extra" : "on") : ""} />
                  ))}
                </span>
                <span className="self-count">
                  {n ?? "-"}
                  <small>/{TARGET[i]}</small>
                </span>
              </div>
              <input
                ref={(el) => (inputs.current[i] = el)}
                aria-label={PART[i]}
                value={l}
                placeholder={PLACEHOLDER[i]}
                maxLength={24}
                enterKeyHint={i < 2 ? "next" : "done"}
                onFocus={() => setFocus(i)}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && i < 2) inputs.current[i + 1]?.focus();
                }}
              />
              {l.trim() && mora?.readings[i] && <span className="self-reading">{mora.readings[i]}</span>}
            </div>
          );
        })}
      </div>

      <section className="field">
        <h2>
          季語をさがす<span className="sub">押すと、選んでいる句に入ります</span>
        </h2>
        <div className="segment small">
          {KIGO_SEASONS.map((s) => (
            <button key={s.season} className={kigoSeason === s.season ? "on" : ""} onClick={() => setKigoSeason(s.season)}>
              {s.season}
            </button>
          ))}
        </div>
        <div className="chips">
          {kigo.items.map((k) => (
            <button key={k.word} className="chip kigo-chip" onClick={() => insert(k.word)} title={k.meaning}>
              {k.word}
              <small>{k.reading}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="field">
        <h2>
          写真からヒント<span className="sub">AI が写真から言葉を拾います</span>
        </h2>
        {hints ? (
          <>
            <p className="hint">
              主役は「{hints.mainSubject}」。{hints.mood}
            </p>
            <div className="chips">
              {[hints.mainSubject, ...hints.keyPoints].map((k) => (
                <button key={k} className="chip" onClick={() => insert(k)}>
                  {k}
                </button>
              ))}
            </div>
          </>
        ) : (
          <button className="btn" onClick={onRequestHints} disabled={hintLoading}>
            {hintLoading ? "写真を読んでいます…" : "ヒントをもらう"}
          </button>
        )}
      </section>
    </div>
  );
}
