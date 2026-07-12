// When the engine can't serve (Claude credit/auth error), trip the breaker so
// /analyze is rejected before the x402 gate — buyers are never charged for a
// check we can't deliver. Half-opens after the cooldown.
const COOLDOWN_MS = Number(process.env.BREAKER_COOLDOWN_MS ?? 120_000);

let openUntil = 0;

export function isBreakerOpen(): boolean {
  return Date.now() < openUntil;
}

export function tripBreaker(why: string): void {
  openUntil = Date.now() + COOLDOWN_MS;
  console.error(`[breaker] OPEN for ${COOLDOWN_MS}ms — ${why}`);
}

export function closeBreaker(): void {
  if (openUntil !== 0) console.log("[breaker] closed — service recovered");
  openUntil = 0;
}

export function isServiceUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
  if (/credit balance|billing|insufficient|payment required|quota/i.test(msg)) return true;
  if (status === 401 || /authentication|unauthorized|invalid.*api.?key/i.test(msg)) return true;
  return false;
}
