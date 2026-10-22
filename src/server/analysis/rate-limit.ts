import type { Result } from "./result";

// spec 9: checks per hour, per IP for guests and per account once signed in.
export const RATE_LIMITS = { guest: 10, user: 30 } as const;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export type RateLimited = { retryAfterSeconds: number };

/** Fixed windows aligned to the hour, so every server agrees on the row. */
export function windowStart(now: Date): Date {
  const ms = now.getTime();
  return new Date(ms - (ms % RATE_LIMIT_WINDOW_MS));
}

/** `count` already includes this attempt. */
export function rateLimitDecision(
  count: number,
  limit: number,
  start: Date,
  now: Date,
): Result<void, RateLimited> {
  if (count <= limit) return { ok: true, value: undefined };
  const leftMs = start.getTime() + RATE_LIMIT_WINDOW_MS - now.getTime();
  return {
    ok: false,
    error: { retryAfterSeconds: Math.max(1, Math.ceil(leftMs / 1000)) },
  };
}

/**
 * Vercel overwrites `x-forwarded-for` with the client address and sets
 * `x-real-ip` to the same value, so neither can be spoofed there. Elsewhere
 * (local dev) the first `x-forwarded-for` entry is the client.
 */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}
