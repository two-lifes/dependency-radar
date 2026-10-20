import { describe, expect, it } from "vitest";
import { createLimiter } from "./limiter";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createLimiter", () => {
  it("runs at most N tasks at once and finishes all of them", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        limit(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await tick();
          active -= 1;
          return i;
        }),
      ),
    );

    expect(peak).toBe(2);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("does not let a newcomer take a slot handed to a waiter", async () => {
    const limit = createLimiter(1);
    let active = 0;
    let peak = 0;
    const task = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await tick();
      active -= 1;
    };

    const first = limit(task);
    const queued = limit(task);
    await first;
    // The slot was just handed to `queued`; this one must wait.
    const late = limit(task);
    await Promise.all([queued, late]);

    expect(peak).toBe(1);
  });

  it("frees the slot when a task fails", async () => {
    const limit = createLimiter(1);

    await expect(
      limit(() => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
    await expect(limit(async () => "next")).resolves.toBe("next");
  });

  it("rejects a non-positive concurrency", () => {
    expect(() => createLimiter(0)).toThrow();
  });
});
