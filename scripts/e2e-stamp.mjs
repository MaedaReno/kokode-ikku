// 落款を押す瞬間を連続で撮って確かめる
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] ?? "e2e-out";
const base = process.env.BASE_URL ?? "http://localhost:8788";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => sessionStorage.setItem("splashSeen", "1"));
await page.goto(base);
await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 1000);
  sky.addColorStop(0, "#2b3a67");
  sky.addColorStop(1, "#f6c27a");
  g.fillStyle = sky;
  g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = "#1c1612";
  for (let i = 0; i < 7; i++) g.fillRect(i * 160, 650 - ((i * 97) % 300), 120, 900);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  const dt = new DataTransfer();
  dt.items.add(new File([blob], "t.jpg", { type: "image/jpeg" }));
  const input = document.querySelector('input[type="file"]');
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForSelector(".compose");
await page.waitForTimeout(900);
const box = await page.locator(".emotion").boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.15);
await page.getByRole("button", { name: "一句詠む" }).click();
await page.waitForSelector(".result canvas");
// 書いている間のコマを、キャンバスから直接集める
const frames = await page.evaluate(async () => {
  const c = document.querySelector(".result canvas");
  const shots = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 10500) {
    await new Promise((r) => requestAnimationFrame(r));
    const t = (performance.now() - t0) / 1000;
    if (t > 6 && t < 10.5) shots.push({ t, url: c.toDataURL("image/jpeg", 0.7) });
    await new Promise((r) => setTimeout(r, 15));
  }
  return shots;
});
frames.forEach((f, i) => fs.writeFileSync(path.join(out, `f${String(i).padStart(3, "0")}.jpg`), Buffer.from(f.url.split(",")[1], "base64")));
console.log("frames:", frames.length, "errors:", errors);
await browser.close();
