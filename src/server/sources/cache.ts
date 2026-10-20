import { and, eq, gt } from "drizzle-orm";
import type { z } from "zod";
import type { Result } from "../analysis/result";
import type { Db } from "../db/client";
import { apiCache } from "../db/schema";

/** spec 9: a re-check within an hour reuses fetched data. */
export const DEFAULT_TTL_MS = 60 * 60 * 1000;

export type Cache = {
  /** The stored value, or `undefined` when missing or expired. */
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
};

export function createPgCache(
  db: Db,
  now: () => Date = () => new Date(),
): Cache {
  return {
    async get(key) {
      const rows = await db
        .select({ value: apiCache.value })
        .from(apiCache)
        .where(and(eq(apiCache.key, key), gt(apiCache.expiresAt, now())))
        .limit(1);
      return rows[0]?.value;
    },
    async set(key, value, ttlMs) {
      const fetchedAt = now();
      const expiresAt = new Date(fetchedAt.getTime() + ttlMs);
      await db
        .insert(apiCache)
        .values({ key, value, fetchedAt, expiresAt })
        .onConflictDoUpdate({
          target: apiCache.key,
          set: { value, fetchedAt, expiresAt },
        });
    },
  };
}

/**
 * Serve `key` from the cache or run `load` and store a successful result.
 * Failures are not cached so the next check retries them. The cached value is
 * re-validated: a shape written by an older deploy counts as a miss. Cache
 * errors never fail the load, the source is just asked directly.
 */
export async function withCache<T, E>(
  cache: Cache,
  key: string,
  schema: z.ZodType<T>,
  load: () => Promise<Result<T, E>>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<Result<T, E>> {
  try {
    const parsed = schema.safeParse(await cache.get(key));
    if (parsed.success) return { ok: true, value: parsed.data };
  } catch (error) {
    console.error(`[cache] read ${key} failed`, error);
  }

  const result = await load();
  if (result.ok) {
    try {
      await cache.set(key, result.value, ttlMs);
    } catch (error) {
      console.error(`[cache] write ${key} failed`, error);
    }
  }
  return result;
}
