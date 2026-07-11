import type { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  maxPerIp: number;
  maxGlobal: number;
}

/**
 * Fixed-window rate limiter with a per-IP cap AND a global cap.
 *
 * - Per-IP cap stops a single abuser.
 * - Global cap bounds total spend (protects the Claude balance in open mode).
 *   The global counter only increments once an IP passes its own check, so one
 *   flooder can't inflate the global counter and lock everyone out.
 *
 * In-memory (fine for a single pm2 instance). Requires `trust proxy` so
 * `req.ip` reflects the real client behind nginx.
 */
export function rateLimiter(opts: RateLimitOptions) {
  const perIp = new Map<string, Bucket>();
  const global: Bucket = { count: 0, resetAt: 0 };

  // Prune expired IP buckets so the map can't grow unbounded.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of perIp) if (b.resetAt <= now) perIp.delete(ip);
  }, opts.windowMs);
  timer.unref?.();

  const roll = (b: Bucket, now: number, max: number): { ok: boolean; retryAfter: number } => {
    if (now >= b.resetAt) {
      b.count = 0;
      b.resetAt = now + opts.windowMs;
    }
    if (b.count >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
    b.count++;
    return { ok: true, retryAfter: 0 };
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    let b = perIp.get(ip);
    if (!b) {
      b = { count: 0, resetAt: now + opts.windowMs };
      perIp.set(ip, b);
    }

    const ipCheck = roll(b, now, opts.maxPerIp);
    if (!ipCheck.ok) {
      res.setHeader("Retry-After", String(ipCheck.retryAfter));
      return res.status(429).json({
        error: "Rate limit exceeded. Please slow down.",
        retry_after_seconds: ipCheck.retryAfter,
      });
    }

    const gCheck = roll(global, now, opts.maxGlobal);
    if (!gCheck.ok) {
      res.setHeader("Retry-After", String(gCheck.retryAfter));
      return res.status(503).json({
        error: "Service is busy right now. Please try again shortly.",
        retry_after_seconds: gCheck.retryAfter,
      });
    }

    next();
  };
}
