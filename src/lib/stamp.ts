/**
 * 落款を押す瞬間の演出。
 * t（印が紙に当たってからの秒数）だけで決まるように作り、録画でも同じ絵になるようにする。
 */

const SHU = "181,51,42";
const GOLD = "232,190,96";

/** 演出が続く長さ。これを過ぎると何も描かない */
export const IMPACT_DUR = 1.3;

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

/** 当たった衝撃で画面を揺らす量。端が見えないよう、少し拡大して揺らす */
export function impactShake(ti: number, unit: number): { dx: number; dy: number; zoom: number } | null {
  if (ti < 0 || ti > 0.55) return null;
  const k = Math.exp(-ti * 8);
  const amp = unit * 0.018 * k;
  return {
    dx: Math.sin(ti * 83) * amp,
    dy: Math.cos(ti * 67) * amp * 0.8,
    zoom: 1 + 0.04 * k,
  };
}

/** 印が降りてくる間に周りを暗くし、当たったら明るく戻す */
export function drawAnticipation(ctx: CanvasRenderingContext2D, W: number, H: number, cx: number, cy: number, drop: number, ti: number) {
  let a = 0;
  if (ti < 0) a = 0.4 * drop * drop;
  else a = 0.4 * (1 - clamp01(ti / 0.35));
  if (a <= 0.003) return;
  const r = Math.hypot(W, H);
  const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(8,5,3,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** 印の後ろに描く。集中線と衝撃波 */
export function drawImpactBack(ctx: CanvasRenderingContext2D, ti: number, cx: number, cy: number, size: number, W: number, H: number) {
  if (ti < 0 || ti > IMPACT_DUR) return;
  const far = Math.hypot(W, H);

  // 集中線。漫画のように中心へ向かう細い楔を並べる
  const lp = clamp01(ti / 0.5);
  if (lp < 1) {
    const r = rand(77);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2 + r() * 0.08;
      const width = (0.002 + r() * 0.008) * Math.PI;
      const inner = size * (1.1 + r() * 0.9) + easeOut(lp) * size * 1.6;
      const alpha = (1 - lp) * (0.2 + r() * 0.4);
      ctx.fillStyle = r() < 0.25 ? `rgba(${GOLD},${alpha})` : `rgba(255,246,232,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a - width) * far, cy + Math.sin(a - width) * far);
      ctx.lineTo(cx + Math.cos(a + width) * far, cy + Math.sin(a + width) * far);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 衝撃波。朱、金、朱の順に少しずつ遅らせて広げる
  const rings: [number, string, number][] = [
    [0, SHU, 0.16],
    [0.07, GOLD, 0.09],
    [0.16, SHU, 0.05],
  ];
  for (const [delay, color, thick] of rings) {
    const p = clamp01((ti - delay) / 0.75);
    if (p <= 0 || p >= 1) continue;
    const radius = size * (0.7 + easeOut(p) * 4.2);
    ctx.save();
    ctx.strokeStyle = `rgba(${color},${(1 - p) * 0.9})`;
    ctx.lineWidth = size * thick * (1 - p * 0.7);
    ctx.shadowColor = `rgba(${color},0.8)`;
    ctx.shadowBlur = size * 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** 印の前に描く。朱の飛沫、金箔、閃光 */
export function drawImpactFront(ctx: CanvasRenderingContext2D, ti: number, cx: number, cy: number, size: number, W: number, H: number) {
  if (ti < 0 || ti > IMPACT_DUR) return;
  const r = rand(311);

  // 朱の飛沫。勢いよく飛び出し、重力で少し落ちながら消える
  for (let i = 0; i < 42; i++) {
    const a = r() * Math.PI * 2;
    const speed = size * (2.5 + r() * 6);
    const rad = size * (0.03 + r() * r() * 0.13);
    const life = 0.55 + r() * 0.6;
    const p = ti / life;
    if (p >= 1) continue;
    const d = speed * easeOut(clamp01(ti / 0.6)) * 0.7;
    const x = cx + Math.cos(a) * (size * 0.5 + d);
    const y = cy + Math.sin(a) * (size * 0.5 + d) + size * 1.6 * ti * ti;
    const stretch = 1 + (1 - clamp01(ti / 0.25)) * 2.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.scale(stretch, 1 / Math.sqrt(stretch));
    ctx.fillStyle = `rgba(${SHU},${(1 - p) * 0.95})`;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 金箔。ひらひら回りながら舞い散る
  for (let i = 0; i < 36; i++) {
    const a = r() * Math.PI * 2;
    const speed = size * (1.5 + r() * 4.5);
    const s = size * (0.05 + r() * 0.09);
    const spin = (r() - 0.5) * 18;
    const life = 0.8 + r() * 0.5;
    const p = ti / life;
    if (p >= 1) continue;
    const d = speed * easeOut(clamp01(ti / 0.8));
    const x = cx + Math.cos(a) * d + Math.sin(ti * 6 + i) * size * 0.15;
    const y = cy + Math.sin(a) * d + size * 0.9 * ti * ti;
    const flip = Math.abs(Math.cos(ti * spin));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ti * spin);
    ctx.scale(1, 0.25 + flip * 0.75);
    ctx.fillStyle = `rgba(${flip > 0.7 ? "255,236,170" : GOLD},${(1 - p * p) * 0.95})`;
    ctx.fillRect(-s / 2, -s / 2, s, s * 0.8);
    ctx.restore();
  }

  // 当たった瞬間の閃光
  const fp = clamp01(ti / 0.22);
  if (fp < 1) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * 0.7);
    const a = Math.pow(1 - fp, 2);
    g.addColorStop(0, `rgba(255,250,235,${0.95 * a})`);
    g.addColorStop(0.25, `rgba(255,220,190,${0.55 * a})`);
    g.addColorStop(1, `rgba(255,200,160,${0.15 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/** 押した直後、印のまわりをしばらく朱く光らせる */
export function sealGlow(ti: number): number {
  if (ti < 0) return 0;
  return Math.exp(-ti * 2.6);
}
