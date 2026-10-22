import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startGuestCheck } from "./actions";
import { initialCheckFormState } from "./check-form-state";

const state = vi.hoisted(() => ({ count: 0, failCounter: false }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }),
}));
vi.mock("@/server/auth/session", () => ({
  getOptionalSession: async () => null,
}));
vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/rate-limits", () => ({
  hitRateLimit: async () => {
    if (state.failCounter) throw new Error("database is down");
    return ++state.count;
  },
}));
vi.mock("@/server/db/reports", () => ({
  createGuestReport: async () => ({ reportId: "r1", checkId: "c1" }),
}));
const github = vi.hoisted(() => ({ fetchRepoSource: vi.fn() }));
vi.mock("@/server/sources/github", () => github);

const paste = () => {
  const form = new FormData();
  form.set("source", "paste");
  form.set("packageJson", '{"dependencies":{"react":"^19.0.0"}}');
  return form;
};

const githubUrl = () => {
  const form = new FormData();
  form.set("source", "github");
  form.set("url", "https://github.com/vercel/next.js");
  return form;
};

describe("startGuestCheck under the rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T14:58:30.000Z"));
    state.count = 0;
    state.failCounter = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the limit under the field on the 11th check, before reading GitHub", async () => {
    for (let i = 0; i < 10; i++) {
      await expect(
        startGuestCheck(initialCheckFormState, paste()),
      ).rejects.toThrow("redirect:/r/r1/dependencies");
    }

    const result = await startGuestCheck(initialCheckFormState, githubUrl());

    expect(result.error).toEqual({
      source: "github",
      message: "Too many checks. Try again in 2 minutes.",
    });
    expect(github.fetchRepoSource).not.toHaveBeenCalled();
  });

  it("shows the generic error when the counter can't be read", async () => {
    state.failCounter = true;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await startGuestCheck(initialCheckFormState, paste());

    expect(result.error?.source).toBe("paste");
    expect(result.error?.message).not.toMatch(/Too many checks/);
  });
});
