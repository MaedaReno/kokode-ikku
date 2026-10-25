import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { client, generateHaiku, isMock, type HaikuRequest } from "./haiku.js";
import { analyzeImage, type AnalyzeInput } from "./analyze.js";
import { critique, type CritiqueRequest } from "./critique.js";
import { analyzeHaiku, getTokenizer } from "./mora.js";
import { checkPasscode, passcodeRequired, rateLimit, requirePasscode } from "./guard.js";

const app = express();
app.set("trust proxy", "loopback");
app.use(express.json({ limit: "25mb" }));

app.get("/api/status", (_req, res) => {
  res.json({ mock: isMock, passcode: passcodeRequired });
});

app.post("/api/passcode", rateLimit(10, 60_000), checkPasscode);

app.post("/api/analyze", requirePasscode, rateLimit(20, 10 * 60_000), async (req, res) => {
  const body = req.body as AnalyzeInput;
  if (!Array.isArray(body.images) || body.images.length === 0 || body.images.length > 6) {
    res.status(400).json({ error: "画像を1〜6枚送ってください。" });
    return;
  }
  const started = Date.now();
  try {
    const analysis = await analyzeImage(client, body);
    console.log(`[analyze] ${analysis.mainSubject} style=${analysis.style} effect=${analysis.effect} ${Date.now() - started}ms`);
    res.json(analysis);
  } catch (err) {
    console.error("[analyze] failed", err);
    res.status(err instanceof Anthropic.RateLimitError ? 429 : 502).json({
      error: err instanceof Anthropic.APIError ? "画像の読み取りに失敗しました。" : err instanceof Error ? err.message : "画像の読み取りに失敗しました。",
    });
  }
});

app.post("/api/haiku", requirePasscode, rateLimit(20, 10 * 60_000), async (req, res) => {
  const body = req.body as HaikuRequest;
  if (!Array.isArray(body.images) || body.images.length === 0 || body.images.length > 6) {
    res.status(400).json({ error: "画像を1〜6枚送ってください。" });
    return;
  }
  const started = Date.now();
  try {
    const result = await generateHaiku(body);
    console.log(
      `[haiku] ${result.lines.join(" ")} mora=${result.mora.join("-")} attempts=${result.attempts} ${Date.now() - started}ms${result.mock ? " (mock)" : ""} note="${result.note}" subject=${JSON.stringify(result.subject)}`,
    );
    res.json(result);
  } catch (err) {
    console.error("[haiku] failed", err);
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "混み合っています。少し待ってからもう一度お試しください。" });
    } else if (err instanceof Anthropic.AuthenticationError) {
      res.status(500).json({ error: "API キーが正しく設定されていません。" });
    } else if (err instanceof Anthropic.APIError) {
      res.status(502).json({ error: `句の生成に失敗しました（${err.status}）。` });
    } else {
      res.status(500).json({ error: err instanceof Error ? err.message : "句の生成に失敗しました。" });
    }
  }
});

app.post("/api/critique", requirePasscode, rateLimit(20, 10 * 60_000), async (req, res) => {
  const body = req.body as CritiqueRequest;
  const lines = Array.isArray(body?.lines) ? body.lines.map((l) => String(l ?? "").slice(0, 40)) : [];
  if (lines.length !== 3 || lines.some((l) => !l.trim())) {
    res.status(400).json({ error: "句を3行そろえて送ってください。" });
    return;
  }
  if (!Array.isArray(body.images) || body.images.length === 0 || body.images.length > 6) {
    res.status(400).json({ error: "画像を1〜6枚送ってください。" });
    return;
  }
  const started = Date.now();
  try {
    const result = await critique(client, { images: body.images, lines });
    console.log(`[critique] ${lines.join(" ")} 渋さ=${result.shibusa} ${result.title} ${Date.now() - started}ms`);
    res.json(result);
  } catch (err) {
    console.error("[critique] failed", err);
    res.status(err instanceof Anthropic.RateLimitError ? 429 : 502).json({
      error: err instanceof Error && !(err instanceof Anthropic.APIError) ? err.message : "講評に失敗しました。もう一度お試しください。",
    });
  }
});

app.post("/api/mora", requirePasscode, async (req, res) => {
  const lines = (req.body?.lines ?? []) as string[];
  if (!Array.isArray(lines) || lines.length !== 3) {
    res.status(400).json({ error: "3行で送ってください。" });
    return;
  }
  const readings = Array.isArray(req.body?.readings) ? (req.body.readings as unknown[]).map((r) => String(r ?? "")) : undefined;
  const analysis = await analyzeHaiku(lines.map((l) => String(l)), readings);
  res.json({
    ok: analysis.ok,
    mora: analysis.lines.map((l) => l.mora),
    readings: analysis.lines.map((l) => l.reading),
    uncertain: analysis.lines.map((l) => l.uncertain),
  });
});

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "dist");
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = Number(process.env.PORT ?? 8787);
getTokenizer().then(() => {
  app.listen(port, "::", () => {
    console.log(`ここで一句 server: http://localhost:${port} ${isMock ? "(mock mode: API キー未設定)" : `(model: ${process.env.HAIKU_MODEL ?? "claude-sonnet-5-5"})`}${passcodeRequired ? " 合言葉あり" : " 合言葉なし"}`);
  });
});
