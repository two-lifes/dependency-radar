import {
  MAGIC_LINK_LIMITS,
  magicLinkSubjects,
  type RateLimited,
  rateLimitDecision,
  windowStart,
} from "../analysis/rate-limit";
import type { Result } from "../analysis/result";
import type { Db } from "../db/client";
import { hitRateLimit } from "../db/rate-limits";

/**
 * Counts one sign-in link against the IP and the email (plan.md 26.1). The IP
 * goes first: a visitor over their limit doesn't use up the inbox's three.
 */
export async function consumeMagicLink(
  db: Db,
  email: string,
  ip: string | null,
  now: Date = new Date(),
): Promise<Result<void, RateLimited>> {
  const subjects = magicLinkSubjects(email, ip);
  for (const key of ["ip", "email"] as const) {
    const { limit, windowMs } = MAGIC_LINK_LIMITS[key];
    const start = windowStart(now, windowMs);
    const count = await hitRateLimit(db, subjects[key], start);
    const decision = rateLimitDecision(count, limit, start, now, windowMs);
    if (!decision.ok) return decision;
  }
  return { ok: true, value: undefined };
}
