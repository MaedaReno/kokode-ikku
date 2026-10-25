import { drawFrameBorder, drawFramePaper, FRAME_INSET } from "./frame";
import { drawAnticipation, drawImpactBack, drawImpactFront, impactShake, sealGlow } from "./stamp";
import type { Source } from "./media";
import type { Season } from "./api";
import { drawEffect, type Effect } from "./effects";
import { applyBlur, applyGrain, applyOldPhoto, applySmudge, applyUkiyoe, protectMask, type Gafu } from "./finish";

export type FontStyle = "syuku" | "mai" | "potta" | "boku" | "dela" | "tokumin" | "kin";

export const FONT_LABEL: Record<FontStyle, string> = {
  syuku: "標準の筆",
  mai: "流れる筆",
  potta: "豪快な筆",
  boku: "極太の墨",
  dela: "極太ゴシック",
  tokumin: "太明朝",
  kin: "金文字",
};

export const FONT_FAMILY: Record<FontStyle, string> = {
  syuku: '"Yuji Syuku", "Shippori Mincho", serif',
  mai: '"Yuji Mai", "Yuji Syuku", serif',
  potta: '"Potta One", "Yuji Boku", serif',
  boku: '"Yuji Boku", "Yuji Syuku", serif',
  dela: '"Dela Gothic One", sans-serif',
  tokumin: '"Kaisei Tokumin", "Shippori Mincho", serif',
  kin: '"Potta One", "Yuji Boku", serif',
};

const FONT_WEIGHT: Partial<Record<FontStyle, number>> = { tokumin: 800 };

export type Tone = Season | "original";

export type Rect = { x: number; y: number; w: number; h: number };

export type RenderInput = {
  source: Source;
  lines: string[];
  tone: Tone;
  sealName: string;
  /** 主役の範囲（0〜1の割合）。文字を重ねない */
  subject: Rect | null;
  /** 利用者が動かした句の左上位置（0〜1の割合）。null ならおまかせ */
  placement: { x: number; y: number } | null;
  effect: Effect;
  gafu: Gafu;
  blur: boolean;
  smudge: boolean;
  grain: boolean;
  font: FontStyle;
  /** 作品全体を色紙のような枠で囲むか */
  frame: boolean;
};

export const BRUSH_FONT = '"Yuji Syuku", "Shippori Mincho", serif';
const SEAL_FONT = '"Shippori Mincho", serif';

const INK = "#1d1813";
const GOFUN = "#f6f0e4";
const SHU = "#b5332a";

/** 画面表示と動画はこの長辺まで。画像保存は元の大きさで描き直す */
export const PREVIEW_MAX = 1920;
/** iOS Safari の Canvas 上限（約1670万画素）を超えないための上限 */
export const EXPORT_MAX = 4096;

const TONES: Record<Tone, { tint: string; tintAlpha: number; desat: number; fade: number; vignette: number } | null> = {
  original: null,
  spring: { tint: "#e3b3ae", tintAlpha: 0.16, desat: 0.25, fade: 0.6, vignette: 0.28 },
  summer: { tint: "#5f9488", tintAlpha: 0.16, desat: 0.2, fade: 0.6, vignette: 0.28 },
  autumn: { tint: "#b47a3a", tintAlpha: 0.22, desat: 0.35, fade: 0.8, vignette: 0.32 },
  winter: { tint: "#64789a", tintAlpha: 0.22, desat: 0.45, fade: 0.8, vignette: 0.32 },
  newyear: { tint: "#c8a24f", tintAlpha: 0.16, desat: 0.25, fade: 0.6, vignette: 0.28 },
  none: { tint: "#8a7a63", tintAlpha: 0.18, desat: 0.4, fade: 0.8, vignette: 0.3 },
};

// ---------- 小道具 ----------

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function easeOut(p: number) {
  return 1 - Math.pow(1 - p, 3);
}

export function fitSize(w: number, h: number, max: number) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

let grainCanvas: HTMLCanvasElement | null = null;
function getGrain(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const r = rand(42);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
}

function makeSeal(name: string, size: number): HTMLCanvasElement {
  const pad = Math.round(size * 0.1);
  const c = makeCanvas(size + pad * 2, size + pad * 2);
  const ctx = c.getContext("2d")!;
  ctx.translate(pad, pad);
  ctx.fillStyle = SHU;
  ctx.fillRect(0, 0, size, size);

  // 陰刻: 文字を白く抜く
  const chars = [...(name.trim() || "一句")].slice(0, 4);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const inner = size * 0.8;
  const off = (size - inner) / 2;
  if (chars.length === 1) {
    ctx.font = `700 ${inner * 0.9}px ${SEAL_FONT}`;
    ctx.fillText(chars[0], size / 2, size / 2);
  } else if (chars.length === 2) {
    ctx.font = `700 ${inner * 0.48}px ${SEAL_FONT}`;
    ctx.fillText(chars[0], size / 2, off + inner * 0.26);
    ctx.fillText(chars[1], size / 2, off + inner * 0.76);
  } else {
    // 印は右上から縦に読む
    const cell = inner / 2;
    ctx.font = `700 ${cell * 0.9}px ${SEAL_FONT}`;
    const pos = [
      [1, 0],
      [1, 1],
      [0, 0],
      [0, 1],
    ];
    chars.forEach((ch, i) => {
      const [cx, cy] = pos[i];
      ctx.fillText(ch, off + cell * (cx + 0.5), off + cell * (cy + 0.52));
    });
  }
  const r = rand(name.length * 31 + 5);
  const dot = size / 100;
  for (let i = 0; i < 260; i++) {
    const x = r() * size;
    const y = r() * size;
    const edge = Math.min(x, y, size - x, size - y) < size * 0.08;
    if (!edge && r() < 0.6) continue;
    ctx.beginPath();
    ctx.arc(x, y, (0.6 + r() * (edge ? 3.2 : 1.6)) * dot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  return c;
}

// ---------- 画像の分析（文字を置く場所を探す） ----------

type Analysis = {
  w: number;
  h: number;
  /** 明るさと、輪郭の多さ（ごちゃつき）の累積和 */
  lumSum: Float64Array;
  edgeSum: Float64Array;
};

const analysisCache = new WeakMap<object, Analysis>();

function analyze(source: Source): Analysis {
  const cached = analysisCache.get(source.el);
  if (cached) return cached;
  const { w, h } = fitSize(source.width, source.height, 160);
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source.el, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
  }
  const edge = new Float64Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + w] - lum[i - w];
      edge[i] = Math.min(1, Math.hypot(gx, gy) * 4);
    }
  }
  const integral = (src: Float64Array) => {
    const out = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += src[y * w + x];
        out[(y + 1) * (w + 1) + x + 1] = out[y * (w + 1) + x + 1] + row;
      }
    }
    return out;
  };
  const result = { w, h, lumSum: integral(lum), edgeSum: integral(edge) };
  analysisCache.set(source.el, result);
  return result;
}

/** 割合で表した範囲の平均値 */
function regionMean(a: Analysis, sum: Float64Array, r: Rect): number {
  const x0 = Math.max(0, Math.floor(r.x * a.w));
  const y0 = Math.max(0, Math.floor(r.y * a.h));
  const x1 = Math.min(a.w, Math.ceil((r.x + r.w) * a.w));
  const y1 = Math.min(a.h, Math.ceil((r.y + r.h) * a.h));
  const area = (x1 - x0) * (y1 - y0);
  if (area <= 0) return 0;
  const W1 = a.w + 1;
  return (sum[y1 * W1 + x1] - sum[y0 * W1 + x1] - sum[y1 * W1 + x0] + sum[y0 * W1 + x0]) / area;
}

function overlapRatio(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / (a.w * a.h);
}

/** 主役に重ならず、ごちゃつきが少ない場所を選ぶ。伝統に倣い、右上をわずかに優先する */
function choosePlacement(a: Analysis, blockW: number, blockH: number, subject: Rect | null): { x: number; y: number } {
  const margin = 0.04;
  const steps = 14;
  let best = { x: 1 - margin - blockW, y: margin, score: Infinity };
  const maxX = Math.max(margin, 1 - margin - blockW);
  const maxY = Math.max(margin, 1 - margin - blockH);
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const x = margin + ((maxX - margin) * i) / steps;
      const y = margin + ((maxY - margin) * j) / steps;
      const r = { x, y, w: blockW, h: blockH };
      const busy = regionMean(a, a.edgeSum, r);
      const cover = subject ? overlapRatio(r, subject) : 0;
      const prefer = (1 - (x + blockW / 2)) * 0.03 + y * 0.02;
      const score = busy + cover * 2 + prefer;
      if (score < best.score) best = { x, y, score };
    }
  }
  return { x: best.x, y: best.y };
}

// ---------- レイアウト ----------

type Glyph = { ch: string; x: number; y: number; start: number };

export type Cue = { type: "stroke"; duration: number } | { type: "lift"; duration: number } | { type: "seal" };

type Layout = {
  fontSize: number;
  color: string;
  glyphs: Glyph[];
  writeEnd: number;
  seal: { x: number; y: number; size: number; start: number };
  duration: number;
  /** 句と落款を囲む範囲（ピクセル） */
  block: Rect;
};

const INTRO = 0.5;
const CHAR_DUR = 0.42;
const CHAR_GAP = 0.08;
const LINE_GAP = 0.45;
/** 印が浮き上がってから紙に当たるまで */
const SEAL_DUR = 0.55;
const HOLD = 2.0;
const ADVANCE = 1.06;
const STAGGER = 1.0;
const COL_GAP = 1.45;
const SEAL_RATIO = 1.05;

function computeLayout(input: RenderInput, W: number, H: number): Layout {
  const lines = input.lines.map((l) => [...l.replace(/\s+/g, "")]);
  const lens = lines.map((l) => Math.max(1, l.length));

  // 句の高さが画像の高さの8割に収まる範囲で、短辺の7%を基準にする
  const colEnd = (i: number) => (0.1 + i * STAGGER + lens[i] * ADVANCE);
  const last = lines.length - 1;
  const heightUnits = Math.max(...lens.map((_, i) => colEnd(i)), colEnd(last) + 0.35 + SEAL_RATIO);
  const widthUnits = (lines.length - 1) * COL_GAP + 1.2;
  let fontSize = Math.min(W, H) * 0.07;
  fontSize = Math.min(fontSize, (H * 0.8) / heightUnits, (W * 0.6) / widthUnits);

  const bw = widthUnits * fontSize;
  const bh = heightUnits * fontSize;

  const analysis = analyze(input.source);
  const pos = input.placement ?? choosePlacement(analysis, bw / W, bh / H, input.subject);
  const bx = Math.max(0, Math.min(W - bw, pos.x * W));
  const by = Math.max(0, Math.min(H - bh, pos.y * H));

  const glyphs: Glyph[] = [];
  let t = INTRO;
  lines.forEach((chars, li) => {
    const x = bx + bw - fontSize * 0.6 - li * COL_GAP * fontSize;
    const y0 = by + (0.1 + li * STAGGER) * fontSize;
    chars.forEach((ch, ci) => {
      glyphs.push({ ch, x, y: y0 + ci * ADVANCE * fontSize + fontSize / 2, start: t });
      t += CHAR_DUR + CHAR_GAP;
    });
    t += LINE_GAP;
  });
  const writeEnd = t - LINE_GAP - CHAR_GAP;

  const sealSize = Math.round(fontSize * SEAL_RATIO);
  const lastX = bx + bw - fontSize * 0.6 - last * COL_GAP * fontSize;
  const sealX = lastX - sealSize / 2;
  const sealY = by + (colEnd(last) + 0.35) * fontSize;
  const sealStart = writeEnd + 0.5;

  const block = { x: bx, y: by, w: bw, h: bh };
  const lum = regionMean(analysis, analysis.lumSum, { x: bx / W, y: by / H, w: bw / W, h: bh / H });

  return {
    fontSize,
    color: lum > 0.62 ? INK : GOFUN,
    glyphs,
    writeEnd,
    seal: { x: sealX, y: sealY, size: sealSize, start: sealStart },
    duration: sealStart + SEAL_DUR + HOLD,
    block,
  };
}

// ---------- 描画 ----------

function coverRect(sw: number, sh: number, dw: number, dh: number) {
  const s = Math.max(dw / sw, dh / sh);
  const w = dw / s;
  const h = dh / s;
  return { sx: (sw - w) / 2, sy: (sh - h) / 2, sw: w, sh: h };
}

const SMALL_KANA = new Set("ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ");
const ROTATE = new Set("ー〜～…‥―-");
const PUNCT = new Set("、。，．");

export class HaikuRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private grainPattern: CanvasPattern;
  private scratch = makeCanvas(256, 256);
  private photoLayer = makeCanvas(2, 2);
  private gradedCache: HTMLCanvasElement | null = null;
  private mask: HTMLCanvasElement | null = null;
  private seal: HTMLCanvasElement | null = null;
  private input: RenderInput | null = null;
  private layout: Layout | null = null;
  private maxSide: number;
  private raf = 0;
  private playStart = 0;
  private onEnd: (() => void) | null = null;
  /** 文字を書き始めたときと、落款を押したときに呼ぶ。音や揺れの演出に使う */
  onCue: ((cue: Cue) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, maxSide = PREVIEW_MAX) {
    this.canvas = canvas;
    this.maxSide = maxSide;
    this.ctx = canvas.getContext("2d")!;
    this.grainPattern = this.ctx.createPattern(getGrain(), "repeat")!;
  }

  get duration() {
    return this.layout?.duration ?? 0;
  }

  get width() {
    return this.canvas.width;
  }

  get height() {
    return this.canvas.height;
  }

  /** 枠の太さ（縦横それぞれの長さに対する割合）。枠がないときは 0 */
  get frameInset(): number {
    return this.input?.frame ? FRAME_INSET : 0;
  }

  /** 句と落款の範囲を 0〜1 の割合で返す（ドラッグ移動用） */
  get blockRect(): Rect | null {
    const b = this.layout?.block;
    if (!b) return null;
    return { x: b.x / this.width, y: b.y / this.height, w: b.w / this.width, h: b.h / this.height };
  }

  async setInput(input: RenderInput) {
    const text = input.lines.join("") + input.sealName;
    await Promise.all([
      document.fonts.load(`80px "Yuji Syuku"`, text),
      document.fonts.load(`${FONT_WEIGHT[input.font] ?? 400} 80px ${FONT_FAMILY[input.font].split(",")[0]}`, text),
      document.fonts.load(`700 80px "Shippori Mincho"`, input.sealName || "一句"),
    ]).catch(() => {});
    const prev = this.input;
    if (prev?.source !== input.source) {
      const { w, h } = fitSize(input.source.width, input.source.height, this.maxSide);
      this.canvas.width = w;
      this.canvas.height = h;
      this.photoLayer.width = w;
      this.photoLayer.height = h;
      this.gradedCache = null;
    }
    if (
      prev?.tone !== input.tone ||
      prev?.gafu !== input.gafu ||
      prev?.blur !== input.blur ||
      prev?.smudge !== input.smudge ||
      prev?.grain !== input.grain ||
      JSON.stringify(prev?.subject) !== JSON.stringify(input.subject)
    ) {
      this.gradedCache = null;
      this.mask = null;
    }
    this.input = input;
    this.layout = computeLayout(input, this.width, this.height);
    this.seal = makeSeal(input.sealName, this.layout.seal.size);
  }

  play(onEnd?: () => void) {
    this.stop();
    this.onEnd = onEnd ?? null;
    const src = this.input?.source;
    if (src?.kind === "video") {
      src.el.currentTime = 0;
      src.el.play().catch(() => {});
    }
    this.playStart = performance.now();
    let prev = -1;
    const tick = (now: number) => {
      const t = (now - this.playStart) / 1000;
      this.emitCues(prev, t);
      prev = t;
      this.drawAt(t);
      if (t < this.duration) {
        this.raf = requestAnimationFrame(tick);
      } else {
        this.raf = 0;
        this.keepVideoAlive();
        this.onEnd?.();
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private emitCues(from: number, to: number) {
    const layout = this.layout;
    if (!layout || !this.onCue) return;
    for (const g of layout.glyphs) {
      if (g.start > from && g.start <= to) this.onCue({ type: "stroke", duration: CHAR_DUR });
    }
    if (layout.seal.start > from && layout.seal.start <= to) this.onCue({ type: "lift", duration: SEAL_DUR });
    const hit = layout.seal.start + SEAL_DUR;
    if (hit > from && hit <= to) this.onCue({ type: "seal" });
  }

  /** 動画素材や演出があるときは、書き終えた後も背景と演出を動かし続ける */
  private keepVideoAlive() {
    const input = this.input;
    if (!input || (input.source.kind !== "video" && input.effect === "none")) return;
    const loop = (now: number) => {
      this.drawAt(Math.max(this.duration, (now - this.playStart) / 1000));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  showFinal() {
    this.stop();
    this.playStart = performance.now() - this.duration * 1000;
    this.drawAt(this.duration);
    this.keepVideoAlive();
  }

  drawAt(t: number) {
    const input = this.input;
    const layout = this.layout;
    if (!input || !layout) return;
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    const s = layout.seal;
    const scx = s.x + s.size / 2;
    const scy = s.y + s.size / 2;
    const drop = clamp01((t - s.start) / SEAL_DUR);
    const ti = t - (s.start + SEAL_DUR);
    const shake = impactShake(ti, Math.min(W, H));
    if (shake) {
      ctx.translate(W / 2, H / 2);
      ctx.scale(shake.zoom, shake.zoom);
      ctx.translate(-W / 2 + shake.dx, -H / 2 + shake.dy);
    }
    // 枠があるときは、写真から落款までを一回り小さく描き、まわりに枠を付ける。縦横比は変えない
    if (input.frame) {
      drawFramePaper(ctx, W, H);
      ctx.save();
      const ix = W * FRAME_INSET;
      const iy = H * FRAME_INSET;
      ctx.beginPath();
      ctx.rect(ix, iy, W - ix * 2, H - iy * 2);
      ctx.clip();
      ctx.translate(ix, iy);
      ctx.scale(1 - FRAME_INSET * 2, 1 - FRAME_INSET * 2);
    }
    this.drawPhoto(input);
    drawEffect(ctx, input.effect, t, W, H, "back", input.subject, this.blockRect, easeOut(clamp01(t / INTRO)));

    {
      // 文字のまわりだけ、ごく薄く明暗を整えて読みやすくする
      const fade = easeOut(clamp01(t / INTRO));
      const b = layout.block;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const rad = Math.hypot(b.w, b.h) * 0.62;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const scrim = layout.color === GOFUN ? "10,8,6" : "250,245,235";
      g.addColorStop(0, `rgba(${scrim},${0.28 * fade})`);
      g.addColorStop(0.6, `rgba(${scrim},${0.16 * fade})`);
      g.addColorStop(1, `rgba(${scrim},0)`);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(b.w / Math.hypot(b.w, b.h) + 0.35, b.h / Math.hypot(b.w, b.h) + 0.35);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = g;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      ctx.restore();
    }

    for (const gl of layout.glyphs) {
      const p = clamp01((t - gl.start) / CHAR_DUR);
      if (p > 0) this.drawGlyph(gl, p, layout);
    }

    this.drawBrushAt(t, layout);

    drawAnticipation(ctx, W, H, scx, scy, drop, ti);
    // 印が小さくても見劣りしないよう、演出の大きさは画像の短辺も基準にする
    const fx = Math.max(s.size, Math.min(W, H) * 0.1);
    drawImpactBack(ctx, ti, scx, scy, fx, W, H);
    if (drop > 0 && this.seal) {
      const pad = (this.seal.width - s.size) / 2;
      // 降りる間は大きく浮かせ、当たった後は少し弾ませる
      const fall = drop * drop * drop;
      const bounce = ti >= 0 ? 1 - 0.1 * Math.sin(ti * 32) * Math.exp(-ti * 9) : 1;
      const scale = (1 + (1 - fall) * 2.6) * bounce;
      const lift = 1 - fall;
      if (ti < 0) {
        // 浮いている印の影。近づくほど濃く小さくなる
        ctx.save();
        ctx.fillStyle = `rgba(10,6,4,${0.12 + fall * 0.3})`;
        ctx.filter = `blur(${Math.max(1, s.size * 0.25 * lift)}px)`;
        const sh = s.size * (1 + lift * 0.8);
        ctx.fillRect(scx - sh / 2 + s.size * 0.3 * lift, scy - sh / 2 + s.size * 0.5 * lift, sh, sh);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, drop * 2.5) * 0.95;
      ctx.translate(scx, scy - s.size * 0.6 * lift);
      ctx.rotate(-0.025 - lift * 0.35);
      ctx.scale(scale, scale);
      const glow = sealGlow(ti);
      if (glow > 0.01) {
        ctx.shadowColor = `rgba(255,90,60,${0.9 * glow})`;
        ctx.shadowBlur = s.size * 0.6 * glow;
      }
      ctx.drawImage(this.seal, -s.size / 2 - pad, -s.size / 2 - pad);
      ctx.restore();
    }
    drawImpactFront(ctx, ti, scx, scy, fx, W, H);
    drawEffect(ctx, input.effect, t, W, H, "front", input.subject, this.blockRect, easeOut(clamp01(t / INTRO)));
    if (input.frame) {
      ctx.restore();
      drawFrameBorder(ctx, W, H);
    }
    ctx.restore();
  }

  private drawPhoto(input: RenderInput) {
    const src = input.source;
    const W = this.width;
    const H = this.height;
    if (src.kind === "image") {
      if (!this.gradedCache) {
        this.gradedCache = makeCanvas(W, H);
        this.renderGraded(this.gradedCache, src.el, src.width, src.height, input.tone, 0);
        this.finish(this.gradedCache, input, 900, 5);
      }
      this.ctx.drawImage(this.gradedCache, 0, 0);
    } else {
      this.renderGraded(this.photoLayer, src.el, src.width, src.height, input.tone, performance.now());
      this.finish(this.photoLayer, input, 420, performance.now() / 60);
      this.ctx.drawImage(this.photoLayer, 0, 0);
    }
  }

  /**
   * 主役を避けたずらし・ぼかしのあとに画風をかける。
   * 浮世絵は色を減らすので最後にかけ、ぼかした部分も平らな面としてまとまるようにする。
   */
  private finish(target: HTMLCanvasElement, input: RenderInput, ukiyoeSide: number, grainSeed: number) {
    if (!this.mask || this.mask.width !== target.width || this.mask.height !== target.height) {
      this.mask = protectMask(target.width, target.height, input.subject);
    }
    if (input.smudge) applySmudge(target, this.mask, input.subject);
    if (input.blur) applyBlur(target, this.mask);
    if (input.gafu === "ukiyoe") applyUkiyoe(target, ukiyoeSide);
    if (input.gafu === "oldphoto") applyOldPhoto(target, 11, this.mask);
    if (input.grain) applyGrain(target, this.grainPattern, grainSeed);
  }

  /** 季節ごとの渋い色調。合成モードだけで作るので動画でも毎フレーム回せる */
  private renderGraded(target: HTMLCanvasElement, el: CanvasImageSource, sw: number, sh: number, toneName: Tone, seed: number) {
    const ctx = target.getContext("2d")!;
    const w = target.width;
    const h = target.height;
    const c = coverRect(sw, sh, w, h);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(el, c.sx, c.sy, c.sw, c.sh, 0, 0, w, h);
    const tone = TONES[toneName];
    if (!tone) {
      ctx.restore();
      return;
    }

    ctx.globalCompositeOperation = "saturation";
    ctx.globalAlpha = tone.desat;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = tone.tintAlpha * 1.6;
    ctx.fillStyle = tone.tint;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = tone.tintAlpha;
    ctx.fillStyle = tone.tint;
    ctx.fillRect(0, 0, w, h);

    // 黒を少し浮かせてフィルムの褪色感を出す
    ctx.globalCompositeOperation = "lighten";
    ctx.globalAlpha = tone.fade;
    ctx.fillStyle = "#1e1912";
    ctx.fillRect(0, 0, w, h);


    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(0,0,0,${tone.vignette})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawGlyph(g: Glyph, p: number, layout: Layout) {
    const fs = layout.fontSize;
    const S = Math.ceil(fs * 1.6);
    const sc = this.scratch;
    if (sc.width < S) {
      sc.width = S;
      sc.height = S;
    }
    const s = sc.getContext("2d")!;
    s.save();
    s.clearRect(0, 0, sc.width, sc.height);
    const style = this.input?.font ?? "syuku";
    s.font = `${FONT_WEIGHT[style] ?? 400} ${fs}px ${FONT_FAMILY[style]}`;
    s.fillStyle = layout.color;
    s.textAlign = "center";
    s.textBaseline = "middle";
    s.translate(S / 2, S / 2);
    if (ROTATE.has(g.ch)) {
      s.rotate(Math.PI / 2);
    } else if (SMALL_KANA.has(g.ch)) {
      s.translate(fs * 0.12, -fs * 0.1);
    } else if (PUNCT.has(g.ch)) {
      s.translate(fs * 0.55, -fs * 0.55);
    }
    if (style === "kin") {
      // 金文字: 墨の縁取りの上に、金のグラデーション
      s.lineJoin = "round";
      s.strokeStyle = "#1d1813";
      s.lineWidth = fs * 0.14;
      s.strokeText(g.ch, 0, 0);
      const gold = s.createLinearGradient(0, -fs / 2, 0, fs / 2);
      gold.addColorStop(0, "#fff3c0");
      gold.addColorStop(0.45, "#e2b04a");
      gold.addColorStop(0.55, "#b9822a");
      gold.addColorStop(1, "#f3d27a");
      s.fillStyle = gold;
      s.fillText(g.ch, 0, 0);
    } else if (style === "boku") {
      // 極太の墨: 線を太らせ、墨のはねを散らす
      s.lineJoin = "round";
      s.strokeStyle = layout.color;
      s.lineWidth = fs * 0.07;
      s.strokeText(g.ch, 0, 0);
      s.fillText(g.ch, 0, 0);
      const r = rand(Math.round(g.start * 1000));
      for (let i = 0; i < 5; i++) {
        const a = r() * Math.PI * 2;
        const d = fs * (0.42 + r() * 0.22);
        s.beginPath();
        s.arc(Math.cos(a) * d, Math.sin(a) * d, fs * (0.012 + r() * 0.03), 0, Math.PI * 2);
        s.fill();
      }
    } else {
      s.fillText(g.ch, 0, 0);
    }
    s.restore();

    if (p < 1) {
      // 左上から右下へ、筆が進む向きに少しずつ見せる
      const feather = 0.18;
      const front = p * (1 + feather);
      const grad = s.createLinearGradient(0, 0, S * 0.35, S);
      const a = Math.max(0, Math.min(1, front - feather));
      const b = Math.max(a, Math.min(1, front));
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(a, "rgba(0,0,0,1)");
      grad.addColorStop(b, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      s.save();
      s.globalCompositeOperation = "destination-in";
      s.fillStyle = grad;
      s.fillRect(0, 0, S, S);
      s.restore();
    }

    const ctx = this.ctx;
    ctx.save();
    if (this.input?.font === "kin") {
      ctx.shadowColor = "rgba(255,200,90,0.55)";
      ctx.shadowBlur = fs * 0.22;
    } else if (layout.color === GOFUN) {
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = fs * 0.18;
    } else {
      ctx.shadowColor = "rgba(255,250,240,0.7)";
      ctx.shadowBlur = fs * 0.14;
    }
    ctx.drawImage(sc, 0, 0, S, S, g.x - S / 2, g.y - S / 2, S, S);
    ctx.restore();
  }

  /** 筆先の位置。書いている最中は字形に沿って左右に揺らし、字と字の間は次の字へ移る */
  private brushTip(t: number, layout: Layout): { x: number; y: number; lift: number } | null {
    const gs = layout.glyphs;
    const fs = layout.fontSize;
    if (t < gs[0].start - 0.35 || t > layout.writeEnd + 0.6) return null;
    const startOf = (g: Glyph) => ({ x: g.x - fs * 0.3, y: g.y - fs * 0.45 });
    const endOf = (g: Glyph) => ({ x: g.x + fs * 0.25, y: g.y + fs * 0.45 });

    if (t < gs[0].start) {
      const k = easeOut(clamp01((t - (gs[0].start - 0.35)) / 0.35));
      const s = startOf(gs[0]);
      return { x: s.x + (1 - k) * fs * 3.5, y: s.y - (1 - k) * fs * 3, lift: 1 - k };
    }
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      const p = (t - g.start) / CHAR_DUR;
      if (p >= 0 && p <= 1) {
        const x = g.x + Math.sin(p * Math.PI * 4.5) * fs * 0.3 + (p - 0.5) * fs * 0.15;
        const y = g.y - fs * 0.45 + p * fs * 0.9;
        return { x, y, lift: 0 };
      }
      const next = gs[i + 1];
      if (next && t > g.start + CHAR_DUR && t < next.start) {
        const k = (t - g.start - CHAR_DUR) / (next.start - g.start - CHAR_DUR);
        const a = endOf(g);
        const b = startOf(next);
        const e = 0.5 - Math.cos(k * Math.PI) / 2;
        return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - Math.sin(k * Math.PI) * fs * 0.4, lift: Math.sin(k * Math.PI) };
      }
    }
    const lastG = gs[gs.length - 1];
    const k = easeOut(clamp01((t - (lastG.start + CHAR_DUR)) / 0.6));
    const e = endOf(lastG);
    return { x: e.x + k * fs * 6, y: e.y - k * fs * 7.5, lift: k };
  }

  private drawBrushAt(t: number, layout: Layout) {
    const tip = this.brushTip(t, layout);
    if (!tip) return;
    drawBrush(this.ctx, tip.x, tip.y, layout.fontSize / 70, tip.lift);
  }

  /** いま表示している仕上がりを、ギャラリー用の JPEG にする */
  snapshot(): Promise<Blob | null> {
    return new Promise((resolve) => this.canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9));
  }

  /** 画像は元の大きさで描き直して書き出す */
  async exportPng(): Promise<Blob> {
    if (!this.input) throw new Error("まだ句がありません。");
    const full = new HaikuRenderer(makeCanvas(2, 2), EXPORT_MAX);
    const placement = this.input.placement ?? (this.blockRect ? { x: this.blockRect.x, y: this.blockRect.y } : null);
    await full.setInput({ ...this.input, placement });
    full.drawAt(full.duration);
    const type = this.input.source.kind === "image" && this.input.source.mimeType === "image/png" ? "image/png" : "image/jpeg";
    return new Promise<Blob>((resolve, reject) =>
      full.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("画像を書き出せませんでした。"))), type, 0.95),
    );
  }

  /** アニメーションを最初から流して録画する */
  recordVideo(onProgress?: (p: number) => void): Promise<{ blob: Blob; ext: string }> {
    const mime = pickVideoMime();
    if (!mime || typeof this.canvas.captureStream !== "function") {
      return Promise.reject(new Error("このブラウザは動画の書き出しに対応していません。"));
    }
    return new Promise((resolve, reject) => {
      const stream = this.canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onerror = () => reject(new Error("録画に失敗しました。"));
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        resolve({ blob: new Blob(chunks, { type: mime.split(";")[0] }), ext: mime.includes("mp4") ? "mp4" : "webm" });
      };
      rec.start(250);
      const started = performance.now();
      const timer = setInterval(() => onProgress?.(clamp01((performance.now() - started) / 1000 / this.duration)), 200);
      // 録画中は音を鳴らさない
      const cue = this.onCue;
      this.onCue = null;
      this.play(() => {
        this.onCue = cue;
        clearInterval(timer);
        onProgress?.(1);
        setTimeout(() => rec.stop(), 300);
      });
    });
  }
}

function pickVideoMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/** 竹軸の筆。筆先 (0,0) から右上へ伸びる */
function drawBrush(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, lift: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.5);
  const s = scale * (1 + lift * 0.05);
  ctx.scale(s, s);

  // 影
  ctx.save();
  ctx.translate(16 + lift * 18, 10 + lift * 14);
  ctx.fillStyle = "rgba(20,14,8,0.22)";
  ctx.filter = "blur(6px)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(14, -40, 13, -95);
  ctx.lineTo(13, -560);
  ctx.lineTo(-13, -560);
  ctx.lineTo(-13, -95);
  ctx.quadraticCurveTo(-14, -40, 0, 0);
  ctx.fill();
  ctx.restore();

  // 軸（竹）
  const shaft = ctx.createLinearGradient(-12, 0, 12, 0);
  shaft.addColorStop(0, "#7d5f35");
  shaft.addColorStop(0.35, "#d9b878");
  shaft.addColorStop(0.6, "#c39c5c");
  shaft.addColorStop(1, "#6e5230");
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.roundRect(-11, -560, 22, 440, [8, 8, 2, 2]);
  ctx.fill();
  ctx.strokeStyle = "rgba(70,48,22,0.75)";
  ctx.lineWidth = 2.5;
  for (const ny of [-250, -420]) {
    ctx.beginPath();
    ctx.moveTo(-11, ny);
    ctx.lineTo(11, ny);
    ctx.stroke();
  }
  ctx.fillStyle = "#2a201a";
  ctx.beginPath();
  ctx.roundRect(-11, -575, 22, 22, 6);
  ctx.fill();

  // 口金
  const ferrule = ctx.createLinearGradient(-13, 0, 13, 0);
  ferrule.addColorStop(0, "#1a1a1a");
  ferrule.addColorStop(0.4, "#5a5550");
  ferrule.addColorStop(1, "#141414");
  ctx.fillStyle = ferrule;
  ctx.fillRect(-13, -128, 26, 34);

  // 穂。根元は白い毛、先は墨を含んで黒い
  const hair = ctx.createLinearGradient(0, -96, 0, 0);
  hair.addColorStop(0, "#e2d6bd");
  hair.addColorStop(0.3, "#bfb29a");
  hair.addColorStop(0.55, "#2a231c");
  hair.addColorStop(1, "#0d0a08");
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(-13, -96);
  ctx.bezierCurveTo(-15, -60, -8, -25, 0, 0);
  ctx.bezierCurveTo(8, -25, 15, -60, 13, -96);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  for (const dx of [-6, -1, 5]) {
    ctx.beginPath();
    ctx.moveTo(dx, -92);
    ctx.quadraticCurveTo(dx * 0.6, -50, dx * 0.1, -12);
    ctx.stroke();
  }
  ctx.restore();
}
