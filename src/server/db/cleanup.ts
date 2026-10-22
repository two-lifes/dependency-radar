import { lte } from "drizzle-orm";
import type { Db } from "./client";
import { apiCache, reports } from "./schema";

/**
 * Guest reports past their `expires_at` (created + 7 days, spec 9). Same
 * boundary as `isReportExpired`, so the cron deletes exactly what the report
 * page already shows as expired. Project reports have no `expires_at` and
 * `null <= now` is never true.
 */
export function expiredGuestReports(now: Date) {
  return lte(reports.expiresAt, now);
}

/** Deletes expired guest reports; checks and their packages go by cascade. */
export async function deleteExpiredGuestReports(
  db: Db,
  now: Date,
): Promise<number> {
  const deleted = await db
    .delete(reports)
    .where(expiredGuestReports(now))
    .returning({ id: reports.id });
  return deleted.length;
}

/** Rows `withCache` already treats as misses (`expires_at > now` is a hit). */
export async function deleteExpiredApiCache(
  db: Db,
  now: Date,
): Promise<number> {
  const deleted = await db
    .delete(apiCache)
    .where(lte(apiCache.expiresAt, now))
    .returning({ key: apiCache.key });
  return deleted.length;
}
