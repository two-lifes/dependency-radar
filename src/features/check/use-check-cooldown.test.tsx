import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useCheckCooldown } from "./use-check-cooldown";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("counts down by absolute time and never launches automatically", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
  const { result } = renderHook(() => useCheckCooldown("2026-10-25T12:01:00Z"));
  expect(result.current.seconds).toBe(60);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(result.current.seconds).toBe(59);
  act(() => {
    vi.advanceTimersByTime(59_000);
  });
  expect(result.current.seconds).toBe(0);
  expect(router.refresh).not.toHaveBeenCalled();
});

it("accepts a server refusal and refreshes when returning to the tab", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
  const { result, rerender } = renderHook(
    ({ until }) => useCheckCooldown(until),
    {
      initialProps: { until: "2026-10-25T11:59:00.000Z" },
    },
  );
  act(() => result.current.setDeadline("2026-10-25T12:01:00.000Z"));
  expect(result.current.seconds).toBe(60);
  rerender({ until: "2026-10-25T11:59:00.000Z" });
  expect(result.current.seconds).toBe(60);
  act(() => {
    vi.setSystemTime(new Date("2026-10-25T12:00:40Z"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(result.current.seconds).toBe(20);
  expect(router.refresh).toHaveBeenCalledOnce();
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(router.refresh).toHaveBeenCalledTimes(2);
});
