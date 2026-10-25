/** 写真に重ねる和風の演出。時刻 t から位置が決まるので、動画でも静止画でも同じ絵になる */

export type Effect = "sakura" | "hanabi" | "momiji" | "yuki" | "kinpaku" | "none";

export const EFFECT_LABEL: Record<Effect, string> = {
  sakura: "桜吹雪",
  hanabi: "花火",
  momiji: "紅葉",
  yuki: "雪",
  kinpaku: "金箔",
  none: "なし",
};

type Rect = { x: number; y: number; w: number; h: number };

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Particle = {
  x0: number;
  y0: number;
  speed: number;
  sway: number;
  freq: number;
  phase: number;
  spin: number;
  size: number;
  hue: number;
  front: boolean;
};

const cache = new Map<string, Particle[]>();

function particles(effect: Effect, count: number): Particle[] {
  const key = `${effect}:${count}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rand(effect.length * 97 + count);
  const list = Array.from({ length: count }, () => ({
    x0: r(),
    y0: r(),
    speed: 0.05 + r() * 0.07,
    sway: 0.015 + r() * 0.04,
    freq: 0.6 + r() * 1.2,
    phase: r() * Math.PI * 2,
    spin: (r() - 0.5) * 4,
    size: 0.6 + r() * 0.8,
    hue: r(),
    front: r() < 0.22,
  }));
  cache.set(key, list);
  return list;
}

/** 守る範囲からの距離で、粒の濃さを決める。範囲の中は0、縁から feather 離れると1 */
function visibility(x: number, y: number, rects: Rect[], W: number, H: number, pad: number, feather: number) {
  let v = 1;
  for (const r of rects) {
    const x0 = r.x * W - pad;
    const y0 = r.y * H - pad;
    const x1 = (r.x + r.w) * W + pad;
    const y1 = (r.y + r.h) * H + pad;
    const dx = Math.max(x0 - x, 0, x - x1);
    const dy = Math.max(y0 - y, 0, y - y1);
    v = Math.min(v, Math.min(1, Math.hypot(dx, dy) / feather));
  }
  return v;
}

function inside(x: number, y: number, rects: Rect[], W: number, H: number) {
  return rects.some((r) => x > r.x * W && x < (r.x + r.w) * W && y > r.y * H && y < (r.y + r.h) * H);
}

function fall(p: Particle, t: number, W: number, H: number, speedScale = 1) {
  const span = 1.25;
  const y = (((p.y0 + p.speed * speedScale * t) % span) - 0.12) * H;
  const x = ((p.x0 + Math.sin(p.freq * t + p.phase) * p.sway + 0.012 * t + 1) % 1) * W;
  return { x, y };
}

function petal(ctx: CanvasRenderingContext2D, s: number) {
  // 先に切れ込みのある、桜の花びら
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 0.9, s * 0.4, -s * 0.7, -s * 0.8, -s * 0.15, -s * 0.9);
  ctx.lineTo(0, -s * 0.6);
  ctx.lineTo(s * 0.15, -s * 0.9);
  ctx.bezierCurveTo(s * 0.7, -s * 0.8, s * 0.9, s * 0.4, 0, s * 0.9);
  ctx.closePath();
}

/** もみじの葉。中央が長い五つの裂片と、短い柄 */
const MAPLE_LOBES: [number, number][] = [
  [-90, 1],
  [-38, 0.88],
  [-142, 0.88],
  [8, 0.6],
  [172, 0.6],
];

function mapleLeaf(ctx: CanvasRenderingContext2D, s: number) {
  const pts: [number, number][] = [];
  const lobes = [...MAPLE_LOBES].sort((a, b) => a[0] - b[0]);
  const deg = (d: number) => (d * Math.PI) / 180;
  const start = 40;
  pts.push([Math.cos(deg(start + 50)) * s * 0.18, Math.sin(deg(start + 50)) * s * 0.18]);
  for (let i = 0; i < lobes.length; i++) {
    const [a, len] = lobes[i];
    const prev = i === 0 ? 172 - 360 + 0 : lobes[i - 1][0];
    const valley = i === 0 ? a - 30 : (a + prev) / 2;
    pts.push([Math.cos(deg(valley)) * s * 0.32, Math.sin(deg(valley)) * s * 0.32]);
    // 裂片の縁のぎざぎざ
    pts.push([Math.cos(deg(a - 9)) * s * len * 0.7, Math.sin(deg(a - 9)) * s * len * 0.7]);
    pts.push([Math.cos(deg(a - 4)) * s * len * 0.78, Math.sin(deg(a - 4)) * s * len * 0.78]);
    pts.push([Math.cos(deg(a)) * s * len, Math.sin(deg(a)) * s * len]);
    pts.push([Math.cos(deg(a + 4)) * s * len * 0.78, Math.sin(deg(a + 4)) * s * len * 0.78]);
    pts.push([Math.cos(deg(a + 9)) * s * len * 0.7, Math.sin(deg(a + 9)) * s * len * 0.7]);
  }
  pts.push([Math.cos(deg(200)) * s * 0.32, Math.sin(deg(200)) * s * 0.32]);
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function mapleStem(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.1);
  ctx.quadraticCurveTo(s * 0.05, s * 0.45, s * 0.12, s * 0.7);
}

/** 季節の色を、画面の上の隅にほんのり重ねて華やかにする */
function glow(ctx: CanvasRenderingContext2D, W: number, H: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const cx of [0, W]) {
    const g = ctx.createRadialGradient(cx, 0, 0, cx, 0, Math.max(W, H) * 0.55);
    g.addColorStop(0, color.replace("ALPHA", String(alpha)));
    g.addColorStop(1, color.replace("ALPHA", "0"));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

/**
 * layer "back" は句の後ろ、"front" は句の手前に少しだけ描いて奥行きを出す。
 * 主役の上と、その周りでは粒を消して、顔や大事な部分を隠さない。手前の粒は句の上でも消す。
 */
export function drawEffect(
  ctx: CanvasRenderingContext2D,
  effect: Effect,
  t: number,
  W: number,
  H: number,
  layer: "back" | "front",
  subject: Rect | null,
  block: Rect | null,
  fadeIn: number,
) {
  const avoid = [subject, block].filter((r): r is Rect => !!r);
  const keepOff = layer === "front" ? avoid : subject ? [subject] : [];
  if (effect === "none") return;
  const unit = Math.min(W, H);
  ctx.save();
  ctx.globalAlpha = fadeIn;

  if (effect === "hanabi") {
    if (layer === "back") drawFireworks(ctx, t, W, H, unit, avoid);
    ctx.restore();
    return;
  }

  if (layer === "back") {
    const tint = { sakura: "rgba(255,170,200,ALPHA)", momiji: "rgba(255,120,40,ALPHA)", yuki: "rgba(220,235,255,ALPHA)", kinpaku: "rgba(255,210,120,ALPHA)" }[effect];
    glow(ctx, W, H, tint, 0.22);
  }

  const count = Math.round((effect === "yuki" ? 110 : effect === "kinpaku" ? 70 : 60) * Math.sqrt((W * H) / (1080 * 1350)));
  for (const p of particles(effect, count)) {
    if (p.front !== (layer === "front")) continue;
    const speedScale = effect === "yuki" ? 0.7 : effect === "kinpaku" ? 0.45 : 1;
    const { x, y } = fall(p, t, W, H, speedScale);
    const scale = p.front ? 1.7 : 1;
    const a = visibility(x, y, keepOff, W, H, unit * 0.04, unit * 0.1);
    if (a <= 0.01) continue;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.phase + p.spin * t);

    if (effect === "sakura") {
      const s = unit * 0.016 * p.size * scale;
      ctx.scale(Math.cos(p.freq * t * 1.6 + p.phase) * 0.5 + 0.6, 1);
      const g = ctx.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, "#ffe9ef");
      g.addColorStop(1, p.hue > 0.5 ? "#f5a9c0" : "#f8bfd0");
      ctx.globalAlpha = fadeIn * 0.92 * a;
      ctx.fillStyle = g;
      petal(ctx, s);
      ctx.fill();
    } else if (effect === "momiji") {
      const s = unit * 0.03 * p.size * scale;
      ctx.scale(Math.cos(p.freq * t + p.phase) * 0.4 + 0.7, 1);
      ctx.globalAlpha = fadeIn * 0.9 * a;
      ctx.fillStyle = p.hue < 0.45 ? "#c8321c" : p.hue < 0.8 ? "#e2662a" : "#eaa53a";
      mapleLeaf(ctx, s);
      ctx.fill();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = s * 0.07;
      mapleStem(ctx, s);
      ctx.stroke();
    } else if (effect === "yuki") {
      const s = unit * 0.006 * p.size * scale;
      ctx.globalAlpha = fadeIn * (0.55 + p.hue * 0.4) * a;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = s * 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect === "kinpaku") {
      const s = unit * 0.011 * p.size * scale;
      const shimmer = 0.5 + 0.5 * Math.sin(t * 3 + p.phase * 3);
      ctx.globalAlpha = fadeIn * (0.45 + shimmer * 0.5) * a;
      const g = ctx.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, "#fff1b8");
      g.addColorStop(0.5, "#d9a53b");
      g.addColorStop(1, "#a8761e");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.6);
      ctx.lineTo(s * 0.8, -s);
      ctx.lineTo(s, s * 0.5);
      ctx.lineTo(-s * 0.6, s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** 夜空に開く花火。句と主役に重ならない場所を選んで、周期的に上げる */
const BURST_SPOTS = [
  { x: 0.2, y: 0.16 },
  { x: 0.5, y: 0.12 },
  { x: 0.8, y: 0.15 },
  { x: 0.3, y: 0.34 },
  { x: 0.7, y: 0.33 },
  { x: 0.15, y: 0.5 },
  { x: 0.85, y: 0.5 },
  { x: 0.5, y: 0.45 },
];
const BURST_COLORS = ["255,206,96", "255,96,96", "150,220,255", "255,150,220", "180,255,170"];

function drawFireworks(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, unit: number, avoid: Rect[]) {
  const maxR = unit * 0.2;
  const clear = BURST_SPOTS.filter((p) => {
    const box = { x: (p.x * W - maxR) / W, y: (p.y * H - maxR) / H, w: (maxR * 2) / W, h: (maxR * 2) / H };
    return !avoid.some((r) => box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y);
  });
  const spots = (clear.length >= 2 ? clear : BURST_SPOTS.slice(0, 3)).slice(0, 4);
  const period = 3.0;
  const life = 2.1;
  ctx.globalCompositeOperation = "lighter";
  spots.forEach((spot, n) => {
    const offset = (n * period) / spots.length;
    const local = (t + offset) % period;
    if (local > life) return;
    const k = local / life;
    const color = BURST_COLORS[(n + Math.floor((t + offset) / period)) % BURST_COLORS.length];
    const fade = k < 0.1 ? k / 0.1 : Math.pow(1 - (k - 0.1) / 0.9, 1.3);
    const cx = spot.x * W;
    const cy = spot.y * H;
    const grow = 1 - Math.pow(1 - Math.min(1, k * 1.5), 3);
    const drop = unit * 0.06 * k * k;

    for (const ring of [
      { r: maxR * grow, rays: 48, width: 0.006, alpha: 1 },
      { r: maxR * 0.55 * grow, rays: 28, width: 0.005, alpha: 0.8 },
    ]) {
      for (let i = 0; i < ring.rays; i++) {
        const a = (i / ring.rays) * Math.PI * 2 + n;
        const x1 = cx + Math.cos(a) * ring.r;
        const y1 = cy + Math.sin(a) * ring.r + drop;
        const x0 = cx + Math.cos(a) * ring.r * 0.55;
        const y0 = cy + Math.sin(a) * ring.r * 0.55 + drop * 0.6;
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, `rgba(${color},0)`);
        g.addColorStop(1, `rgba(${color},${ring.alpha * fade})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = unit * ring.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        const twinkle = 0.6 + 0.4 * Math.sin(t * 20 + i);
        ctx.fillStyle = `rgba(255,250,230,${fade * twinkle})`;
        ctx.beginPath();
        ctx.arc(x1, y1, unit * 0.005, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 1.5);
    g.addColorStop(0, `rgba(${color},${0.35 * fade})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - maxR * 1.5, cy - maxR * 1.5, maxR * 3, maxR * 3);
  });
  ctx.globalCompositeOperation = "source-over";
}
