// Best-effort, in-memory rate limiter (token/sliding-window style).
//
// LIMITATION (stopgap only): Vercel serverless functions are ephemeral and we
// have no durable shared store (Redis/Upstash) here. This limiter is scoped to a
// single function *instance*, so it only throttles repeated hits that land on the
// same warm instance. It is NOT a durable defense against distributed abuse — a
// real fix needs a shared store. Use it to reduce obvious spam/cost-abuse.

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Periodic cleanup so the Map does not grow unbounded (per-instance).
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function scheduleCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't keep the process alive just for cleanup.
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();
}

export interface RateLimitResult {
  ok: boolean;
  retryAfter?: number;
}

export interface RateLimitOptions {
  key: string;
  windowMs: number;
  max: number;
}

function getClientIp(req: any): string {
  const xff = req?.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    // x-forwarded-for may be "client, proxy1, proxy2"; take the first.
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) return String(xff[0]).trim();
  return req?.socket?.remoteAddress || "unknown";
}

export function rateLimit(req: any, opts: RateLimitOptions): RateLimitResult {
  scheduleCleanup();
  const now = Date.now();
  const id = getClientIp(req);
  const storeKey = `${opts.key}:${id}`;
  const existing = store.get(storeKey);

  if (!existing || existing.resetAt <= now) {
    store.set(storeKey, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  if (existing.count < opts.max) {
    existing.count += 1;
    return { ok: true };
  }

  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
  return { ok: false, retryAfter };
}
