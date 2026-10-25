import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestQuotaExhausted } from "@/server/db/guest-quota";
import { startGuestCheck } from "./actions";
const mocked = vi.hoisted(() => ({
  launch: vi.fn(),
  hourly: vi.fn(),
  prepare: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/server/guest-quota", () => ({ prepareGuestLaunch: mocked.launch }));
vi.mock("@/server/rate-limit", () => ({ consumeCheck: mocked.hourly }));
vi.mock("../check/prepare-input", () => ({ prepareReport: mocked.prepare }));
vi.mock("@/server/db/reports", () => ({ createGuestReport: mocked.create }));
vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
const form = () => {
  const data = new FormData();
  data.set("source", "github");
  data.set("url", "https://github.com/quota-test/repo");
  return data;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocked.launch.mockResolvedValue("browser-id");
  mocked.hourly.mockResolvedValue({ ok: true });
  mocked.prepare.mockResolvedValue({ ok: true, report: { source: "github" } });
  mocked.create.mockResolvedValue({ reportId: "r1", checkId: "c1" });
});
describe("landing quota boundary", () => {
  it("refuses before GitHub preparation when already exhausted", async () => {
    mocked.launch.mockRejectedValue(new GuestQuotaExhausted());
    expect(await startGuestCheck({ attempt: 0 }, form())).toEqual({
      attempt: 1,
      code: "guest-quota-exhausted",
      remaining: 0,
    });
    expect(mocked.prepare).not.toHaveBeenCalled();
    expect(mocked.create).not.toHaveBeenCalled();
  });
  it("returns a distinct outcome for the losing concurrent launch", async () => {
    mocked.create.mockRejectedValue(new GuestQuotaExhausted());
    expect(await startGuestCheck({ attempt: 0 }, form())).toMatchObject({
      code: "guest-quota-exhausted",
      remaining: 0,
    });
  });
  it("does not reach the charging transaction when preparation fails", async () => {
    mocked.prepare.mockResolvedValue({
      ok: false,
      message: "Repository not found or private.",
    });
    expect(await startGuestCheck({ attempt: 0 }, form())).toMatchObject({
      error: { message: "Repository not found or private." },
    });
    expect(mocked.hourly).toHaveBeenCalledOnce();
    expect(mocked.create).not.toHaveBeenCalled();
  });
  it("passes the server identity into the creation transaction", async () => {
    await expect(startGuestCheck({ attempt: 0 }, form())).rejects.toThrow(
      "redirect:/r/r1/dependencies",
    );
    expect(mocked.create).toHaveBeenCalledWith(
      {},
      { source: "github" },
      expect.any(Date),
      "browser-id",
    );
  });
  it("does not mislabel storage failure as exhaustion", async () => {
    mocked.launch.mockRejectedValue(new Error("db unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await startGuestCheck({ attempt: 0 }, form());
    expect(result.error).toBeDefined();
    expect(result.code).toBeUndefined();
    expect(mocked.create).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
