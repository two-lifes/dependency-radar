import { describe, expect, it } from "vitest";
import type { PackageRowJson } from "@/server/check/package-row";
import { buildRows, reduceStream, type StreamState } from "./report-rows";

const row = (name: string, latest = "2.0.0"): PackageRowJson => ({
  checkId: "c1",
  name,
  type: "prod",
  specifier: "^1.0.0",
  checked: true,
  reason: null,
  registryName: name,
  current: "1.0.0",
  latest,
  lagKind: "major",
  lagMajors: 1,
  status: "active",
  deprecationMessage: null,
  lastReleaseAt: null,
  vulnerabilities: [],
  checkedAt: "2026-10-20T10:00:00.000Z",
});

const dependencies = [
  { name: "b", specifier: "^1.0.0", type: "prod" as const },
  { name: "a", specifier: "^1.0.0", type: "dev" as const },
  { name: "c", specifier: "^1.0.0", type: "prod" as const },
];

describe("buildRows", () => {
  it("keeps package.json order and marks rows without a result pending", () => {
    const rows = buildRows(dependencies, {
      previous: [],
      current: [row("a")],
      streamed: {},
    });

    expect(rows.map((r) => [r.name, r.type, r.result?.name ?? null])).toEqual([
      ["b", "prod", null],
      ["a", "dev", "a"],
      ["c", "prod", null],
    ]);
    expect(rows[1]?.updatedAt).toBeUndefined();
  });

  it("shows the previous check until the new one replaces a row", () => {
    const rows = buildRows(dependencies, {
      previous: [row("a", "1.5.0"), row("b", "1.5.0")],
      current: [row("a", "3.0.0")],
      streamed: { b: { row: row("b", "4.0.0"), at: 42 } },
    });

    expect(rows.map((r) => r.result?.latest ?? null)).toEqual([
      "4.0.0",
      "3.0.0",
      null,
    ]);
    expect(rows[0]?.updatedAt).toBe(42);
  });
});

describe("reduceStream", () => {
  const initial: StreamState = {
    checked: 1,
    total: 3,
    streamed: {},
    connection: "live",
  };

  it("tracks progress and streamed packages", () => {
    let state = reduceStream(initial, {
      type: "event",
      event: { type: "progress", checked: 2, total: 3 },
      at: 1,
    });
    state = reduceStream(state, {
      type: "event",
      event: { type: "package", package: row("c") },
      at: 5,
    });

    expect(state.checked).toBe(2);
    expect(state.streamed.c).toEqual({ row: row("c"), at: 5 });
  });

  it("ends on done and breaks on error", () => {
    const done = reduceStream(initial, {
      type: "event",
      event: {
        type: "done",
        status: "completed",
        failureReason: null,
        retryAt: null,
      },
      at: 1,
    });
    expect(done.connection).toBe("done");
    // A late connection error must not turn a finished check into "lost".
    expect(reduceStream(done, { type: "lost" }).connection).toBe("done");

    const broken = reduceStream(initial, {
      type: "event",
      event: { type: "error" },
      at: 1,
    });
    expect(broken.connection).toBe("lost");
    expect(reduceStream(broken, { type: "reconnect" }).connection).toBe("live");
  });
});
