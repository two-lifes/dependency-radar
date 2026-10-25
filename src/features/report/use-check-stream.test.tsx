import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamState } from "./report-rows";
import { FakeEventSource } from "./test/fake-event-source";
import { useCheckStream } from "./use-check-stream";

const initial: StreamState = {
  checked: 0,
  total: 2,
  streamed: {},
  connection: "live",
};

const row = {
  checkId: "c1",
  name: "react",
  type: "prod",
  specifier: "^18.0.0",
  checked: true,
  reason: null,
  registryName: "react",
  current: "18.2.0",
  latest: "19.1.0",
  lagKind: "major",
  lagMajors: 1,
  status: "active",
  deprecationMessage: null,
  lastReleaseAt: null,
  vulnerabilities: [],
  checkedAt: "2026-10-20T10:00:00.000Z",
};

const open = async () => {
  await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
  const [source] = FakeEventSource.instances;
  if (!source) throw new Error("no EventSource");
  return source;
};

describe("useCheckStream", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const renderStream = (onDone = vi.fn(), running = true) =>
    renderHook(
      () => useCheckStream({ checkId: "c1", running, initial, onDone }),
      { wrapper: StrictMode },
    );

  it("waits for connection before opening and preserves the existing stream across offline events", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderStream();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(FakeEventSource.instances).toHaveLength(0);
    act(() => result.current.retry());
    expect(FakeEventSource.instances).toHaveLength(0);
    online.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event("online")));
    const source = await open();
    source.send("progress", { checked: 1, total: 2 });
    online.mockReturnValue(false);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(source.closed).toBe(false);
    expect(result.current.state.checked).toBe(1);
    online.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event("online")));
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("opens one stream even under StrictMode and applies events", async () => {
    const { result } = renderStream();
    const source = await open();

    expect(source.url).toBe("/api/checks/c1/events");
    source.send("progress", { checked: 1, total: 2 });
    source.send("package", { package: row });

    expect(result.current.state.checked).toBe(1);
    expect(result.current.state.streamed.react?.row).toEqual(row);
  });

  it("doesn't open a stream for a finished check", async () => {
    renderStream(vi.fn(), false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("treats a reconnect as normal and a closed stream as lost", async () => {
    const { result } = renderStream();
    const source = await open();

    source.fail(false);
    expect(result.current.state.connection).toBe("live");

    source.fail(true);
    expect(result.current.state.connection).toBe("lost");

    act(() => result.current.retry());
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(2));
    expect(result.current.state.connection).toBe("live");
    expect(source.closed).toBe(true);
  });

  it("closes and reloads on done", async () => {
    const onDone = vi.fn();
    const { result } = renderStream(onDone);
    const source = await open();

    source.send("done", {
      status: "completed",
      failureReason: null,
      retryAt: null,
    });

    expect(source.closed).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.state.connection).toBe("done");
  });

  it("stops on the server's error event", async () => {
    const { result } = renderStream();
    const source = await open();

    source.send("error", {});

    expect(source.closed).toBe(true);
    expect(result.current.state.connection).toBe("lost");
  });

  it("closes the stream on unmount", async () => {
    const { unmount } = renderStream();
    const source = await open();

    unmount();

    expect(source.closed).toBe(true);
  });
});
