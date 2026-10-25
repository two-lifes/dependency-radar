import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOptionalSession, getSession, requireSession } from "./session";
const mocked = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("./auth", () => ({ getAuth: () => ({ api: mocked }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
beforeEach(() => {
  mocked.getSession.mockReset();
});
describe("old demo sessions", () => {
  it("are guests on public pages and cannot enter protected pages or actions", async () => {
    mocked.getSession.mockResolvedValue({
      user: { id: "demo" },
      session: { id: "old" },
    });
    expect(await getSession()).toBeNull();
    expect(await getOptionalSession()).toBeNull();
    await expect(requireSession()).rejects.toThrow("redirect:/login");
  });
  it("preserves normal sessions", async () => {
    const session = { user: { id: "real" }, session: { id: "normal" } };
    mocked.getSession.mockResolvedValue(session);
    expect(await requireSession()).toEqual(session);
    expect(await getOptionalSession()).toEqual(session);
  });
});
