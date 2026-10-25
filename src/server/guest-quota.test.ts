import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  guestQuotaContext,
  prepareGuestLaunch,
  readGuestQuota,
} from "./guest-quota";
import { GuestQuotaExhausted } from "./db/guest-quota";
const state = vi.hoisted(() => ({
  id: "37b8a7e1-a70e-49ba-8ada-cc48ed45ad58" as string | undefined,
  signedIn: false,
}));
const remaining = vi.hoisted(() => vi.fn(async () => 3));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: state.id }) }),
}));
vi.mock("./auth/session", () => ({
  getOptionalSession: async () =>
    state.signedIn ? { user: { id: "real" } } : null,
}));
vi.mock("./db/client", () => ({ getDb: () => ({}) }));
vi.mock("./db/guest-quota", async (original) => ({
  ...(await original<typeof import("./db/guest-quota")>()),
  guestChecksRemaining: remaining,
}));
beforeEach(() => {
  state.id = "37b8a7e1-a70e-49ba-8ada-cc48ed45ad58";
  state.signedIn = false;
  remaining.mockReset().mockResolvedValue(3);
});
describe("server quota identity", () => {
  it.each([undefined, "", "forged", "3"])(
    "refuses missing or malformed cookie %s",
    async (id) => {
      state.id = id;
      await expect(prepareGuestLaunch()).rejects.toThrow("Guest identity");
      expect(remaining).not.toHaveBeenCalled();
    },
  );
  it("returns only the server's remaining allowance", async () => {
    remaining.mockResolvedValue(1);
    expect(await guestQuotaContext()).toEqual({
      guestId: state.id,
      remaining: 1,
    });
  });
  it("distinguishes exhaustion from a database failure", async () => {
    remaining.mockResolvedValue(0);
    await expect(prepareGuestLaunch()).rejects.toBeInstanceOf(
      GuestQuotaExhausted,
    );
    remaining.mockRejectedValue(new Error("db down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readGuestQuota()).toEqual({ kind: "error" });
    log.mockRestore();
  });
  it("bypasses browser quota for an account without changing its counter", async () => {
    state.signedIn = true;
    state.id = undefined;
    expect(await prepareGuestLaunch()).toBeUndefined();
    expect(await readGuestQuota()).toEqual({ kind: "account" });
    expect(remaining).not.toHaveBeenCalled();
  });
});
