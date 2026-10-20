import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Result } from "../analysis/result";
import { type Cache, withCache } from "./cache";
import { createMemoryCache } from "./test/memory-cache";

const schema = z.object({ n: z.number() });
const ok = (n: number): Result<{ n: number }, string> => ({
  ok: true,
  value: { n },
});

describe("withCache", () => {
  it("loads on a miss and serves the next call from the cache", async () => {
    const { cache } = createMemoryCache();
    const load = vi.fn(async () => ok(1));

    await expect(withCache(cache, "k", schema, load)).resolves.toEqual(ok(1));
    await expect(withCache(cache, "k", schema, load)).resolves.toEqual(ok(1));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads again after the TTL", async () => {
    let now = 0;
    const { cache } = createMemoryCache(() => now);
    const load = vi.fn(async () => ok(1));

    await withCache(cache, "k", schema, load, 1000);
    now = 1000;
    await withCache(cache, "k", schema, load, 1000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    const { cache, entries } = createMemoryCache();
    const failed: Result<{ n: number }, string> = { ok: false, error: "down" };

    await expect(
      withCache(cache, "k", schema, async () => failed),
    ).resolves.toEqual(failed);
    expect(entries.has("k")).toBe(false);
  });

  it("treats a cached value of another shape as a miss", async () => {
    const { cache } = createMemoryCache();
    await cache.set("k", { old: true }, 1000);

    await expect(
      withCache(cache, "k", schema, async () => ok(2)),
    ).resolves.toEqual(ok(2));
    await expect(cache.get("k")).resolves.toEqual({ n: 2 });
  });

  it("still loads when the cache store fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: Cache = {
      get: () => Promise.reject(new Error("db down")),
      set: () => Promise.reject(new Error("db down")),
    };

    await expect(
      withCache(broken, "k", schema, async () => ok(3)),
    ).resolves.toEqual(ok(3));
    vi.restoreAllMocks();
  });
});
