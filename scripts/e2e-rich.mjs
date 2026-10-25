// 起動画面、AI が見ている様子、全画面の仕上がり、画面切り替えを撮って確かめる
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] ?? "e2e-out";
const base = process.env.BASE_URL ?? "http://localhost:8788";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });

// 分析を遅らせて、読み取り中の様子を撮れるようにする
await page.route("**/api/analyze", async (route) => {
  await new Promise((r) => setTimeout(r, 2500));
  route.continue();
});
await page.route("**/api/haiku", async (route) => {
  await new Promise((r) => setTimeout(r, 2500));
  route.continue();
});

await page.goto(base);
for (const [ms, name] of [[350, "s1"], [700, "s2"], [1500, "s3"], [2200, "s4"], [2800, "s5"]]) {
  await page.waitForTimeout(ms - (globalThis.__t ?? 0));
  globalThis.__t = ms;
  await shot(`00-splash-${name}`);
}
await page.waitForTimeout(1500);
await shot("01-home");
await page.waitForTimeout(3000);
await shot("01-home-later");

await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 1500;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 1000);
  sky.addColorStop(0, "#2b3a67");
  sky.addColorStop(1, "#f6c27a");
  g.fillStyle = sky;
  g.fillRect(0, 0, 1200, 1500);
  g.fillStyle = "#1c1612";
  for (let i = 0; i < 7; i++) g.fillRect(i * 180, 700 - ((i * 97) % 300), 140, 900);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  const dt = new DataTransfer();
  dt.items.add(new File([blob], "t.jpg", { type: "image/jpeg" }));
  const input = document.querySelector('input[type="file"]');
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(250);
await shot("02-transition");
await page.waitForSelector(".compose");
await page.waitForTimeout(600);
{
  const box = await page.locator(".emotion").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.15);
  await page.waitForTimeout(150);
  await shot("03-ripple");
}
await page.getByRole("button", { name: "一句詠む" }).click();
await page.waitForTimeout(1200);
await shot("04-scan");
await page.waitForTimeout(2300);
await shot("05-analysis");
await page.waitForTimeout(1200);
await shot("06-compose");
await page.waitForSelector(".result", { timeout: 60000 });
await page.waitForTimeout(2500);
await shot("07-immersive-writing");
await page.waitForFunction(() => !document.querySelector(".stage.immersive"), null, { timeout: 30000 });
await page.waitForTimeout(800);
await shot("08-result");
await page.locator(".stage-expand").click();
await page.waitForTimeout(800);
await shot("09-expanded");
await page.locator(".stage").click();
await page.waitForTimeout(800);
await page.getByRole("navigation", { name: "メニュー" }).getByRole("button", { name: "図鑑" }).click();
await page.waitForTimeout(250);
await shot("10-tab-transition");
await page.waitForTimeout(800);
await shot("11-zukan");
await page.getByRole("navigation", { name: "メニュー" }).getByRole("button", { name: "設定" }).click();
await page.waitForTimeout(900);
await shot("12-settings");
await page.getByRole("navigation", { name: "メニュー" }).getByRole("button", { name: "ホーム" }).click();
await page.waitForTimeout(400);
await page.getByRole("navigation", { name: "メニュー" }).getByRole("button", { name: "ホーム" }).click();
await page.waitForTimeout(1500);
await shot("13-home-with-work");

console.log("errors:", errors);
await browser.close();
