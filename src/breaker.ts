/**
 * Low-credit circuit breaker.
 *
 * When the analysis engine can't serve (Claude credit exhausted, auth failure),
 * we trip the breaker so incoming /analyze requests are rejected BEFORE the x402
 * payment gate — buyers are never charged for a check we can't deliver. After a
 * cooldown the breaker half-opens: the next request is allowed through to probe;
 * success closes it, another failure re-trips it.
 */

const COOLDOWN_MS = Number(process.env.BREAKER_COOLDOWN_MS ?? 120_000); // 2 min

let openUntil = 0;
let reason = "";

export function isBreakerOpen(): boolean {
  return Date.now() < openUntil;
}

export function tripBreaker(why: string): void {
  openUntil = Date.now() + COOLDOWN_MS;
  reason = why;
  console.error(`[breaker] OPEN for ${COOLDOWN_MS}ms — ${why}`);
}

export function closeBreaker(): void {
  if (openUntil !== 0) console.log("[breaker] closed — service recovered");
  openUntil = 0;
  reason = "";
}

/** True for errors where retrying now won't help and we must not charge. */
export function isServiceUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
  if (/credit balance|billing|insufficient|payment required|quota/i.test(msg)) return true;
  if (status === 401 || /authentication|unauthorized|invalid.*api.?key/i.test(msg)) return true;
  return false;
}
