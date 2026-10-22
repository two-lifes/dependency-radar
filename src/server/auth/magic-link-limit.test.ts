// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/client";
import { consumeMagicLink } from "./magic-link-limit";

const counts = vi.hoisted(() => new Map<string, number>());
vi.mock("../db/rate-limits", () => ({
  hitRateLimit: vi.fn(async (_db: unknown, subject: string, start: Date) => {
    const key = `${subject}@${start.toISOString()}`;
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
  }),
}));

const db = {} as Db;
const now = new Date("2026-10-22T14:35:00.000Z");

beforeEach(() => counts.clear());

describe("consumeMagicLink", () => {
  it("sends 3 links to one email, then waits for the quarter hour", async () => {
    for (let i = 0; i < 3; i++) {
      expect(
        (await consumeMagicLink(db, "ada@example.com", "1.1.1.1", now)).ok,
      ).toBe(true);
    }
    expect(
      await consumeMagicLink(db, "ADA@example.com", "2.2.2.2", now),
    ).toEqual({ ok: false, error: { retryAfterSeconds: 10 * 60 } });
    const later = new Date("2026-10-22T14:45:00.000Z");
    expect(
      (await consumeMagicLink(db, "ada@example.com", "1.1.1.1", later)).ok,
    ).toBe(true);
  });

  it("sends 10 links from one IP per hour, to any emails", async () => {
    for (let i = 0; i < 10; i++) {
      expect(
        (await consumeMagicLink(db, `u${i}@example.com`, "1.1.1.1", now)).ok,
      ).toBe(true);
    }
    expect(
      await consumeMagicLink(db, "fresh@example.com", "1.1.1.1", now),
    ).toEqual({ ok: false, error: { retryAfterSeconds: 25 * 60 } });
  });

  it("doesn't count the email when the IP is over its limit", async () => {
    for (let i = 0; i < 11; i++) {
      await consumeMagicLink(db, `u${i}@example.com`, "1.1.1.1", now);
    }
    expect([...counts.keys()].some((key) => key.includes("fresh"))).toBe(false);
    await consumeMagicLink(db, "fresh@example.com", "1.1.1.1", now);
    expect([...counts.keys()].some((key) => key.includes("fresh"))).toBe(false);
  });
});
