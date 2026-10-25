import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { networkCopy } from "../system/network-copy";
import { useReportAction } from "./use-report-action";

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

it("blocks direct calls offline and never replays a mutation on reconnect", async () => {
  const action = vi.fn().mockResolvedValue({});
  const { result } = renderHook(useReportAction);
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  act(() => result.current[1](action));
  expect(action).not.toHaveBeenCalled();
  online.mockReturnValue(true);
  act(() => window.dispatchEvent(new Event("online")));
  expect(action).not.toHaveBeenCalled();
  act(() => result.current[1](action));
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
});

it("turns a rejected request into a persistent error and clears it after manual retry", async () => {
  const action = vi
    .fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValue({});
  const { result } = renderHook(useReportAction);
  act(() => result.current[1](action));
  await waitFor(() => expect(result.current[2]).toBe(networkCopy.failed));
  expect(result.current[0]).toBe(false);
  act(() => result.current[1](action));
  await waitFor(() => expect(result.current[2]).toBeUndefined());
  expect(action).toHaveBeenCalledTimes(2);
});
