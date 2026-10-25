import { flushSync } from "react-dom";

type Kind = "ink" | "morph";

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 画面の切り替えに、墨がにじんで広がる効果を付ける。
 * View Transitions に対応していないブラウザでは、そのまま切り替える。
 * "morph" は、作品の拡大と縮小のように、同じ要素の位置と大きさだけを滑らかに変える。
 */
export function transition(update: () => void, kind: Kind = "ink"): Promise<void> {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
  if (!doc.startViewTransition || reduced()) {
    update();
    return Promise.resolve();
  }
  const root = document.documentElement;
  root.dataset.vt = kind;
  const vt = doc.startViewTransition(() => flushSync(update));
  return vt.finished.catch(() => {}).finally(() => {
    if (root.dataset.vt === kind) delete root.dataset.vt;
  });
}

const RIPPLE_TARGET = ".btn, .chip, .actionbar button, .option, .row-link, .emotion-cell";

/** 押したところから墨がにじむように広がる */
export function installInkRipple() {
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(RIPPLE_TARGET);
      if (!el || (el as HTMLButtonElement).disabled || reduced()) return;
      const rect = el.getBoundingClientRect();
      const size = Math.hypot(rect.width, rect.height) * 2.2;
      const ink = document.createElement("span");
      ink.className = "ink-ripple";
      ink.style.width = ink.style.height = `${size}px`;
      ink.style.left = `${e.clientX - rect.left - size / 2}px`;
      ink.style.top = `${e.clientY - rect.top - size / 2}px`;
      ink.style.rotate = `${Math.round(Math.random() * 360)}deg`;
      el.appendChild(ink);
      ink.addEventListener("animationend", () => ink.remove(), { once: true });
    },
    { passive: true },
  );
}
