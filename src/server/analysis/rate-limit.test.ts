import { describe, expect, it } from "vitest";
import {
  clientIp,
  RATE_LIMITS,
  rateLimitDecision,
  windowStart,
} from "./rate-limit";

describe("windowStart", () => {
  it("rounds down to the hour", () => {
    expect(windowStart(new Date("2026-10-22T14:37:12.345Z"))).toEqual(
      new Date("2026-10-22T14:00:00.000Z"),
    );
  });

  it("keeps a time that is already on the hour", () => {
    expect(windowStart(new Date("2026-10-22T14:00:00.000Z"))).toEqual(
      new Date("2026-10-22T14:00:00.000Z"),
    );
  });
});

describe("rateLimitDecision", () => {
  const start = new Date("2026-10-22T14:00:00.000Z");

  it("lets the guest's 10th check through and stops the 11th", () => {
    const now = new Date("2026-10-22T14:20:00.000Z");
    expect(rateLimitDecision(10, RATE_LIMITS.guest, start, now).ok).toBe(true);
    expect(rateLimitDecision(11, RATE_LIMITS.guest, start, now)).toEqual({
      ok: false,
      error: { retryAfterSeconds: 40 * 60 },
    });
  });

  it("gives signed-in users 30", () => {
    const now = new Date("2026-10-22T14:20:00.000Z");
    expect(rateLimitDecision(30, RATE_LIMITS.user, start, now).ok).toBe(true);
    expect(rateLimitDecision(31, RATE_LIMITS.user, start, now).ok).toBe(false);
  });

  it("waits a full hour at the start of the window", () => {
    expect(rateLimitDecision(11, 10, start, start)).toEqual({
      ok: false,
      error: { retryAfterSeconds: 3600 },
    });
  });

  it("waits at least a second at the very end of the window", () => {
    const now = new Date("2026-10-22T14:59:59.999Z");
    expect(rateLimitDecision(11, 10, start, now)).toEqual({
      ok: false,
      error: { retryAfterSeconds: 1 },
    });
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip", () => {
    const headers = new Headers({
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("takes the first x-forwarded-for entry", () => {
    const headers = new Headers({
      "x-forwarded-for": " 198.51.100.1 , 10.0.0.1",
    });
    expect(clientIp(headers)).toBe("198.51.100.1");
  });

  it("returns null without either header", () => {
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": " " }))).toBeNull();
  });
});
