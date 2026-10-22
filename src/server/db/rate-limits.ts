import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { rateLimits } from "./schema";

/**
 * Counts one attempt and returns the window's total including it. A single
 * upsert, so parallel requests can't both read the same count.
 */
export async function hitRateLimit(
  db: Db,
  subject: string,
  windowStart: Date,
): Promise<number> {
  const [row] = await db
    .insert(rateLimits)
    .values({ subject, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.subject, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  if (!row) throw new Error("Upsert into rate_limits returned no row");
  return row.count;
}
