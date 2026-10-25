import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { queueCheck } from "./actions";
import { useCheckQueue } from "./use-check-queue";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./actions", () => ({ queueCheck: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it("settles only the cooling project while the next project continues, without retrying", async () => {
  const until = new Date(Date.now() + 60_000).toISOString();
  vi.mocked(queueCheck).mockImplementation(async (id) =>
    id === "a"
      ? { kind: "check-cooldown", nextCheckAt: until }
      : { kind: "started", checkId: "check-b" },
  );
  vi.stubGlobal(
    "EventSource",
    class {
      addEventListener = vi.fn();
      close = vi.fn();
    },
  );
  const { result, rerender } = renderHook(() => useCheckQueue(["a", "b"]));
  await waitFor(() =>
    expect(result.current.queue.items).toEqual([
      {
        projectId: "b",
        fresh: false,
        phase: "running",
        checkId: "check-b",
        checked: 0,
        total: 0,
      },
    ]),
  );
  expect(result.current.cooldowns).toEqual({ a: until });
  expect(result.current.queue.paused).toBeNull();
  rerender();
  expect(queueCheck).toHaveBeenCalledTimes(2);
});

it("pauses waiting projects offline and resumes the queue once without replaying manual checks", async () => {
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  vi.mocked(queueCheck).mockResolvedValue({ kind: "skipped" });
  const { result } = renderHook(() => useCheckQueue(["a", "b"]));
  expect(queueCheck).not.toHaveBeenCalled();
  act(() => result.current.checkNow("manual"));
  online.mockReturnValue(true);
  act(() => window.dispatchEvent(new Event("online")));
  await waitFor(() => expect(queueCheck).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.queue.items).toHaveLength(0));
  expect(queueCheck).toHaveBeenCalledWith("a", false);
  expect(queueCheck).toHaveBeenCalledWith("b", false);
  act(() => window.dispatchEvent(new Event("online")));
  expect(queueCheck).toHaveBeenCalledTimes(2);
});

it("keeps a failed launch visible until a manual retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(queueCheck)
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValue({ kind: "skipped" });
  const { result } = renderHook(() => useCheckQueue(["a"]));
  await waitFor(() =>
    expect(result.current.failures.a).toMatch(/Couldn't complete/),
  );
  expect(result.current.queue.items).toHaveLength(0);
  act(() => window.dispatchEvent(new Event("online")));
  expect(queueCheck).toHaveBeenCalledOnce();
  act(() => result.current.checkNow("a"));
  await waitFor(() => expect(queueCheck).toHaveBeenCalledTimes(2));
  expect(result.current.failures.a).toBeUndefined();
});
