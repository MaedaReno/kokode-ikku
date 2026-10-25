import { useEffect, useState } from "react";
import { playSeal, buzz } from "../lib/sound";

const TITLE = [..."ここで一句"];
/** 墨のしずくの位置。中心の大きなにじみのまわりに散らす */
const DROPS = [
  { x: 92, y: 120, r: 9, d: 0.35 },
  { x: 318, y: 96, r: 6, d: 0.45 },
  { x: 300, y: 318, r: 11, d: 0.4 },
  { x: 70, y: 290, r: 5, d: 0.55 },
  { x: 250, y: 60, r: 4, d: 0.6 },
];

const SEAL_AT = 2450;
const END_AT = 3500;

/** 起動したときに一度だけ流す。タップで飛ばせる */
export function Splash({ onDone }: { onDone: () => void }) {
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // 字が別の書体で一瞬出ないよう、筆の書体が届いてから始める
    const timeout = new Promise((r) => setTimeout(r, 1200));
    Promise.race([document.fonts.load(`80px "Potta One"`, TITLE.join("")), timeout]).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const seal = setTimeout(() => {
      playSeal();
      buzz(25);
    }, SEAL_AT);
    const leave = setTimeout(() => setLeaving(true), END_AT - 450);
    const done = setTimeout(onDone, END_AT);
    return () => {
      clearTimeout(seal);
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, [ready]);

  return (
    <div className={`splash ${ready ? "run" : ""} ${leaving ? "leaving" : ""}`} onClick={onDone} role="presentation">
      <svg className="splash-ink" viewBox="0 0 400 400" aria-hidden="true">
        <g filter="url(#ink-bleed)">
          <circle className="blot" cx="200" cy="205" r="118" />
          {DROPS.map((d, i) => (
            <circle key={i} className="drop" cx={d.x} cy={d.y} r={d.r} style={{ animationDelay: `${d.d}s` }} />
          ))}
        </g>
      </svg>
      <div className="splash-title">
        <h1 aria-label="ここで一句">
          {TITLE.map((c, i) => (
            <span key={i} style={{ animationDelay: `${1.0 + i * 0.24}s` }} aria-hidden="true">
              {c}
            </span>
          ))}
        </h1>
        <span className="splash-seal" aria-hidden="true">
          一句
        </span>
      </div>
      <p className="splash-skip">タップで飛ばす</p>
    </div>
  );
}

/** 墨のにじみと、紙の繊維の質感に使う SVG フィルター。アプリ全体で一度だけ置く */
export function InkDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="ink-bleed" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="38" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="2.2" />
        </filter>
        <filter id="ink-edge" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
