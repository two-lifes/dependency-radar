import { describe, expect, it } from "vitest";
import { formatDayMonth, formatRelativeTime } from "./format-time";

const now = new Date("2026-10-20T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe("formatRelativeTime", () => {
  it.each([
    [30_000, "just now"],
    [MIN, "1 min ago"],
    [5 * MIN + 59_000, "5 min ago"],
    [2 * 60 * MIN, "2 h ago"],
    [DAY, "1 day ago"],
    [3 * DAY, "3 days ago"],
    [14 * DAY, "2 weeks ago"],
    [65 * DAY, "2 months ago"],
    [800 * DAY, "2 years ago"],
  ])("%i ms ago → %s", (ms, text) => {
    expect(formatRelativeTime(ago(ms), now)).toBe(text);
  });

  it("treats a date in the future as just now", () => {
    expect(formatRelativeTime(ago(-5 * MIN), now)).toBe("just now");
  });
});

describe("formatDayMonth", () => {
  it("prints day and short month", () => {
    expect(formatDayMonth(new Date("2026-10-25T12:00:00Z"))).toBe("25 Oct");
  });
});
