// 共通メニューと喜怒哀楽の流れを確かめる
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
const shot = (name, full = false) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: full });

await page.goto(base);
await page.waitForTimeout(1500);
await shot("01-home");

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
await page.waitForSelector(".compose");
console.log("submit disabled before choosing:", await page.locator(".bottom-bar button").isDisabled());
await shot("02-compose-empty");
{
  const box = await page.locator(".emotion").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.85);
  console.log("哀 checked:", await page.getByRole("radio", { name: /哀/ }).getAttribute("aria-checked"));
}
await shot("03-compose-chosen");
await page.getByRole("button", { name: /季節・ひとことを添える/ }).click();
await page.getByRole("button", { name: "秋" }).click();
await page.fill("textarea", "徹夜明けの帰り道。缶コーヒーがぬるい");
await shot("04-extra");
await page.getByRole("button", { name: "これで戻る" }).click();
console.log("extras summary:", await page.locator(".row-link .sub").textContent());
await page.getByRole("button", { name: "一句詠む" }).click();
await page.waitForSelector(".result", { timeout: 60000 });
await page.waitForTimeout(11000);
await shot("05-result", true);

for (const [name, label] of [
  ["06-gallery", "ギャラリー"],
  ["07-world", "世界の俳句"],
  ["08-zukan", "図鑑"],
  ["09-settings", "設定"],
]) {
  await page.getByRole("navigation", { name: "メニュー" }).getByRole("button", { name: label }).click();
  await page.waitForTimeout(700);
  await shot(name);
}
console.log("gallery items:", await page.evaluate(async () => {
  return await new Promise((res) => {
    const r = indexedDB.open("kokode-ikku");
    r.onsuccess = () => {
      const q = r.result.transaction("works").objectStore("works").count();
      q.onsuccess = () => res(q.result);
    };
  });
}));
await page.getByRole("navigation", { name: "メニュー" }).getByRole("button", { name: "ホーム" }).click();
await page.waitForTimeout(500);
console.log("back home keeps result:", await page.locator(".result").count());
console.log("errors:", errors.length ? errors : "none");
await browser.close();
