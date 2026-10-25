import { describe, expect, it } from "vitest";
import { cooldownSeconds, nextCheckAt } from "./check-cooldown";

describe("check cooldown", () => {
  const start = new Date("2026-10-25T12:00:00.000Z");
  it("allows a first check immediately", () => {
    expect(cooldownSeconds(null, start.getTime())).toBe(0);
  });
  it.each([
    [0, 60],
    [1_000, 59],
    [59_000, 1],
    [59_999, 1],
    [60_000, 0],
    [61_000, 0],
  ])("at %i ms has %i seconds left", (elapsed, remaining) => {
    expect(cooldownSeconds(nextCheckAt(start), start.getTime() + elapsed)).toBe(
      remaining,
    );
  });
});
