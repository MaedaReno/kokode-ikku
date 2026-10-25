import { useState } from "react";
import type { Source } from "../lib/media";
import { STYLE_LABEL, type Analysis, type MoraResult, type Season, type Style } from "../lib/api";
import { BackIcon, BrushIcon, ChevronIcon, PenIcon, SwapIcon } from "../components/Icons";
import { EmotionPicker, type Emotion } from "../components/EmotionPicker";
import { SelfComposer } from "../components/SelfComposer";

export type Mode = "ai" | "self";

export type ComposeOptions = {
  mode: Mode;
  emotion: Emotion | null;
  notes: string;
  season: Season | "auto";
  /** 句の調子。"auto" は写真から決める */
  style: Style | "auto";
  /** 自分で詠むときの三句 */
  selfLines: string[];
};

const STYLE_CHOICES: (Style | "auto")[] = ["auto", "shibui", "wabisabi", "wakamono", "hashagu"];

const SEASON_HEAD: Record<string, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };

/** 季語の初めの季節。指定がなければ、いまの月から決める */
function kigoSeasonFor(season: Season | "auto"): string {
  if (SEASON_HEAD[season]) return SEASON_HEAD[season];
  const m = new Date().getMonth() + 1;
  return m >= 3 && m <= 5 ? "春" : m >= 6 && m <= 8 ? "夏" : m >= 9 && m <= 11 ? "秋" : "冬";
}

/** Claude に渡すときの、気持ちの言い換え */
export const EMOTION_HINT: Record<Emotion, string> = {
  喜: "喜（よろこび、晴れやかさ）",
  怒: "怒（いかり、やるせなさ）",
  哀: "哀（かなしみ、寂しさ）",
  楽: "楽（たのしみ、可笑しみ）",
};

const SEASONS: { value: Season | "auto"; label: string }[] = [
  { value: "auto", label: "おまかせ" },
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
];

type Props = {
  source: Source;
  options: ComposeOptions;
  onChange: (o: ComposeOptions) => void;
  onChangeMedia: () => void;
  loadingMedia: boolean;
  error: string | null;
  onSubmit: () => void;
  onSubmitSelf: (mora: MoraResult | null) => void;
  onBack: () => void;
  hints: Analysis | null;
  hintLoading: boolean;
  onRequestHints: () => void;
};

export function ComposeScreen(props: Props) {
  const [step, setStep] = useState<"main" | "extra">("main");
  return step === "main" ? <MainStep {...props} onExtra={() => setStep("extra")} /> : <ExtraStep {...props} onDone={() => setStep("main")} />;
}

function MainStep(props: Props & { onExtra: () => void }) {
  const { source, options, onChangeMedia, loadingMedia, error, onSubmit, onBack, onChange, onExtra } = props;
  const [mora, setMora] = useState<MoraResult | null>(null);
  const seasonLabel = SEASONS.find((s) => s.value === options.season)?.label ?? "おまかせ";
  const extras = [options.season !== "auto" ? seasonLabel : null, options.notes.trim() ? "ひとことあり" : null].filter(Boolean);
  const self = options.mode === "self";
  const filled = options.selfLines.every((l) => l.trim());

  return (
    <main className="screen">
      <header className="bar">
        <button className="icon-btn" onClick={onBack} aria-label="戻る">
          <BackIcon />
        </button>
        <h1 className="bar-title">どう詠む</h1>
        <span className="icon-btn" aria-hidden="true" />
      </header>

      <div className="screen-body compose">
        <button className="media-preview small" onClick={onChangeMedia} disabled={loadingMedia} aria-label="素材を変える">
          <img src={source.thumbUrl} alt="" />
          {source.kind === "video" && <span className="badge">動画</span>}
          <span className="pill">
            <SwapIcon />
            {loadingMedia ? "読み込み中" : "変える"}
          </span>
        </button>

        <div className="mode-switch" role="radiogroup" aria-label="詠み方">
          <button role="radio" aria-checked={!self} className={`mode-card ${!self ? "on" : ""}`} onClick={() => onChange({ ...options, mode: "ai" })}>
            <BrushIcon size={26} />
            <strong>AIが詠む</strong>
            <small>写真を読んで一句</small>
          </button>
          <button role="radio" aria-checked={self} className={`mode-card ${self ? "on" : ""}`} onClick={() => onChange({ ...options, mode: "self" })}>
            <PenIcon size={26} />
            <strong>自分で詠む</strong>
            <small>音を数えて、講評も</small>
          </button>
        </div>

        {self ? (
          <SelfComposer
            lines={options.selfLines}
            onChange={(selfLines) => onChange({ ...options, selfLines })}
            onMora={setMora}
            season={kigoSeasonFor(options.season)}
            hints={props.hints}
            hintLoading={props.hintLoading}
            onRequestHints={props.onRequestHints}
          />
        ) : (
          <>
            <section className="field center">
              <h2>どんな気持ちで詠みますか</h2>
              <EmotionPicker value={options.emotion} onChange={(emotion) => onChange({ ...options, emotion })} />
            </section>

            <section className="field">
              <h2>
                句の調子<span className="sub">次からもこの調子で詠みます</span>
              </h2>
              <div className="chips">
                {STYLE_CHOICES.map((st) => (
                  <button
                    key={st}
                    className={`chip ${options.style === st ? "on" : ""} ${st === "shibui" ? "shibui-chip" : ""}`}
                    aria-pressed={options.style === st}
                    onClick={() => onChange({ ...options, style: st })}
                  >
                    {st === "auto" ? "写真にまかせる" : STYLE_LABEL[st]}
                  </button>
                ))}
              </div>
            </section>

            <button className="row-link" onClick={onExtra}>
              <span>
                季節・ひとことを添える
                <span className="sub">{extras.length ? extras.join("・") : "任意"}</span>
              </span>
              <ChevronIcon />
            </button>
          </>
        )}

        {error && <p className="error">{error}</p>}
      </div>

      <div className="bottom-bar">
        {self ? (
          <button className="btn primary big" onClick={() => props.onSubmitSelf(mora)} disabled={!filled}>
            <PenIcon size={22} />
            {filled ? "この句で仕上げる" : "三つの句を書いてください"}
          </button>
        ) : (
          <button className="btn primary big" onClick={onSubmit} disabled={!options.emotion}>
            <BrushIcon />
            {options.emotion ? "一句詠む" : "気持ちを一つ選んでください"}
          </button>
        )}
      </div>
    </main>
  );
}

function ExtraStep({ options, onChange, onDone }: Props & { onDone: () => void }) {
  return (
    <main className="screen">
      <header className="bar">
        <button className="icon-btn" onClick={onDone} aria-label="戻る">
          <BackIcon />
        </button>
        <h1 className="bar-title">添える</h1>
        <span className="icon-btn" aria-hidden="true" />
      </header>

      <div className="screen-body compose">
        <p className="hint">どちらも任意です。入れなければ、写真から読み取ります。</p>
        <section className="field">
          <h2>季節</h2>
          <div className="chips">
            {SEASONS.map((s) => (
              <button
                key={s.value}
                className={`chip ${s.value === "auto" ? "" : "round"} ${options.season === s.value ? "on accent" : ""}`}
                aria-pressed={options.season === s.value}
                onClick={() => onChange({ ...options, season: s.value })}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section className="field">
          <label htmlFor="notes" className="field-label">
            ひとこと
          </label>
          <textarea
            id="notes"
            rows={4}
            value={options.notes}
            placeholder="写真だけでは分からない事情や気持ち。例: 徹夜明けの帰り道"
            onChange={(e) => onChange({ ...options, notes: e.target.value })}
          />
        </section>
      </div>

      <div className="bottom-bar">
        <button className="btn big" onClick={onDone}>
          これで戻る
        </button>
      </div>
    </main>
  );
}
