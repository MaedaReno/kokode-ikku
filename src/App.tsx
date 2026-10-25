import { useEffect, useRef, useState } from "react";
import { disposeMedia, loadMedia, type Source } from "./lib/media";
import {
  analyzeImage,
  fetchStatus,
  generateHaiku,
  getPasscode,
  PasscodeError,
  setPasscode,
  verifyPasscode,
  type Analysis,
  type HaikuResult,
  type MoraResult,
  type Season,
} from "./lib/api";
import { SEASONS as KIGO_SEASONS } from "./lib/zukan";
import { GeneratingScreen, type GenStep } from "./screens/GeneratingScreen";
import { useSettings } from "./lib/settings";
import { ComposeScreen, EMOTION_HINT, type ComposeOptions } from "./screens/ComposeScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { PasscodeGate } from "./screens/PasscodeGate";
import { GalleryScreen } from "./screens/GalleryScreen";
import { WorldScreen } from "./screens/WorldScreen";
import { ZukanScreen } from "./screens/ZukanScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TabBar, type Tab } from "./components/TabBar";
import { CameraIcon, ImageIcon, VideoIcon } from "./components/Icons";
import { VerticalTitle } from "./components/VerticalTitle";
import { InkDefs, Splash } from "./components/Splash";
import { HomeBackdrop } from "./components/HomeBackdrop";
import { transition } from "./lib/motion";
import { setSoundEnabled } from "./lib/sound";

type Phase = "home" | "compose" | "generating" | "result";

const DEFAULT_OPTIONS: ComposeOptions = { mode: "ai", emotion: null, notes: "", season: "auto", style: "auto", selfLines: ["", "", ""] };

const KIGO_SEASON: Record<string, Season> = { 春: "spring", 夏: "summer", 秋: "autumn", 冬: "winter" };

/** 句に入っている季語を図鑑から探す。見つからなければ空 */
function findKigo(lines: string[]): { kigo: string; season: Season } | null {
  const text = lines.join("");
  for (const s of KIGO_SEASONS) {
    const hit = s.items.find((k) => text.includes(k.word));
    if (hit && KIGO_SEASON[s.season]) return { kigo: hit.word, season: KIGO_SEASON[s.season] };
  }
  return null;
}

/** 起動画面は、開いてから最初の一回だけ流す */
function splashSeen(): boolean {
  try {
    return sessionStorage.getItem("splashSeen") === "1";
  } catch {
    return false;
  }
}

/** 同じ素材と入力なら、画像の分析を使い回す */
function analysisKey(opts: ComposeOptions): string {
  return JSON.stringify([opts.emotion, opts.notes.trim(), opts.season]);
}

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [phase, setPhase] = useState<Phase>("home");
  const [source, setSource] = useState<Source | null>(null);
  const [settings, updateSettings] = useSettings();
  const [options, setOptionsState] = useState<ComposeOptions>(() => ({ ...DEFAULT_OPTIONS, style: settings.style }));
  /** 句の調子は好みとして覚えておき、次の写真でも使う */
  const setOptions = (o: ComposeOptions) => {
    setOptionsState(o);
    if (o.style !== settings.style) updateSettings({ style: o.style });
  };
  const [haiku, setHaiku] = useState<HaikuResult | null>(null);
  const [conditions, setConditions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mock, setMock] = useState(false);
  const [needPasscode, setNeedPasscode] = useState(false);
  const [genStep, setGenStep] = useState<GenStep>("analyze");
  /** 同じ素材と入力なら分析を使い回し、詠み直しを速くする */
  const [analysis, setAnalysis] = useState<{ key: string; value: Analysis } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoCamRef = useRef<HTMLInputElement>(null);
  const videoCamRef = useRef<HTMLInputElement>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [splash, setSplash] = useState(() => !splashSeen());

  const endSplash = () => {
    try {
      sessionStorage.setItem("splashSeen", "1");
    } catch {
      /* 保存できなくても、この回は閉じる */
    }
    transition(() => setSplash(false));
  };

  useEffect(() => {
    setSoundEnabled(settings.sound);
  }, [settings.sound]);

  useEffect(() => {
    fetchStatus().then(async (s) => {
      setMock(s.mock);
      if (!s.passcode) return;
      const saved = getPasscode();
      const ok = saved ? await verifyPasscode(saved).catch(() => false) : false;
      if (!ok) {
        setPasscode("");
        setNeedPasscode(true);
      }
    });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, phase]);

  const pickFile = () => fileRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoadingMedia(true);
    try {
      const next = await loadMedia(file);
      disposeMedia(source);
      setSource(next);
      setHaiku(null);
      setAnalysis(null);
      setConditions([]);
      setOptionsState((o) => ({ ...DEFAULT_OPTIONS, mode: o.mode, style: o.style }));
      transition(() => {
        setTab("home");
        setPhase("compose");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました。");
    } finally {
      setLoadingMedia(false);
      for (const r of [fileRef, photoCamRef, videoCamRef]) if (r.current) r.current.value = "";
    }
  };

  const run = async (opts: ComposeOptions, extra: string[], previous?: HaikuResult) => {
    if (!source || !opts.emotion) return;
    setError(null);
    const backTo: Phase = phase;
    const base = {
      images: source.frames,
      isVideo: source.kind === "video",
      moods: [EMOTION_HINT[opts.emotion]],
      notes: opts.notes,
      season: opts.season,
    };
    const key = analysisKey(opts);
    transition(() => setPhase("generating"));
    try {
      let read = analysis?.key === key ? analysis.value : null;
      if (!read) {
        setGenStep("analyze");
        setAnalysis(null);
        read = await analyzeImage(base);
        setAnalysis({ key, value: read });
      }
      setGenStep("compose");
      const result = await generateHaiku({
        ...base,
        analysis: read,
        style: opts.style === "auto" ? undefined : opts.style,
        previous: previous ? { lines: previous.lines } : undefined,
        extraConditions: extra.length ? extra : undefined,
      });
      transition(() => {
        setHaiku(result);
        setConditions(extra);
        setPhase("result");
      });
    } catch (e) {
      if (e instanceof PasscodeError) {
        setPasscode("");
        setNeedPasscode(true);
      }
      setError(e instanceof Error ? e.message : "句の生成に失敗しました。");
      setPhase(backTo === "generating" ? "compose" : backTo);
    }
  };

  /** 自分で詠むときの、写真からのヒント。AI の句と同じ分析を使う */
  const requestHints = async () => {
    if (!source) return;
    setHintLoading(true);
    setError(null);
    try {
      const key = analysisKey(options);
      const value = analysis?.key === key ? analysis.value : await analyzeImage(analysisInput(options));
      setAnalysis({ key, value });
    } catch (e) {
      if (e instanceof PasscodeError) {
        setPasscode("");
        setNeedPasscode(true);
      }
      setError(e instanceof Error ? e.message : "写真を読み取れませんでした。");
    } finally {
      setHintLoading(false);
    }
  };

  const analysisInput = (opts: ComposeOptions) => ({
    images: source!.frames,
    isVideo: source!.kind === "video",
    moods: opts.emotion ? [EMOTION_HINT[opts.emotion]] : [],
    notes: opts.notes,
    season: opts.season,
  });

  /** 自分の句で仕上げる。読み取りが済んでいれば、主役を避けて置くのに使う */
  const finishSelf = (mora: MoraResult | null) => {
    const lines = options.selfLines.map((l) => l.trim());
    const found = findKigo(lines);
    const hint = analysis?.value;
    const season: Season =
      options.season !== "auto" ? options.season : found?.season ?? (hint?.season && hint.season !== "none" ? hint.season : "none");
    const result: HaikuResult = {
      lines,
      readings: mora?.readings ?? [],
      mora: mora?.mora ?? [0, 0, 0],
      ok: mora?.ok ?? false,
      kigo: found?.kigo ?? "",
      season,
      note: "",
      subject: hint?.subject ?? null,
      analysis: hint,
      attempts: 0,
      self: true,
    };
    setError(null);
    transition(() => {
      setHaiku(result);
      setConditions([]);
      setPhase("result");
    });
  };

  const selectTab = (t: Tab) => {
    // ホームにいるときにホームを押したら、最初の画面に戻る。詠んでいる最中は待つ
    const toTop = t === "home" && tab === "home" && phase !== "generating" && phase !== "home";
    if (t === tab && !toTop) return;
    transition(() => {
      if (toTop) setPhase("home");
      setTab(t);
    });
  };

  if (needPasscode) {
    return (
      <div className="app">
        <PasscodeGate
          onPass={(code) => {
            setPasscode(code);
            setNeedPasscode(false);
            setError(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="app with-tabbar">
      <InkDefs />
      {splash && <Splash onDone={endSplash} />}
      <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={photoCamRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={videoCamRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {tab === "home" && phase === "home" && (
        <main className="home">
          <HomeBackdrop />
          <VerticalTitle />
          <p className="home-lead">
            撮って、選んで、ここで一句。
            <br />
            AI に詠ませても、自分で詠んでも。
          </p>
          <div className="home-action">
            {loadingMedia ? (
              <p className="home-loading">読み込み中…</p>
            ) : (
              <>
                <div className="capture-row">
                  <button className="btn primary big capture" onClick={() => photoCamRef.current?.click()}>
                    <CameraIcon size={28} />
                    写真を撮る
                  </button>
                  <button className="btn primary big capture" onClick={() => videoCamRef.current?.click()}>
                    <VideoIcon size={28} />
                    動画を撮る
                  </button>
                </div>
                <button className="btn big" onClick={pickFile}>
                  <ImageIcon size={22} />
                  アルバムから選ぶ
                </button>
              </>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          {mock && <p className="mock-note">API キー未設定のため、見本の句を返すモードで動いています。</p>}
        </main>
      )}

      {tab === "home" && phase === "compose" && source && (
        <ComposeScreen
          source={source}
          options={options}
          onChange={setOptions}
          onChangeMedia={pickFile}
          loadingMedia={loadingMedia}
          error={error}
          onSubmit={() => run(options, [])}
          onSubmitSelf={finishSelf}
          hints={analysis?.key === analysisKey(options) ? analysis.value : null}
          hintLoading={hintLoading}
          onRequestHints={requestHints}
          onBack={() => transition(() => setPhase("home"))}
        />
      )}

      {tab === "home" && phase === "generating" && source && <GeneratingScreen step={genStep} analysis={analysis?.value ?? null} source={source} />}

      {tab === "home" && phase === "result" && source && haiku && (
        <ResultScreen
          source={source}
          haiku={haiku}
          sealName={settings.sealName}
          defaultTone={settings.defaultTone}
          autoGallery={settings.autoGallery}
          finishPrefs={{ font: settings.font, gafu: settings.gafu, blur: settings.blur, smudge: settings.smudge, grain: settings.grain, frame: settings.frame }}
          onFinishPrefs={updateSettings}
          conditions={conditions}
          error={error}
          onRegenerate={(extra) => run(options, extra, haiku)}
          onReplace={(lines, mora, ok) => {
            const found = findKigo(lines);
            setHaiku({ ...haiku, lines, mora, ok, note: "", readings: [], kigo: found?.kigo ?? "", mock: false, self: true });
          }}
          onNewMedia={() => transition(() => setPhase("home"))}
        />
      )}

      {tab === "gallery" && (
        <GalleryScreen
          onStart={() =>
            transition(() => {
              setTab("home");
              setPhase("home");
            })
          }
        />
      )}
      {tab === "world" && <WorldScreen />}
      {tab === "zukan" && <ZukanScreen />}
      {tab === "settings" && <SettingsScreen settings={settings} onChange={updateSettings} mock={mock} />}

      <TabBar current={tab} onSelect={selectTab} />
    </div>
  );
}
