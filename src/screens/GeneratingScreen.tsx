import { STYLE_LABEL, type Analysis } from "../lib/api";
import type { Source } from "../lib/media";
import { Enso } from "../components/Enso";

export type GenStep = "analyze" | "compose";

/** 要点の札を貼る場所。写真の四辺に散らす */
const FUDA_SPOTS = [
  { left: "-3%", top: "6%", rotate: "-4deg" },
  { right: "-3%", top: "28%", rotate: "3deg" },
  { left: "-3%", bottom: "22%", rotate: "2deg" },
  { right: "-3%", bottom: "5%", rotate: "-3deg" },
];

export function GeneratingScreen({ step, analysis, source }: { step: GenStep; analysis: Analysis | null; source: Source }) {
  const s = analysis?.subject;
  return (
    <main className="generating">
      <div className={`scan ${step}`}>
        <img src={source.thumbUrl} alt="" />
        {step === "analyze" && (
          <>
            <span className="scan-line" aria-hidden="true" />
            <span className="scan-grid" aria-hidden="true" />
          </>
        )}
        {step === "compose" && (
          <div className="scan-veil" aria-hidden="true">
            <Enso />
          </div>
        )}
        {s && (
          <svg className="scan-subject" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <rect x={s.x * 100} y={s.y * 100} width={s.w * 100} height={s.h * 100} pathLength={1} />
          </svg>
        )}
        {s && analysis && (
          <span className="scan-label" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}>
            主役　{analysis.mainSubject}
          </span>
        )}
        {analysis?.keyPoints.slice(0, FUDA_SPOTS.length).map((k, i) => {
          const { rotate, ...pos } = FUDA_SPOTS[i];
          return (
            <span key={k} className="fuda" style={{ ...pos, rotate, animationDelay: `${0.6 + i * 0.35}s` }}>
              {k}
            </span>
          );
        })}
      </div>

      <ol className="gen-steps" aria-live="polite">
        <li className={step === "analyze" ? "now" : "done"}>画像を読む</li>
        <li className={step === "compose" ? "now" : ""}>句を詠む</li>
      </ol>
      <p className="generating-text">{step === "analyze" ? "景色を読んでいます" : "一句、思案中"}</p>
      {analysis && (
        <p className="reading-line">
          <span className="style-badge">{STYLE_LABEL[analysis.style]}</span>
          {analysis.mood}
        </p>
      )}
    </main>
  );
}
