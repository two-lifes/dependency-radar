vi.mock("@/server/db/check-cooldown", () => ({
  checkLaunchBlock: vi.fn(async () => null),
}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkLaunchBlock } from "@/server/db/check-cooldown";
import { GuestQuotaExhausted } from "@/server/db/guest-quota";
import { checkAgain, resume, retry } from "./actions";
const mocked = vi.hoisted(() => ({
  launch: vi.fn(),
  hourly: vi.fn(),
  start: vi.fn(),
  resume: vi.fn(),
  retry: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/server/guest-quota", () => ({ prepareGuestLaunch: mocked.launch }));
vi.mock("@/server/rate-limit", () => ({ consumeCheck: mocked.hourly }));
vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/check-store", () => ({
  createPgCheckStore: (_db: unknown, id?: string) => ({ guestId: id }),
}));
vi.mock("@/server/db/report-page", () => ({
  getReportMeta: async () => ({
    expiresAt: null,
    source: "github",
    repoUrl: "https://github.com/quota-test/repo",
  }),
  getCheckReportMeta: async () => ({ expiresAt: null }),
}));
vi.mock("@/server/report-access", () => ({ canOpenReport: async () => true }));
vi.mock("@/server/check/check-control", () => ({
  startCheck: mocked.start,
  resumeCheck: mocked.resume,
  retryFailed: mocked.retry,
}));
vi.mock("../check/read-repo", () => ({ readRepoInput: mocked.read }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const id = "afb94f72-9ac8-4512-ad23-5ca129df4259";
beforeEach(() => {
  vi.resetAllMocks();
  mocked.launch.mockResolvedValue("initiator");
  mocked.hourly.mockResolvedValue({ ok: true });
  mocked.start.mockResolvedValue({ ok: true, value: { checkId: id } });
  mocked.read.mockResolvedValue({
    ok: true,
    value: { input: { name: "refreshed" } },
  });
});
describe("report quota boundary", () => {
  it("refuses exhausted requests before fetching the repository", async () => {
    mocked.launch.mockRejectedValue(new GuestQuotaExhausted());
    expect(await checkAgain(id)).toEqual({
      code: "guest-quota-exhausted",
      remaining: 0,
    });
    expect(mocked.read).not.toHaveBeenCalled();
    expect(mocked.start).not.toHaveBeenCalled();
  });
  it("passes initiator quota to the transaction and returns a concurrent refusal", async () => {
    mocked.start.mockResolvedValue({
      ok: false,
      error: "guest-quota-exhausted",
    });
    expect(await checkAgain(id)).toEqual({
      code: "guest-quota-exhausted",
      remaining: 0,
    });
    expect(mocked.start).toHaveBeenCalledWith({ guestId: "initiator" }, id, {
      name: "refreshed",
    });
  });
  it("does not charge when GitHub preparation fails", async () => {
    mocked.read.mockResolvedValue({
      ok: false,
      error: "Repository not found or private.",
    });
    expect(await checkAgain(id)).toEqual({
      error: "Repository not found or private.",
    });
    expect(mocked.start).not.toHaveBeenCalled();
  });
  it.each([resume, retry])(
    "continuation never checks permanent quota but retains hourly protection",
    async (action) => {
      mocked.launch.mockRejectedValue(new GuestQuotaExhausted());
      expect(await action(id)).toEqual({});
      expect(mocked.launch).not.toHaveBeenCalled();
      expect(mocked.hourly).toHaveBeenCalledOnce();
      mocked.hourly.mockResolvedValue({
        ok: false,
        error: { retryAfterSeconds: 60 },
      });
      expect(await action(id)).toEqual({
        error: "Too many checks. Try again in 1 minute.",
      });
    },
  );
});

describe("report cooldown boundary", () => {
  const until = "2026-10-25T15:00:00.000Z";
  it("refuses before quota, hourly accounting and repository preparation", async () => {
    vi.mocked(checkLaunchBlock).mockResolvedValueOnce({
      error: "check-cooldown",
      nextCheckAt: until,
    });
    expect(await checkAgain(id)).toEqual({
      code: "check-cooldown",
      nextCheckAt: until,
    });
    expect(mocked.launch).not.toHaveBeenCalled();
    expect(mocked.hourly).not.toHaveBeenCalled();
    expect(mocked.read).not.toHaveBeenCalled();
    expect(mocked.start).not.toHaveBeenCalled();
  });
  it("returns an authoritative concurrent refusal", async () => {
    mocked.start.mockResolvedValueOnce({
      ok: false,
      error: "check-cooldown",
      nextCheckAt: until,
    });
    expect(await checkAgain(id)).toEqual({
      code: "check-cooldown",
      nextCheckAt: until,
    });
  });
  it("fails closed on a cooldown storage error", async () => {
    vi.mocked(checkLaunchBlock).mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    expect(await checkAgain(id)).toEqual({
      error: "Couldn't start the check. Try again.",
    });
    expect(mocked.hourly).not.toHaveBeenCalled();
    expect(mocked.start).not.toHaveBeenCalled();
  });
  it.each([resume, retry])(
    "does not apply cooldown to continuation",
    async (action) => {
      await action(id);
      expect(checkLaunchBlock).not.toHaveBeenCalled();
    },
  );
});
