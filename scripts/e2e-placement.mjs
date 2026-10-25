// 縦長と横長の画像で、句の置き場所と保存サイズを確かめる
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] ?? "e2e-out";
const base = process.env.BASE_URL ?? "http://localhost:8787";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

async function feedImage(w, h, kind) {
  await page.evaluate(
    async ({ w, h, kind }) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#8fb3cf");
      sky.addColorStop(1, "#e8d2a8");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      // にぎやかな部分: 左下に建物と看板をたくさん
      let s = 7;
      const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const busyW = kind === "portrait" ? w : w * 0.55;
      const busyTop = kind === "portrait" ? h * 0.5 : h * 0.25;
      for (let i = 0; i < 400; i++) {
        g.fillStyle = `hsl(${r() * 360},40%,${20 + r() * 50}%)`;
        g.fillRect(r() * busyW, busyTop + r() * (h - busyTop), 10 + r() * 60, 10 + r() * 60);
      }
      // 主役の人影
      g.fillStyle = "#222";
      g.beginPath();
      g.arc(busyW * 0.5, busyTop + (h - busyTop) * 0.3, Math.min(w, h) * 0.06, 0, Math.PI * 2);
      g.fill();
      const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], `${kind}.jpg`, { type: "image/jpeg" }));
      const input = document.querySelector('input[type="file"]');
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { w, h, kind },
  );
}

const sizeOf = (buf) => {
  // JPEG の SOF マーカーから幅と高さを読む
  for (let i = 2; i < buf.length; ) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  return null;
};

for (const [kind, w, h] of [
  ["portrait", 1080, 1440],
  ["landscape", 1920, 1080],
]) {
  await page.goto(base);
  await page.waitForTimeout(800);
  await feedImage(w, h, kind);
  await page.waitForSelector(".compose");
  {
    const box = await page.locator(".emotion").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.85);
  }
  await page.getByRole("button", { name: "一句詠む" }).click();
  await page.waitForSelector(".result", { timeout: 120000 });
  await page.waitForTimeout(11500);
  await page.screenshot({ path: path.join(out, `${kind}-screen.png`), fullPage: true });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.getByRole("button", { name: "保存", exact: true }).click().then(() => page.getByRole("button", { name: /画像/ }).click()),
  ]);
  const file = path.join(out, `${kind}-export.jpg`);
  await download.saveAs(file);
  console.log(kind, "source", `${w}x${h}`, "export", sizeOf(fs.readFileSync(file)));

  // 句をドラッグして左上へ動かす
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const box = await page.locator(".stage canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.15, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, `${kind}-dragged.png`) });
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
