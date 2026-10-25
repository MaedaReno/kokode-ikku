// 手元の Chrome で一連の流れを動かし、スクリーンショットを保存する確認用スクリプト
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const shot = (name, opts = {}) => page.screenshot({ path: path.join(out, `${name}.png`), ...opts });

await page.goto(base);
await page.waitForTimeout(1800);
await shot("01-home");

// 夕暮れの街角を描いた画像を作って、ファイル選択に流し込む
await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 1200;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 800);
  sky.addColorStop(0, "#2b3a67");
  sky.addColorStop(0.55, "#e0875a");
  sky.addColorStop(1, "#f6c27a");
  g.fillStyle = sky;
  g.fillRect(0, 0, 1600, 1200);
  g.fillStyle = "#f8e3a0";
  g.beginPath();
  g.arc(1100, 640, 70, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1c1612";
  for (let i = 0; i < 9; i++) {
    const w = 120 + ((i * 53) % 90);
    const h = 220 + ((i * 97) % 260);
    g.fillRect(i * 180 - 20, 800 - h, w, h + 400);
  }
  g.fillRect(0, 780, 1600, 420);
  g.strokeStyle = "#1c1612";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, 300);
  g.quadraticCurveTo(800, 380, 1600, 260);
  g.stroke();
  g.fillStyle = "#b7452f";
  g.fillRect(700, 900, 90, 170);
  g.fillStyle = "#e9d9b8";
  g.fillRect(700, 960, 90, 40);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  const file = new File([blob], "test.jpg", { type: "image/jpeg" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.querySelector('input[type="file"]');
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForSelector(".compose");
{
  const box = await page.locator(".emotion").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.85);
}
await page.getByRole("button", { name: /季節・ひとことを添える/ }).click();
await page.getByRole("button", { name: "秋" }).click();
await page.fill("textarea", "徹夜明けのハッカソン会場の帰り道。缶コーヒーがぬるい");
await page.getByRole("button", { name: "これで戻る" }).click();
await shot("02-compose", { fullPage: true });

await page.getByRole("button", { name: "一句詠む" }).click();
await page.waitForTimeout(400);
await shot("03-generating");

await page.waitForSelector(".result", { timeout: 120000 });
await page.waitForTimeout(3500);
await shot("04-result-writing");
await page.waitForTimeout(9000);
await shot("05-result-done", { fullPage: true });

const saveCanvas = async (name) => {
  const data = await page.evaluate(() => document.querySelector("canvas").toDataURL("image/png"));
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data.split(",")[1], "base64"));
};
await saveCanvas("06-canvas-done");

await page.locator(".stage canvas").click();
await page.waitForTimeout(4200);
await saveCanvas("08-canvas-mid");

await page.getByRole("button", { name: "句を直す" }).click();
await page.getByLabel("上五", { exact: true }).fill("夏草や");
await page.getByLabel("中七", { exact: true }).fill("兵どもが");
await page.getByLabel("下五", { exact: true }).fill("夢の跡");
await page.waitForTimeout(800);
await page.getByLabel("中七の読み").fill("つわものどもが");
await page.waitForTimeout(800);
console.log("mora after reading fix:", await page.locator(".line-input .mora").allTextContents());
await shot("09-replace-sheet");
await page.getByRole("button", { name: "この句で書く" }).click();

await page.getByRole("button", { name: "詠み直す", exact: true }).click();
await page.getByRole("button", { name: "もっと寂しく" }).click();
await shot("10-regen-sheet");
await page.getByRole("button", { name: "この条件で詠み直す" }).click();
await page.waitForSelector(".result", { timeout: 120000 });
await page.waitForTimeout(12000);
await shot("11-after-regen", { fullPage: true });

if (process.env.VIDEO) {
  // 動画素材: ページ内で短い動画を作って読み込ませる
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 720;
    c.height = 960;
    const g = c.getContext("2d");
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    rec.start();
    const t0 = performance.now();
    await new Promise((resolve) => {
      const draw = () => {
        const t = (performance.now() - t0) / 1000;
        g.fillStyle = "#3d5a73";
        g.fillRect(0, 0, 720, 960);
        g.fillStyle = "#dfe8ee";
        for (let i = 0; i < 80; i++) {
          const x = (i * 97) % 720;
          const y = ((i * 53 + t * 120) % 960);
          g.fillRect(x, y, 3, 14);
        }
        g.fillStyle = "#1a1d22";
        g.fillRect(260, 520, 200, 440);
        if (t < 2.5) requestAnimationFrame(draw);
        else resolve();
      };
      draw();
    });
    rec.stop();
    await done;
    const file = new File(chunks, "rain.webm", { type: "video/webm" });
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.querySelector('input[type="file"]');
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForSelector(".compose", { timeout: 30000 });
  {
    const box = await page.locator(".emotion").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.85);
  }
  await page.getByRole("button", { name: "一句詠む" }).click();
  await page.waitForSelector(".result", { timeout: 120000 });
  await page.waitForTimeout(5000);
  await saveCanvas("12-canvas-video-source");

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.getByRole("button", { name: "保存", exact: true }).click().then(() => page.getByRole("button", { name: /筆で書く動画/ }).click()),
  ]);
  await download.saveAs(path.join(out, download.suggestedFilename()));
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
