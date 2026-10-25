// 分析の表示と、演出ごとの見た目を確かめる
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
await page.waitForTimeout(800);
await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 900);
  sky.addColorStop(0, "#1d2b4f");
  sky.addColorStop(1, "#d98f5c");
  g.fillStyle = sky;
  g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = "#1c1612";
  for (let i = 0; i < 6; i++) g.fillRect(i * 190, 760 - ((i * 97) % 260), 150, 800);
  g.fillStyle = "#f2d3b0";
  g.beginPath();
  g.arc(300, 980, 70, 0, Math.PI * 2);
  g.fill();
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  const dt = new DataTransfer();
  dt.items.add(new File([blob], "t.jpg", { type: "image/jpeg" }));
  const input = document.querySelector('input[type="file"]');
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForSelector(".compose");
const box = await page.locator(".emotion").boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.15);
await page.getByRole("button", { name: "一句詠む" }).click();
await page.waitForSelector(".reading-card", { timeout: 60000 });
await page.screenshot({ path: path.join(out, "01-reading.png") });
await page.waitForSelector(".result", { timeout: 60000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(out, "02-result-writing.png") });

const save = async (name) => {
  const data = await page.evaluate(() => document.querySelector(".stage canvas").toDataURL("image/jpeg", 0.85));
  fs.writeFileSync(path.join(out, `${name}.jpg`), Buffer.from(data.split(",")[1], "base64"));
};
for (const [label, name] of [
  ["桜吹雪", "sakura"],
  ["花火", "hanabi"],
  ["紅葉", "momiji"],
  ["雪", "yuki"],
  ["金箔", "kinpaku"],
]) {
  await page.getByRole("button", { name: "演出", exact: true }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("button", { name: "閉じる" }).click();
  await page.waitForTimeout(1500);
  await save(`03-${name}`);
}
await page.screenshot({ path: path.join(out, "04-result.png"), fullPage: true });
console.log("errors:", errors.length ? errors : "none");
await browser.close();
