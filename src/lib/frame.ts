/**
 * 作品全体を囲む、色紙のような枠。
 * 写真は縦横それぞれ FRAME_INSET の割合だけ内側に縮めて描くので、縦横比は変わらず、端も切れない。
 */

export const FRAME_INSET = 0.011;

const cache = new Map<string, HTMLCanvasElement>();

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 枠の地紙。生成りの和紙に、楮の繊維と金砂子を散らす。大きさごとに一度だけ作る */
function paper(W: number, H: number): HTMLCanvasElement {
  const key = `${W}x${H}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const r = rand(W * 31 + H);
  const unit = Math.min(W, H);

  const base = g.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, "#f7efdc");
  base.addColorStop(0.5, "#f1e5ca");
  base.addColorStop(1, "#e9d8b6");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // 枠の部分だけに描けば足りるので、写真で隠れる内側は飛ばす
  const ix = W * FRAME_INSET;
  const iy = H * FRAME_INSET;
  const inFrame = (x: number, y: number) => x < ix || x > W - ix || y < iy || y > H - iy;
  const area = W * H - (W - ix * 2) * (H - iy * 2);

  g.lineCap = "round";
  for (let i = 0; i < area / 260; i++) {
    const x = r() * W;
    const y = r() * H;
    if (!inFrame(x, y)) continue;
    const len = unit * (0.006 + r() * 0.02);
    const a = r() * Math.PI;
    g.strokeStyle = r() < 0.5 ? "rgba(255,255,255,0.6)" : "rgba(140,110,70,0.16)";
    g.lineWidth = Math.max(0.6, unit * 0.0008);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.7) * len * 0.5, y + Math.sin(a + 0.7) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }

  // 金砂子。四隅に多く、辺の中ほどは控えめにする
  for (let i = 0; i < area / 420; i++) {
    const x = r() * W;
    const y = r() * H;
    if (!inFrame(x, y)) continue;
    const corner = Math.min(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)) / unit;
    if (r() < corner * 1.6) continue;
    const s = unit * (0.0015 + r() * r() * 0.007);
    g.fillStyle = r() < 0.5 ? "rgba(208,163,66,0.9)" : "rgba(238,203,118,0.85)";
    g.save();
    g.translate(x, y);
    g.rotate(r() * Math.PI);
    g.fillRect(-s / 2, -s / 2, s, s * (0.5 + r() * 0.8));
    g.restore();
  }

  if (cache.size > 4) cache.clear();
  cache.set(key, c);
  return c;
}

export function drawFramePaper(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.drawImage(paper(W, H), 0, 0);
}

/** 写真を描き終えた後に、縁取りと写真のまわりの線を重ねる */
export function drawFrameBorder(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const unit = Math.min(W, H);
  const ix = W * FRAME_INSET;
  const iy = H * FRAME_INSET;
  const iw = W - ix * 2;
  const ih = H - iy * 2;
  ctx.save();

  // 写真が一段くぼんで見えるよう、内側の縁に影を落とす
  const sh = unit * 0.006;
  const edges: [number, number, number, number, number, number, number, number][] = [
    [ix, iy, iw, sh, ix, iy, ix, iy + sh],
    [ix, iy + ih - sh, iw, sh, ix, iy + ih, ix, iy + ih - sh],
    [ix, iy, sh, ih, ix, iy, ix + sh, iy],
    [ix + iw - sh, iy, sh, ih, ix + iw, iy, ix + iw - sh, iy],
  ];
  for (const [x, y, w, h, x0, y0, x1, y1] of edges) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(20,12,4,0.45)");
    g.addColorStop(1, "rgba(20,12,4,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  // 写真のまわり。金の細線と、その外に朱の細線
  ctx.strokeStyle = "rgba(196,150,58,0.95)";
  ctx.lineWidth = Math.max(1, unit * 0.0018);
  ctx.strokeRect(ix, iy, iw, ih);
  const gap = unit * 0.0035;
  ctx.strokeStyle = "rgba(170,45,36,0.75)";
  ctx.lineWidth = Math.max(1, unit * 0.0009);
  ctx.strokeRect(ix - gap, iy - gap, iw + gap * 2, ih + gap * 2);

  // 外周の金の縁。光が当たったように明暗をつける
  const band = unit * 0.004;
  const gold = ctx.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, "#f3d98f");
  gold.addColorStop(0.3, "#b98a2e");
  gold.addColorStop(0.55, "#f0d27e");
  gold.addColorStop(0.8, "#a8781f");
  gold.addColorStop(1, "#e6c56e");
  ctx.strokeStyle = gold;
  ctx.lineWidth = band;
  ctx.strokeRect(band / 2, band / 2, W - band, H - band);
  ctx.strokeStyle = "rgba(90,60,20,0.5)";
  ctx.lineWidth = Math.max(0.5, unit * 0.0006);
  ctx.strokeRect(band, band, W - band * 2, H - band * 2);

  ctx.restore();
}
