import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAgain, resume, retry } from "./actions";

const REPORT_ID = "0b6f3a52-4a43-4c4f-9a43-1f1f3c1b2a10";
const CHECK_ID = "6c1e6a0e-2a55-4d0f-8a5c-3e1a8f4b9c21";

const state = vi.hoisted(() => ({
  counts: new Map<string, number>(),
  session: null as { user: { id: string } } | null,
  ip: "203.0.113.7",
}));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": state.ip }),
}));
vi.mock("@/server/auth/session", () => ({
  getOptionalSession: async () => state.session,
}));
vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/check-store", () => ({ createPgCheckStore: () => ({}) }));
vi.mock("@/server/db/report-page", () => ({
  getReportMeta: async () => ({ expiresAt: null }),
  getCheckReportMeta: async () => ({ expiresAt: null }),
}));
vi.mock("@/server/db/rate-limits", () => ({
  hitRateLimit: async (_db: unknown, subject: string, windowStart: Date) => {
    const key = `${subject}@${windowStart.toISOString()}`;
    const count = (state.counts.get(key) ?? 0) + 1;
    state.counts.set(key, count);
    return count;
  },
}));
const control = vi.hoisted(() => ({
  startCheck: vi.fn(async () => ({ ok: true, value: { checkId: "c" } })),
  resumeCheck: vi.fn(async () => ({ ok: true, value: undefined })),
  retryFailed: vi.fn(async () => ({ ok: true, value: undefined })),
  cancelCheck: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock("@/server/check/check-control", () => control);

describe("report actions under the rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T14:20:00.000Z"));
    state.counts.clear();
    state.session = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops a guest's 11th check in the hour without starting it", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await checkAgain(REPORT_ID)).toEqual({});
    }
    expect(control.startCheck).toHaveBeenCalledTimes(10);

    expect(await checkAgain(REPORT_ID)).toEqual({
      error: "Too many checks. Try again in 40 minutes.",
    });
    expect(control.startCheck).toHaveBeenCalledTimes(10);
  });

  it("counts Resume and Retry failed with Check again", async () => {
    for (let i = 0; i < 5; i++) await resume(CHECK_ID);
    for (let i = 0; i < 5; i++) await retry(CHECK_ID);

    expect(await checkAgain(REPORT_ID)).toHaveProperty("error");
    expect(await resume(CHECK_ID)).toHaveProperty("error");
    expect(await retry(CHECK_ID)).toHaveProperty("error");
    expect(control.resumeCheck).toHaveBeenCalledTimes(5);
    expect(control.retryFailed).toHaveBeenCalledTimes(5);
  });

  it("counts guests per IP", async () => {
    for (let i = 0; i < 10; i++) await checkAgain(REPORT_ID);
    state.ip = "198.51.100.1";

    expect(await checkAgain(REPORT_ID)).toEqual({});
    state.ip = "203.0.113.7";
  });

  it("gives a signed-in user 30 checks", async () => {
    state.session = { user: { id: "u1" } };
    for (let i = 0; i < 30; i++) {
      expect(await checkAgain(REPORT_ID)).toEqual({});
    }
    expect(await checkAgain(REPORT_ID)).toHaveProperty("error");
  });

  it("starts counting again in the next hour", async () => {
    for (let i = 0; i < 11; i++) await checkAgain(REPORT_ID);
    vi.setSystemTime(new Date("2026-10-22T15:00:00.000Z"));

    expect(await checkAgain(REPORT_ID)).toEqual({});
  });

  it("doesn't count an invalid id", async () => {
    for (let i = 0; i < 20; i++) await checkAgain("not-a-uuid");

    expect(await checkAgain(REPORT_ID)).toEqual({});
  });
});
