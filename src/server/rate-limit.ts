import { headers } from "next/headers";
import {
  clientIp,
  RATE_LIMITS,
  type RateLimited,
  rateLimitDecision,
  windowStart,
} from "./analysis/rate-limit";
import type { Result } from "./analysis/result";
import { getOptionalSession } from "./auth/session";
import { getDb } from "./db/client";
import { hitRateLimit } from "./db/rate-limits";

/**
 * Counts one check against the caller's hourly limit (decisions 44). Called
 * by every Server Action that starts a check, before any slow work.
 * Database errors propagate: the action would fail on its next query anyway.
 */
export async function consumeCheck(
  now: Date = new Date(),
): Promise<Result<void, RateLimited>> {
  const session = await getOptionalSession();
  // Without a known address all such guests share one counter: stricter, but
  // never unlimited.
  const subject = session
    ? `user:${session.user.id}`
    : `ip:${clientIp(await headers()) ?? "unknown"}`;
  const limit = session ? RATE_LIMITS.user : RATE_LIMITS.guest;
  const start = windowStart(now);
  const count = await hitRateLimit(getDb(), subject, start);
  return rateLimitDecision(count, limit, start, now);
}
