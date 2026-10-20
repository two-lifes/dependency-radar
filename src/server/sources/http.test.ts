import { describe, expect, it } from "vitest";
import { parseRetryAfter } from "./http";

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-10-20T12:00:00.000Z");

  it("reads delay seconds", () => {
    expect(parseRetryAfter("30", now)).toBe(30_000);
  });

  it("reads an HTTP date", () => {
    expect(parseRetryAfter("Tue, 20 Oct 2026 12:01:00 GMT", now)).toBe(60_000);
  });

  it("clamps a past date to zero", () => {
    expect(parseRetryAfter("Tue, 20 Oct 2026 11:00:00 GMT", now)).toBe(0);
  });

  it.each([null, "", "soon"])("ignores %j", (value) => {
    expect(parseRetryAfter(value, now)).toBeUndefined();
  });
});
