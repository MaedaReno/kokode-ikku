/** 画風（古写真・浮世絵）と、主役を避けたぼかし・ずらしの加工 */

export type Gafu = "none" | "oldphoto" | "ukiyoe";

export const GAFU_LABEL: Record<Gafu, string> = {
  none: "そのまま",
  oldphoto: "古写真",
  ukiyoe: "浮世絵",
};

type Rect = { x: number; y: number; w: number; h: number };

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 守る範囲のマスク。主役の上は不透明、離れるほど透明になる。
 * 主役が分からないときは、画面中央を守る。
 */
export function protectMask(W: number, H: number, subject: Rect | null): HTMLCanvasElement {
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  const unit = Math.min(W, H);
  const r = subject ?? { x: 0.25, y: 0.2, w: 0.5, h: 0.6 };
  const pad = unit * 0.04;
  const x = r.x * W - pad;
  const y = r.y * H - pad;
  const w = r.w * W + pad * 2;
  const h = r.h * H + pad * 2;
  const feather = unit * 0.14;
  // ぼかした角丸の四角で、縁をなめらかにする
  ctx.filter = `blur(${feather * 0.5}px)`;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, unit * 0.06);
  ctx.fill();
  ctx.filter = "none";
  if (!ctxSupportsFilter(ctx)) {
    // filter が効かない環境向け: 外側に向かって薄くなる枠を重ねて代用する
    for (let i = 1; i <= 8; i++) {
      const g = (feather * i) / 8;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.roundRect(x - g, y - g, w + g * 2, h + g * 2, unit * 0.06 + g);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  return c;
}

let filterSupport: boolean | null = null;
function ctxSupportsFilter(ctx: CanvasRenderingContext2D) {
  if (filterSupport === null) filterSupport = typeof ctx.filter === "string";
  return filterSupport;
}

/**
 * なめらかにぼかす。canvas の filter が使えればそれを使い、
 * 使えない環境では半分ずつ縮めてから拡大して、モザイク状にならないようにする。
 */
function blurred(src: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const W = src.width;
  const H = src.height;
  const out = makeCanvas(W, H);
  const octx = out.getContext("2d")!;
  if (ctxSupportsFilter(octx)) {
    // 端が透けないよう、少し外まで描いてからぼかす
    octx.filter = `blur(${radius}px)`;
    octx.drawImage(src, -radius, -radius, W + radius * 2, H + radius * 2);
    octx.filter = "none";
    return out;
  }
  let cur: HTMLCanvasElement = src;
  const steps = Math.max(1, Math.round(Math.log2(radius / 2)));
  for (let i = 0; i < steps; i++) {
    const next = makeCanvas(cur.width / 2, cur.height / 2);
    const n = next.getContext("2d")!;
    n.imageSmoothingQuality = "high";
    n.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
  }
  for (let i = 0; i < steps - 1; i++) {
    const next = makeCanvas(cur.width * 2, cur.height * 2);
    const n = next.getContext("2d")!;
    n.imageSmoothingQuality = "high";
    n.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
  }
  octx.imageSmoothingQuality = "high";
  octx.drawImage(cur, 0, 0, W, H);
  return out;
}

/** 主役の外側だけをぼかす。外へ行くほど強くかかる */
export function applyBlur(target: HTMLCanvasElement, mask: HTMLCanvasElement, strength = 0.9) {
  const ctx = target.getContext("2d")!;
  const unit = Math.min(target.width, target.height);
  const layer = blurred(target, Math.max(4, Math.round(unit / 110)));
  const lctx = layer.getContext("2d")!;
  lctx.globalCompositeOperation = "destination-out";
  lctx.drawImage(mask, 0, 0);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

/**
 * 指先でこすってずらしたような筋。主役から離れた場所を選び、
 * 帯状に切り出した画像を少しずつずらして重ねる。主役の上の筋は消す。
 */
export function applySmudge(target: HTMLCanvasElement, mask: HTMLCanvasElement, subject: Rect | null, seed = 7) {
  const W = target.width;
  const H = target.height;
  const unit = Math.min(W, H);
  const r = rand(seed);
  const layer = makeCanvas(W, H);
  const lctx = layer.getContext("2d")!;
  const avoid = subject ?? { x: 0.25, y: 0.2, w: 0.5, h: 0.6 };
  let made = 0;
  for (let tries = 0; tries < 60 && made < 10; tries++) {
    const bandH = unit * (0.006 + r() * 0.014);
    const bandW = W * (0.15 + r() * 0.25);
    const x = r() * (W - bandW);
    const y = r() * (H - bandH);
    const cx = (x + bandW / 2) / W;
    const cy = (y + bandH / 2) / H;
    const margin = 0.08;
    if (cx > avoid.x - margin && cx < avoid.x + avoid.w + margin && cy > avoid.y - margin && cy < avoid.y + avoid.h + margin) continue;
    made++;
    const dir = r() < 0.5 ? 1 : -1;
    const steps = 14;
    const reach = bandW * (0.25 + r() * 0.25);
    const tilt = (r() - 0.5) * 0.25;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      lctx.globalAlpha = 0.3 * (1 - k * 0.6);
      lctx.drawImage(target, x, y, bandW, bandH, x + dir * reach * k, y + tilt * reach * k, bandW * (1 + k * 0.1), bandH);
    }
  }
  // 筋の端をやわらかくする
  lctx.globalAlpha = 1;
  lctx.globalCompositeOperation = "destination-out";
  lctx.drawImage(mask, 0, 0);
  const ctx = target.getContext("2d")!;
  ctx.drawImage(layer, 0, 0);
}

/** 色あせた古写真。セピア、ムラ、引っかき傷、ほこり。傷とほこりは主役の上には付けない */
export function applyOldPhoto(target: HTMLCanvasElement, seed: number, mask: HTMLCanvasElement) {
  const ctx = target.getContext("2d")!;
  const W = target.width;
  const H = target.height;
  const unit = Math.min(W, H);
  const r = rand(seed);
  ctx.save();
  ctx.globalCompositeOperation = "saturation";
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "color";
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#8a6237";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#3a2c1c";
  ctx.fillRect(0, 0, W, H);
  // 露光のムラ
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 6; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = unit * (0.2 + r() * 0.4);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(120,80,40,0.22)");
    g.addColorStop(1, "rgba(120,80,40,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // 引っかき傷とほこりは別の層に描き、主役の上を消してから重ねる
  const marks = makeCanvas(W, H);
  const m = marks.getContext("2d")!;
  for (let i = 0; i < 9; i++) {
    const x = r() * W;
    m.globalAlpha = 0.12 + r() * 0.2;
    m.strokeStyle = r() < 0.6 ? "#f4ead6" : "#2a1e12";
    m.lineWidth = Math.max(1, unit * 0.0012);
    m.beginPath();
    m.moveTo(x, r() * H * 0.3);
    m.lineTo(x + (r() - 0.5) * unit * 0.03, H * (0.6 + r() * 0.4));
    m.stroke();
  }
  for (let i = 0; i < 120; i++) {
    m.globalAlpha = 0.2 + r() * 0.4;
    m.fillStyle = r() < 0.5 ? "#f6eedc" : "#1e140b";
    m.beginPath();
    m.arc(r() * W, r() * H, unit * (0.0008 + r() * 0.0025), 0, Math.PI * 2);
    m.fill();
  }
  m.globalAlpha = 1;
  m.globalCompositeOperation = "destination-out";
  m.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(marks, 0, 0);
  // 焼けた四隅
  ctx.globalAlpha = 1;
  const v = ctx.createRadialGradient(W / 2, H / 2, unit * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  v.addColorStop(0, "rgba(40,24,10,0)");
  v.addColorStop(1, "rgba(40,24,10,0.65)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

const UKIYOE_PALETTE: [number, number, number][] = [
  [29, 24, 19], // 墨
  [43, 58, 85], // 藍
  [70, 102, 130], // 縹
  [138, 168, 176], // 水浅葱
  [188, 64, 47], // 朱
  [214, 162, 76], // 黄土
  [122, 140, 74], // 若草
  [74, 96, 62], // 松葉
  [232, 201, 160], // 肌
  [242, 234, 216], // 胡粉
  [150, 112, 82], // 煤竹
  [128, 166, 196], // 空色
  [138, 138, 128], // 鼠
  [196, 192, 180], // 薄鼠
];

function nearestIndex(r: number, g: number, b: number) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < UKIYOE_PALETTE.length; i++) {
    const [pr, pg, pb] = UKIYOE_PALETTE[i];
    const d = (r - pr) ** 2 * 0.3 + (g - pg) ** 2 * 0.59 + (b - pb) ** 2 * 0.11;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** 浮世絵風。限られた和の色に塗り分け、輪郭に墨の線を入れる */
export function applyUkiyoe(target: HTMLCanvasElement, maxSide = 900) {
  const W = target.width;
  const H = target.height;
  const s = Math.min(1, maxSide / Math.max(W, H));
  const work = makeCanvas(W * s, H * s);
  const wctx = work.getContext("2d", { willReadFrequently: true })!;
  wctx.drawImage(target, 0, 0, work.width, work.height);
  const w = work.width;
  const h = work.height;
  const img = wctx.getImageData(0, 0, w, h);
  const d = img.data;
  const idx = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) idx[i] = nearestIndex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  // 小さな色の粒を、周りで多い色に塗りつぶして、版画らしい平らな面にする
  const smooth = new Uint8Array(idx);
  const counts = new Uint16Array(UKIYOE_PALETTE.length);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      counts.fill(0);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) counts[idx[(y + dy) * w + x + dx]]++;
      let best = idx[y * w + x];
      for (let k = 0; k < counts.length; k++) if (counts[k] > counts[best]) best = k;
      smooth[y * w + x] = best;
    }
  }
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = UKIYOE_PALETTE[smooth[i]];
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
  }
  // 色の境目に墨の輪郭線
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (smooth[i] !== smooth[i + 1] || smooth[i] !== smooth[i + w]) {
        d[i * 4] = 40;
        d[i * 4 + 1] = 31;
        d[i * 4 + 2] = 24;
      }
    }
  }
  wctx.putImageData(img, 0, 0);
  const ctx = target.getContext("2d")!;
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(work, 0, 0, W, H);
  // 和紙の地
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(236,222,190,0.35)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** フィルムのような粒子。粗めの粒を重ねて、ざらっとした手触りにする */
export function applyGrain(target: HTMLCanvasElement, pattern: CanvasPattern, seed: number, strength = 0.3) {
  const ctx = target.getContext("2d")!;
  const W = target.width;
  const H = target.height;
  const r = rand(Math.floor(seed));
  // 細かい粒と粗い粒を重ねる
  for (const [scale, alpha] of [
    [Math.max(1, Math.max(W, H) / 1400), strength],
    [Math.max(2, Math.max(W, H) / 600), strength * 0.6],
  ] as const) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = alpha;
    ctx.scale(scale, scale);
    ctx.translate(-r() * 256, -r() * 256);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W / scale + 256, H / scale + 256);
    ctx.restore();
  }
}
