import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Result } from "@/server/analysis/result";
import type { PackageDetailsError } from "./package-actions";
import type { ReportRow } from "./report-rows";
import { useCheckedLoad } from "./use-checked-load";

const row: ReportRow = {
  name: "react",
  type: "prod",
  result: {
    checkId: "c1",
    name: "react",
    type: "prod",
    specifier: "^19.0.0",
    checked: true,
    reason: null,
    registryName: "react",
    current: "19.0.0",
    latest: "19.0.0",
    lagKind: "current",
    lagMajors: null,
    status: "active",
    deprecationMessage: null,
    lastReleaseAt: null,
    vulnerabilities: [],
    checkedAt: "2026-10-25T10:00:00.000Z",
  },
};
function connect(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  act(() => window.dispatchEvent(new Event(online ? "online" : "offline")));
}
afterEach(() => vi.restoreAllMocks());

it("defers reads offline, then keeps loaded data through reconnects", async () => {
  connect(false);
  const load = vi.fn().mockResolvedValue({ ok: true, value: "Loaded details" });
  const { result } = renderHook(() => useCheckedLoad(load, "r1", row));
  expect(result.current.status).toBe("offline");
  expect(load).not.toHaveBeenCalled();
  connect(true);
  await waitFor(() =>
    expect(result.current).toEqual({ status: "done", value: "Loaded details" }),
  );
  connect(false);
  expect(result.current).toEqual({ status: "done", value: "Loaded details" });
  connect(true);
  expect(load).toHaveBeenCalledOnce();
});

it("ignores an obsolete in-flight response after disconnect and retries the read on reconnect", async () => {
  let finish:
    ((value: Result<string, PackageDetailsError>) => void) | undefined;
  const load = vi.fn(
    () =>
      new Promise<Result<string, PackageDetailsError>>((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useCheckedLoad(load, "r1", row));
  connect(false);
  await act(async () => finish?.({ ok: true, value: "Old response" }));
  expect(result.current.status).toBe("offline");
  connect(true);
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  await act(async () => finish?.({ ok: true, value: "New response" }));
  expect(result.current).toEqual({ status: "done", value: "New response" });
});

it("does not replay a failed read on reconnect; Retry stays guarded offline", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValue({ ok: true, value: "Recovered" });
  const { result } = renderHook(() => useCheckedLoad(load, "r1", row));
  await waitFor(() => expect(result.current.status).toBe("error"));
  connect(false);
  act(() => {
    if (result.current.status === "error") result.current.retry();
  });
  connect(true);
  expect(load).toHaveBeenCalledOnce();
  act(() => {
    if (result.current.status === "error") result.current.retry();
  });
  await waitFor(() =>
    expect(result.current).toEqual({ status: "done", value: "Recovered" }),
  );
});

it("reloads when the report changes even if the package versions are the same", async () => {
  const load = vi.fn().mockResolvedValue({ ok: true, value: "Details" });
  const { result, rerender } = renderHook(
    ({ reportId }) => useCheckedLoad(load, reportId, row),
    { initialProps: { reportId: "r1" } },
  );
  await waitFor(() => expect(result.current.status).toBe("done"));
  rerender({ reportId: "r2" });
  await waitFor(() => expect(load).toHaveBeenCalledWith("r2", "react"));
});
