import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Source } from "../lib/media";
import { countMora, critiqueHaiku, type Critique, type HaikuResult, type MoraResult } from "../lib/api";
import { HaikuRenderer, type Tone } from "../lib/render";
import { Sheet } from "../components/Sheet";
import { saveBlob } from "../lib/share";
import { newId, saveWork } from "../lib/gallery";
import { CloseIcon, ExpandIcon, ImageIcon, PenIcon, RedoIcon, SaveIcon, ToneIcon, VideoIcon } from "../components/Icons";
import { EFFECT_LABEL, type Effect } from "../lib/effects";
import { GAFU_LABEL, type Gafu } from "../lib/finish";
import { FONT_FAMILY, FONT_LABEL, type FontStyle } from "../lib/render";
import type { Settings } from "../lib/settings";
import { STYLE_LABEL } from "../lib/api";
import { buzz, playSeal, playStroke, playWhoosh } from "../lib/sound";
import { transition } from "../lib/motion";

type Props = {
  source: Source;
  haiku: HaikuResult;
  sealName: string;
  defaultTone: "auto" | "original";
  autoGallery: boolean;
  finishPrefs: Pick<Settings, "font" | "gafu" | "blur" | "smudge" | "grain" | "frame">;
  onFinishPrefs: (p: Partial<Settings>) => void;
  conditions: string[];
  error: string | null;
  onRegenerate: (conditions: string[]) => void;
  onReplace: (lines: string[], mora: number[], ok: boolean) => void;
  onNewMedia: () => void;
};

/** 書き終えてから、全画面を閉じるまでの間 */
const IMMERSIVE_HOLD = 1100;

const QUICK_CONDITIONS = ["もっと寂しく", "可笑しみを足して", "季語を変えて", "口語で", "擬音を入れて", "もっと短い言葉で"];
const TARGET = [5, 7, 5];
const PART = ["上五", "中七", "下五"];

/** 文字のおまかせ。若者ことばは極太ゴシック、はしゃぎ口語は豪快な筆、侘び寂びは標準の筆 */
const AUTO_FONT: Record<string, FontStyle> = {
  wakamono: "dela",
  hashagu: "potta",
  wabisabi: "syuku",
  shibui: "boku",
};

const SEASON_EFFECT: Partial<Record<string, Effect>> = {
  spring: "sakura",
  summer: "hanabi",
  autumn: "momiji",
  winter: "yuki",
  newyear: "kinpaku",
};

function formLabel(mora: number[]): string {
  const over = mora.map((m, i) => m - TARGET[i]);
  if (over.every((o) => o === 0)) return "五七五";
  if (over.every((o) => o === 0 || o === 1) && over.filter((o) => o === 1).length === 1) return `字余り（${mora.join("・")}音）`;
  return `${mora.join("・")}音`;
}

const TONE_OPTIONS: { value: Tone | "auto"; label: string }[] = [
  { value: "auto", label: "句に合わせる" },
  { value: "original", label: "元のまま" },
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
];

type SheetKind = null | "regen" | "replace" | "tone" | "save";

type Drag = {
  id: number;
  startX: number;
  startY: number;
  moved: boolean;
  onBlock: boolean;
  origin: { x: number; y: number } | null;
};

export function ResultScreen(props: Props) {
  const { source, haiku, sealName, autoGallery } = props;
  const { font: fontChoice, gafu, blur, smudge, grain, frame } = props.finishPrefs;
  const autoFont: FontStyle = AUTO_FONT[haiku.analysis?.style ?? "wabisabi"];
  const font: FontStyle = fontChoice === "auto" ? autoFont : fontChoice;
  const setFinish = (p: Partial<Settings>) => {
    stillRef.current = true;
    props.onFinishPrefs(p);
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HaikuRenderer | null>(null);
  const dragRef = useRef<Drag | null>(null);
  /** 位置だけ変えたときは書き直さず、仕上がりをそのまま見せる */
  const stillRef = useRef(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toneChoice, setToneChoice] = useState<Tone | "auto">(props.defaultTone);
  /** 句ごとにギャラリーの1枠を割り当て、色や位置を変えたら同じ枠を上書きする */
  const workRef = useRef<{ haiku: HaikuResult; id: string; createdAt: number } | null>(null);
  const [placement, setPlacement] = useState<{ x: number; y: number } | null>(null);
  /** 新しい句は、まず画面いっぱいに書いて見せる */
  const [immersive, setImmersive] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef(0);

  const setImmersiveAnimated = (on: boolean) => {
    clearTimeout(exitTimer.current);
    const el = stageRef.current;
    if (el) el.style.viewTransitionName = "stage";
    transition(() => setImmersive(on), "morph").then(() => {
      if (el) el.style.viewTransitionName = "";
    });
  };

  const tone: Tone = toneChoice === "auto" ? haiku.season : toneChoice;
  const [effectChoice, setEffectChoice] = useState<Effect | "auto">("auto");
  const autoEffect: Effect =
    haiku.analysis?.effect && haiku.analysis.effect !== "none" ? haiku.analysis.effect : SEASON_EFFECT[haiku.season] ?? "sakura";
  const effect: Effect = effectChoice === "auto" ? autoEffect : effectChoice;

  useEffect(() => {
    const r = new HaikuRenderer(canvasRef.current!);
    rendererRef.current = r;
    r.onCue = (cue) => {
      if (cue.type === "stroke") {
        playStroke(cue.duration);
        return;
      }
      if (cue.type === "lift") {
        playWhoosh(cue.duration);
        return;
      }
      playSeal();
      buzz(60);
      // 印を押した手応えとして、作品を少し揺らす
      const el = stageRef.current;
      if (!el) return;
      el.classList.remove("stamped");
      void el.offsetWidth;
      el.classList.add("stamped");
    };
    return () => {
      r.stop();
      clearTimeout(exitTimer.current);
    };
  }, []);

  useEffect(() => {
    setImmersive(true);
  }, [haiku]);

  useEffect(() => {
    setPlacement(null);
  }, [source]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    let cancelled = false;
    r.setInput({ source, lines: haiku.lines, tone, sealName, subject: haiku.subject, placement, effect, gafu, blur, smudge, grain, font, frame }).then(() => {
      if (cancelled) return;
      if (stillRef.current) {
        stillRef.current = false;
        r.showFinal();
        saveToGallery();
      } else {
        r.play(() => {
          saveToGallery();
          exitTimer.current = window.setTimeout(() => setImmersiveAnimated(false), IMMERSIVE_HOLD);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source, haiku, tone, sealName, placement, effect, gafu, blur, smudge, grain, font, frame]);

  const replay = () => rendererRef.current?.play();

  function saveToGallery() {
    const r = rendererRef.current;
    if (!r || !autoGallery) return;
    if (workRef.current?.haiku !== haiku) {
      workRef.current = { haiku, id: newId(), createdAt: Date.now() };
    }
    const w = workRef.current;
    r.snapshot().then((image) => {
      if (image) saveWork({ id: w.id, createdAt: w.createdAt, lines: haiku.lines, kigo: haiku.kigo, note: haiku.note, image });
    });
  }

  const toCanvasRatio = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    // 枠があるときは、句の座標は枠の内側を基準にしている
    const inset = rendererRef.current?.frameInset ?? 0;
    const inner = 1 - inset * 2;
    return {
      x: ((e.clientX - rect.left) / rect.width - inset) / inner,
      y: ((e.clientY - rect.top) / rect.height - inset) / inner,
      rect: { width: rect.width * inner, height: rect.height * inner },
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const r = rendererRef.current;
    const block = r?.blockRect;
    const p = toCanvasRatio(e);
    const onBlock = !immersive && !!block && p.x >= block.x && p.x <= block.x + block.w && p.y >= block.y && p.y <= block.y + block.h;
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      onBlock,
      origin: block ? { x: block.x, y: block.y } : null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    if (!d.onBlock || !d.origin) return;
    const { rect } = toCanvasRatio(e);
    stillRef.current = true;
    setPlacement({ x: d.origin.x + dx / rect.width, y: d.origin.y + dy / rect.height });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.id !== e.pointerId || d.moved) return;
    if (immersive) setImmersiveAnimated(false);
    else replay();
  };

  const savePng = async () => {
    const r = rendererRef.current;
    if (!r) return;
    setSaveError(null);
    setBusy("画像を書き出しています");
    try {
      const blob = await r.exportPng();
      await saveBlob(blob, `kokode-ikku-${Date.now()}.${blob.type === "image/png" ? "png" : "jpg"}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setBusy(null);
    }
  };

  const saveVideo = async () => {
    const r = rendererRef.current;
    if (!r) return;
    setSaveError(null);
    setBusy("動画を録画しています 0%");
    try {
      const { blob, ext } = await r.recordVideo((p) => setBusy(`動画を録画しています ${Math.round(p * 100)}%`));
      await saveBlob(blob, `kokode-ikku-${Date.now()}.${ext}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="screen">
      <header className="bar">
        <button className="icon-btn" onClick={props.onNewMedia} aria-label="最初に戻る">
          <CloseIcon />
        </button>
        <h1 className="bar-title">ここで一句</h1>
        <span className="icon-btn" aria-hidden="true" />
      </header>

      <div className="screen-body result">
        <div
          ref={stageRef}
          className={`stage ${immersive ? "immersive" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragRef.current = null)}
        >
          <div className="stage-frame">
            <canvas ref={canvasRef} aria-label={`作品: ${haiku.lines.join(" ")}`} role="img" />
            {!immersive && (
              <button
                className="stage-expand"
                aria-label="画面いっぱいに表示"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={() => setImmersiveAnimated(true)}
              >
                <ExpandIcon />
              </button>
            )}
          </div>
          {immersive && <span className="stage-close">タップで閉じる</span>}
        </div>
        <p className="stage-hint">
          {placement ? (
            <button className="link inline" onClick={() => setPlacement(null)}>
              位置をおまかせに戻す
            </button>
          ) : (
            "タップで書き直し、句はドラッグで動かせます"
          )}
        </p>

        <div className="actionbar" role="toolbar" aria-label="仕上げの操作">
          <button onClick={() => setSheet("regen")}>
            <RedoIcon />
            詠み直す
          </button>
          <button onClick={() => setSheet("replace")}>
            <PenIcon />
            句を直す
          </button>
          <button onClick={() => setSheet("tone")}>
            <ToneIcon />
            仕上げ
          </button>
          <button className="accent" onClick={() => setSheet("save")} disabled={!!busy}>
            <SaveIcon />
            保存
          </button>
        </div>

        {haiku.self && <CritiquePanel key={haiku.lines.join("/")} source={source} lines={haiku.lines} onUse={props.onReplace} />}

        <section className="haiku-info">
          <p className="haiku-text">{haiku.lines.join("　")}</p>
          <p className="haiku-meta">
            {formLabel(haiku.mora)}
            {haiku.kigo && `　季語 ${haiku.kigo}`}
            {haiku.mock && "　見本の句"}
          </p>
          {haiku.note && <p className="haiku-note">{haiku.note}</p>}
          {haiku.analysis && (
            <p className="reading-line">
              <span className="style-badge">{STYLE_LABEL[haiku.analysis.style]}</span>
              主役　{haiku.analysis.mainSubject}
            </p>
          )}
        </section>

        {(props.error || saveError) && <p className="error">{props.error || saveError}</p>}
      </div>


      {busy && (
        <div className="toast" role="status">
          {busy}
        </div>
      )}

      {sheet === "regen" && (
        <RegenSheet
          initial={props.conditions}
          onClose={() => setSheet(null)}
          onSubmit={(c) => {
            setSheet(null);
            props.onRegenerate(c);
          }}
        />
      )}
      {sheet === "replace" && (
        <ReplaceSheet
          initial={haiku.lines}
          onClose={() => setSheet(null)}
          onSubmit={(lines, mora, ok) => {
            setSheet(null);
            props.onReplace(lines, mora, ok);
          }}
        />
      )}
      {sheet === "tone" && (
        <Sheet title="仕上げ" onClose={() => setSheet(null)}>
          <div className="field-label">文字</div>
          <div className="chips">
            <button className={`chip ${fontChoice === "auto" ? "on" : ""}`} aria-pressed={fontChoice === "auto"} onClick={() => setFinish({ font: "auto" })}>
              おまかせ（{FONT_LABEL[autoFont]}）
            </button>
            {(Object.keys(FONT_LABEL) as FontStyle[]).map((f) => (
              <button
                key={f}
                className={`chip font-chip ${fontChoice === f ? "on" : ""}`}
                style={{ fontFamily: FONT_FAMILY[f], fontWeight: f === "tokumin" ? 800 : 400 }}
                aria-pressed={fontChoice === f}
                onClick={() => setFinish({ font: f })}
              >
                {FONT_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="field-label">
            作品の枠<span className="sub">写真は切らずに一回り小さく収めます</span>
          </div>
          <div className="chips">
            <button className={`chip ${frame ? "on" : ""}`} aria-pressed={frame} onClick={() => setFinish({ frame: true })}>
              色紙の枠
            </button>
            <button className={`chip ${!frame ? "on" : ""}`} aria-pressed={!frame} onClick={() => setFinish({ frame: false })}>
              枠なし
            </button>
          </div>
          <div className="field-label">画風</div>
          <div className="chips">
            {(Object.keys(GAFU_LABEL) as Gafu[]).map((g) => (
              <button key={g} className={`chip ${gafu === g ? "on" : ""}`} aria-pressed={gafu === g} onClick={() => setFinish({ gafu: g })}>
                {GAFU_LABEL[g]}
              </button>
            ))}
          </div>
          <div className="field-label">
            加工<span className="sub">主役にはかけません</span>
          </div>
          <div className="chips">
            <button className={`chip ${grain ? "on" : ""}`} aria-pressed={grain} onClick={() => setFinish({ grain: !grain })}>
              ざらざら
            </button>
            <button className={`chip ${smudge ? "on" : ""}`} aria-pressed={smudge} onClick={() => setFinish({ smudge: !smudge })}>
              指でずらす
            </button>
            <button className={`chip ${blur ? "on" : ""}`} aria-pressed={blur} onClick={() => setFinish({ blur: !blur })}>
              まわりをぼかす
            </button>
          </div>
          <div className="field-label">演出</div>
          <div className="chips">
            {(["auto", "sakura", "hanabi", "momiji", "yuki", "kinpaku", "none"] as const).map((e) => (
              <button
                key={e}
                className={`chip ${effectChoice === e ? "on" : ""}`}
                aria-pressed={effectChoice === e}
                onClick={() => {
                  stillRef.current = true;
                  setEffectChoice(e);
                }}
              >
                {e === "auto" ? `おまかせ（${EFFECT_LABEL[autoEffect]}）` : EFFECT_LABEL[e]}
              </button>
            ))}
          </div>
          <div className="field-label">色調</div>
          <div className="chips">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t.value}
                className={`chip ${toneChoice === t.value ? "on" : ""}`}
                aria-pressed={toneChoice === t.value}
                onClick={() => setToneChoice(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="hint">落款の名前は、設定で変えられます。</p>
        </Sheet>
      )}
      {sheet === "save" && (
        <Sheet title="保存して共有" onClose={() => setSheet(null)}>
          <button
            className="option"
            onClick={() => {
              setSheet(null);
              savePng();
            }}
          >
            <ImageIcon />
            <span>
              <strong>画像</strong>
              <small>元の写真と同じ大きさで保存</small>
            </span>
          </button>
          <button
            className="option"
            onClick={() => {
              setSheet(null);
              saveVideo();
            }}
          >
            <VideoIcon />
            <span>
              <strong>筆で書く動画</strong>
              <small>約{Math.round(rendererRef.current?.duration ?? 10)}秒。リールやストーリー向け</small>
            </span>
          </button>
        </Sheet>
      )}
    </main>
  );
}

/** 自分で詠んだ句を、AI に講評してもらう */
function CritiquePanel({ source, lines, onUse }: { source: Source; lines: string[]; onUse: (lines: string[], mora: number[], ok: boolean) => void }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<Critique | null>(null);
  const [error, setError] = useState("");

  const ask = async () => {
    setState("loading");
    try {
      setResult(await critiqueHaiku(source.frames, lines));
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "講評に失敗しました。");
      setState("error");
    }
  };

  const use = async (next: string[]) => {
    const m = await countMora(next, ["", "", ""]).catch(() => null);
    onUse(next, m?.mora ?? [5, 7, 5], m?.ok ?? true);
  };

  if (state !== "done" || !result) {
    return (
      <button className="critique-ask" onClick={ask} disabled={state === "loading"}>
        <span className="critique-seal" aria-hidden="true">
          評
        </span>
        <span>
          <strong>{state === "loading" ? "選者が句を読んでいます…" : "AI の選者に講評してもらう"}</strong>
          <small>{state === "error" ? error : "良いところ、直しどころ、渋さの点数"}</small>
        </span>
      </button>
    );
  }

  return (
    <section className="critique" aria-label="講評">
      <div className="shibusa">
        <span className="shibusa-label">渋さ</span>
        <span className="shibusa-score">{result.shibusa}</span>
        <span className="shibusa-title">{result.title}</span>
        <span className="shibusa-bar" aria-hidden="true">
          <i style={{ width: `${result.shibusa}%` }} />
        </span>
      </div>
      <p className="critique-row">
        <span className="critique-key good">良</span>
        {result.good}
      </p>
      <p className="critique-row">
        <span className="critique-key">直</span>
        {result.improve}
      </p>
      {result.revision && (
        <div className="revision">
          <p className="revision-verse">{result.revision.lines.join("　")}</p>
          <p className="revision-reason">{result.revision.reason}</p>
          <button className="btn small" onClick={() => use(result.revision!.lines)}>
            この案で書き直す
          </button>
        </div>
      )}
    </section>
  );
}

function RegenSheet({ initial, onClose, onSubmit }: { initial: string[]; onClose: () => void; onSubmit: (c: string[]) => void }) {
  const [list, setList] = useState<string[]>(initial);
  const [text, setText] = useState("");
  const add = (c: string) => {
    const v = c.trim();
    if (v && !list.includes(v)) setList([...list, v]);
  };
  const pending = text.trim();
  const finalList = pending && !list.includes(pending) ? [...list, pending] : list;

  return (
    <Sheet title="どう詠み直しますか" onClose={onClose}>
      <div className="chips">
        {QUICK_CONDITIONS.map((c) => (
          <button key={c} className={`chip ${list.includes(c) ? "on" : ""}`} onClick={() => (list.includes(c) ? setList(list.filter((x) => x !== c)) : add(c))}>
            {c}
          </button>
        ))}
      </div>
      <label htmlFor="cond" className="field-label">
        自由に書き足す
      </label>
      <input
        id="cond"
        value={text}
        placeholder="例: 缶コーヒーを主役に"
        enterKeyHint="done"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            add(text);
            setText("");
          }
        }}
      />
      {list.some((c) => !QUICK_CONDITIONS.includes(c)) && (
        <ul className="cond-list">
          {list.filter((c) => !QUICK_CONDITIONS.includes(c)).map((c) => (
            <li key={c}>
              <span>{c}</span>
              <button className="link" onClick={() => setList(list.filter((x) => x !== c))} aria-label={`${c}を外す`}>
                外す
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn primary big" disabled={finalList.length === 0} onClick={() => onSubmit(finalList)}>
        この条件で詠み直す
      </button>
    </Sheet>
  );
}

function ReplaceSheet({
  initial,
  onClose,
  onSubmit,
}: {
  initial: string[];
  onClose: () => void;
  onSubmit: (lines: string[], mora: number[], ok: boolean) => void;
}) {
  const [lines, setLines] = useState<string[]>(initial);
  // 辞書の読みが違うときだけ手で直す。null は自動の読みを使う
  const [readingEdits, setReadingEdits] = useState<(string | null)[]>([null, null, null]);
  const [mora, setMora] = useState<MoraResult | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const id = setTimeout(() => {
      countMora(lines, readingEdits.map((r) => r ?? ""), ac.signal)
        .then(setMora)
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(id);
      ac.abort();
    };
  }, [lines, readingEdits]);

  const filled = lines.every((l) => l.trim());

  return (
    <Sheet title="句を直す" onClose={onClose}>
      <p className="hint">音数はその場で数えます。読みが違うときは読みの欄を直してください。</p>
      {lines.map((l, i) => (
        <div key={i} className="line-input">
          <span className="line-label">{PART[i]}</span>
          <input
            aria-label={PART[i]}
            value={l}
            onChange={(e) => {
              const next = [...lines];
              next[i] = e.target.value;
              setLines(next);
              const edits = [...readingEdits];
              edits[i] = null;
              setReadingEdits(edits);
            }}
          />
          <span className={`mora ${mora && mora.mora[i] === TARGET[i] ? "ok" : "ng"}`}>{mora ? mora.mora[i] : "-"}</span>
          <span className="reading">
            <span className="reading-label">読み</span>
            <input
              aria-label={`${PART[i]}の読み`}
              value={readingEdits[i] ?? mora?.readings[i] ?? ""}
              onChange={(e) => {
                const edits = [...readingEdits];
                edits[i] = e.target.value;
                setReadingEdits(edits);
              }}
            />
            {mora?.uncertain[i] && readingEdits[i] === null && <span>不確か</span>}
          </span>
        </div>
      ))}
      <button
        className="btn primary big"
        disabled={!filled}
        onClick={() => onSubmit(lines.map((l) => l.trim()), mora?.mora ?? [0, 0, 0], mora?.ok ?? false)}
      >
        この句で書く
      </button>
    </Sheet>
  );
}
