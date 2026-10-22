import { isDemoUser } from "../demo/demo-user";
import type { Result } from "./result";

// spec 9: checks per hour, per IP for guests and per account once signed in.
export const RATE_LIMITS = { guest: 10, user: 30 } as const;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export type RateLimited = { retryAfterSeconds: number };

/** Which counter a check goes to, and its limit (decisions 44, 50). */
export function rateLimitSubject(
  userId: string | null,
  ip: string | null,
): { subject: string; limit: number } {
  // Every demo visitor is the same user: by IP, as guests, they don't use up
  // each other's checks.
  if (userId !== null && !isDemoUser(userId)) {
    return { subject: `user:${userId}`, limit: RATE_LIMITS.user };
  }
  // Without a known address all such callers share one counter: stricter,
  // but never unlimited.
  return { subject: `ip:${ip ?? "unknown"}`, limit: RATE_LIMITS.guest };
}

/**
 * plan.md 26.1: per email so one inbox can't be flooded, per IP so one
 * visitor can't flood many inboxes.
 */
export const MAGIC_LINK_LIMITS = {
  email: { limit: 3, windowMs: 15 * 60 * 1000 },
  ip: { limit: 10, windowMs: RATE_LIMIT_WINDOW_MS },
} as const;

/** Counters of `sendMagicLink`, apart from the check counters. */
export function magicLinkSubjects(
  email: string,
  ip: string | null,
): { email: string; ip: string } {
  return {
    email: `magic-email:${email.trim().toLowerCase()}`,
    ip: `magic-ip:${ip ?? "unknown"}`,
  };
}

/** Fixed windows aligned to their length, so every server agrees on the row. */
export function windowStart(
  now: Date,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): Date {
  const ms = now.getTime();
  return new Date(ms - (ms % windowMs));
}

/** `count` already includes this attempt. */
export function rateLimitDecision(
  count: number,
  limit: number,
  start: Date,
  now: Date,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): Result<void, RateLimited> {
  if (count <= limit) return { ok: true, value: undefined };
  const leftMs = start.getTime() + windowMs - now.getTime();
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
