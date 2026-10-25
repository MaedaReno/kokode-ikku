import { timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";

const PASSCODE = process.env.APP_PASSCODE?.trim() ?? "";

export const passcodeRequired = PASSCODE.length > 0;

function matches(given: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(PASSCODE);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 公開 URL から誰でも句を作れないよう、合言葉を確かめる */
export const requirePasscode: RequestHandler = (req, res, next) => {
  if (!passcodeRequired) return next();
  const given = req.get("x-passcode") ?? "";
  if (matches(given)) return next();
  res.status(401).json({ error: "合言葉が違います。", code: "passcode" });
};

export const checkPasscode: RequestHandler = (req, res) => {
  const given = String(req.body?.passcode ?? "");
  if (!passcodeRequired || matches(given)) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "合言葉が違います。", code: "passcode" });
  }
};

function clientIp(req: Request): string {
  // Cloudflare のトンネル経由では、元の接続元がこのヘッダーに入る
  return req.get("cf-connecting-ip") ?? req.ip ?? "unknown";
}

/** 合言葉が漏れたときの被害を抑えるため、接続元ごとに生成回数を絞る */
export function rateLimit(max: number, windowMs: number): RequestHandler {
  const hits = new Map<string, number[]>();
  return (req, res, next) => {
    const now = Date.now();
    const ip = clientIp(req);
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.status(429).json({ error: "短い時間に詠みすぎました。少し休んでからお試しください。" });
      return;
    }
    recent.push(now);
    hits.set(ip, recent);
    next();
  };
}
