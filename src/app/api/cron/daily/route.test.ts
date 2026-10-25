// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const SECRET = "s3cret-value";

const db = vi.hoisted(() => ({}));
vi.mock("@/server/db/client", () => ({ getDb: () => db }));
const cleanup = vi.hoisted(() => ({
  deleteExpiredGuestReports: vi.fn(),
  deleteExpiredApiCache: vi.fn(),
}));
vi.mock("@/server/db/cleanup", () => cleanup);
const demo = vi.hoisted(() => ({ seedDemo: vi.fn() }));
vi.mock("@/server/db/demo", () => demo);

function run(authorization?: string) {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return POST(
    new Request("http://localhost:3000/api/cron/daily", {
      method: "POST",
      headers,
    }),
  );
}

function expectNothingRan() {
  expect(cleanup.deleteExpiredGuestReports).not.toHaveBeenCalled();
  expect(cleanup.deleteExpiredApiCache).not.toHaveBeenCalled();
  expect(demo.seedDemo).not.toHaveBeenCalled();
}

describe("POST /api/cron/daily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => {});
    cleanup.deleteExpiredGuestReports.mockResolvedValue(3);
    cleanup.deleteExpiredApiCache.mockResolvedValue(42);
    demo.seedDemo.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ["no header", undefined],
    [
      "a wrong secret of the same length",
      `Bearer ${"x".repeat(SECRET.length)}`,
    ],
    ["a secret of another length", "Bearer short"],
    ["the secret without Bearer", SECRET],
  ])("refuses %s with 401", async (_, authorization) => {
    const response = await run(authorization);

    expect(response.status).toBe(401);
    expectNothingRan();
  });

  it.each([
    ["not set", undefined],
    ["empty", ""],
  ])("refuses everything when CRON_SECRET is %s", async (_, value) => {
    vi.stubEnv("CRON_SECRET", value);

    const response = await run("Bearer ");

    expect(response.status).toBe(401);
    expectNothingRan();
  });

  it("runs every step with one timestamp", async () => {
    const response = await run(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      guestReports: 3,
      apiCache: 42,
    });
    const now = cleanup.deleteExpiredGuestReports.mock.calls[0]?.[1];
    expect(now).toBeInstanceOf(Date);
    expect(cleanup.deleteExpiredGuestReports).toHaveBeenCalledWith(db, now);
    expect(cleanup.deleteExpiredApiCache).toHaveBeenCalledWith(db, now);
    expect(demo.seedDemo).not.toHaveBeenCalled();
  });

  it("still runs the other steps when one fails and answers 500", async () => {
    cleanup.deleteExpiredGuestReports.mockRejectedValue(new Error("db down"));

    const response = await run(`Bearer ${SECRET}`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ failed: ["guestReports"] });
    expect(cleanup.deleteExpiredApiCache).toHaveBeenCalled();
    expect(demo.seedDemo).not.toHaveBeenCalled();
  });
});
