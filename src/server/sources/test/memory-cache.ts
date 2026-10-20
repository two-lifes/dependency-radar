import type { Cache } from "../cache";

/** In-memory `Cache` for unit tests, which never touch the database. */
export function createMemoryCache(now: () => number = () => Date.now()) {
  const entries = new Map<string, { value: unknown; expiresAt: number }>();
  const cache: Cache = {
    async get(key) {
      const entry = entries.get(key);
      return entry && entry.expiresAt > now() ? entry.value : undefined;
    },
    async set(key, value, ttlMs) {
      entries.set(key, { value, expiresAt: now() + ttlMs });
    },
  };
  return { cache, entries };
}
