import { describe, expect, it } from "vitest";
import {
  clientIp,
  MAGIC_LINK_LIMITS,
  magicLinkSubjects,
  RATE_LIMITS,
  rateLimitDecision,
  rateLimitSubject,
  windowStart,
} from "./rate-limit";
import { DEMO_USER } from "../demo/demo-user";

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

  it("rounds down to a quarter hour for the email counter", () => {
    const { windowMs } = MAGIC_LINK_LIMITS.email;
    expect(windowStart(new Date("2026-10-22T14:37:12.345Z"), windowMs)).toEqual(
      new Date("2026-10-22T14:30:00.000Z"),
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

  it("sends 3 links to an email per 15 minutes", () => {
    const { limit, windowMs } = MAGIC_LINK_LIMITS.email;
    const quarter = new Date("2026-10-22T14:30:00.000Z");
    const now = new Date("2026-10-22T14:35:00.000Z");
    expect(rateLimitDecision(3, limit, quarter, now, windowMs).ok).toBe(true);
    expect(rateLimitDecision(4, limit, quarter, now, windowMs)).toEqual({
      ok: false,
      error: { retryAfterSeconds: 10 * 60 },
    });
  });
});

describe("magicLinkSubjects", () => {
  it("counts an email regardless of case and spaces", () => {
    expect(magicLinkSubjects(" Ada@Example.com ", "203.0.113.7")).toEqual({
      email: "magic-email:ada@example.com",
      ip: "magic-ip:203.0.113.7",
    });
  });

  it("puts callers without an address on one counter", () => {
    expect(magicLinkSubjects("a@b.c", null).ip).toBe("magic-ip:unknown");
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

describe("rateLimitSubject", () => {
  it("counts a signed-in user per account", () => {
    expect(rateLimitSubject("u1", "203.0.113.7")).toEqual({
      subject: "user:u1",
      limit: RATE_LIMITS.user,
    });
  });

  it("counts a guest per IP", () => {
    expect(rateLimitSubject(null, "203.0.113.7")).toEqual({
      subject: "ip:203.0.113.7",
      limit: RATE_LIMITS.guest,
    });
  });

  it("counts demo visitors per IP, like guests", () => {
    expect(rateLimitSubject(DEMO_USER.id, "203.0.113.7")).toEqual({
      subject: "ip:203.0.113.7",
      limit: RATE_LIMITS.guest,
    });
  });

  it("puts callers without a known address on one counter", () => {
    expect(rateLimitSubject(null, null).subject).toBe("ip:unknown");
  });
});
