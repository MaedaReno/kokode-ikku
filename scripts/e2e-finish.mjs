// 画風・加工・文字・演出の見た目と、主役を避けているかを確かめる
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] ?? "e2e-out";
const base = process.env.BASE_URL ?? "http://localhost:8787";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);
await page.evaluate(async () => {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#5d86b0");
  sky.addColorStop(0.6, "#e7c38f");
  sky.addColorStop(1, "#7a6a4a");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // 背景の木々と建物
  let s = 3;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `hsl(${90 + r() * 60},35%,${25 + r() * 25}%)`;
    g.beginPath();
    g.arc(r() * W, 500 + r() * 300, 20 + r() * 50, 0, Math.PI * 2);
    g.fill();
  }
  // 人物（主役）: 左下
  g.fillStyle = "#c0392b";
  g.fillRect(0.2 * W, 0.68 * H, 0.16 * W, 0.26 * H);
  g.fillStyle = "#f1c9a5";
  g.beginPath();
  g.arc(0.28 * W, 0.6 * H, 0.07 * W, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#222";
  g.beginPath();
  g.arc(0.255 * W, 0.59 * H, 8, 0, Math.PI * 2);
  g.arc(0.305 * W, 0.59 * H, 8, 0, Math.PI * 2);
  g.fill();
  const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
  const dt = new DataTransfer();
  dt.items.add(new File([blob], "p.jpg", { type: "image/jpeg" }));
  const input = document.querySelector('input[type="file"]');
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForSelector(".compose");
const box = await page.locator(".emotion").boundingBox();
await page.mouse.click(box.x + box.width * 0.15, box.y + box.height / 2);
await page.getByRole("button", { name: /季節・ひとことを添える/ }).click();
await page.getByRole("button", { name: "春" }).click();
await page.getByRole("button", { name: "これで戻る" }).click();
await page.getByRole("button", { name: "一句詠む" }).click();
await page.waitForSelector(".result", { timeout: 60000 });
await page.waitForTimeout(11000);

const save = async (name) => {
  const data = await page.evaluate(() => document.querySelector(".stage canvas").toDataURL("image/jpeg", 0.85));
  fs.writeFileSync(path.join(out, `${name}.jpg`), Buffer.from(data.split(",")[1], "base64"));
};
await save("01-default");
const pick = async (labels, name) => {
  await page.getByRole("button", { name: "仕上げ", exact: true }).click();
  for (const l of labels) await page.getByRole("button", { name: l, exact: true }).click();
  await page.getByRole("button", { name: "閉じる" }).click();
  await page.waitForTimeout(1500);
  await save(name);
};
await pick(["豪快な筆"], "02-potta");
await pick(["極太ゴシック"], "03-dela");
await pick(["古写真", "金文字"], "04-oldphoto-kin");
await pick(["そのまま", "太明朝", "ざらざら", "指でずらす"], "05-plain-tokumin-nofx");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
