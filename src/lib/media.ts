export type ApiImage = { mediaType: "image/jpeg"; data: string };

export type Source =
  | {
      kind: "image";
      el: HTMLImageElement;
      mimeType: string;
      width: number;
      height: number;
      frames: ApiImage[];
      thumbUrl: string;
    }
  | {
      kind: "video";
      el: HTMLVideoElement;
      width: number;
      height: number;
      frames: ApiImage[];
      thumbUrl: string;
    };

const API_MAX_SIDE = 1280;

function toApiImage(src: CanvasImageSource, w: number, h: number, maxSide = API_MAX_SIDE): { img: ApiImage; url: string } {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { img: { mediaType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) }, url };
}

async function loadImage(file: File): Promise<Source> {
  const el = new Image();
  el.src = URL.createObjectURL(file);
  await el.decode();
  const { img, url } = toApiImage(el, el.naturalWidth, el.naturalHeight);
  return {
    kind: "image",
    el,
    mimeType: file.type,
    width: el.naturalWidth,
    height: el.naturalHeight,
    frames: [img],
    thumbUrl: url,
  };
}

function once(target: EventTarget, type: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const ng = () => {
      cleanup();
      reject(new Error("動画を読み込めませんでした。"));
    };
    const cleanup = () => {
      target.removeEventListener(type, ok);
      target.removeEventListener("error", ng);
    };
    target.addEventListener(type, ok);
    target.addEventListener("error", ng);
  });
}

async function loadVideo(file: File): Promise<Source> {
  const el = document.createElement("video");
  el.muted = true;
  el.playsInline = true;
  el.loop = true;
  el.preload = "auto";
  el.src = URL.createObjectURL(file);
  await once(el, "loadeddata");
  // iOS Safari は一度再生しないとシークできないことがある
  await el.play().catch(() => {});
  el.pause();

  const w = el.videoWidth;
  const h = el.videoHeight;
  const frames: ApiImage[] = [];
  let thumbUrl = "";
  const duration = Number.isFinite(el.duration) ? el.duration : 1;
  for (const r of [0.15, 0.4, 0.65, 0.9]) {
    el.currentTime = Math.min(duration - 0.05, duration * r);
    await once(el, "seeked");
    const { img, url } = toApiImage(el, w, h, 960);
    frames.push(img);
    if (!thumbUrl) thumbUrl = url;
  }
  el.currentTime = 0;
  return { kind: "video", el, width: w, height: h, frames, thumbUrl };
}

export async function loadMedia(file: File): Promise<Source> {
  if (file.type.startsWith("video/")) return loadVideo(file);
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|gif)$/i.test(file.name)) return loadImage(file);
  throw new Error("写真か動画を選んでください。");
}

export function disposeMedia(source: Source | null) {
  if (!source) return;
  if (source.kind === "video") source.el.pause();
  URL.revokeObjectURL(source.el.src);
}
