import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { queueCheck } from "./actions";
import { useCheckQueue } from "./use-check-queue";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./actions", () => ({ queueCheck: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
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
