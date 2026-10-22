import { describe, expect, it } from "vitest";
import type { PackageAnalysis } from "../analysis/analyze-package";
import { buildPackageRow } from "./package-row";
import {
  isReportExpired,
  pickChecks,
  previousRowsFor,
  summarizeRows,
} from "./report-view";

const now = new Date("2026-10-20T12:00:00Z");

describe("isReportExpired", () => {
  it("never expires a project report", () => {
    expect(isReportExpired(null, now)).toBe(false);
  });

  it("expires at the exact moment and after", () => {
    expect(isReportExpired(new Date(now.getTime() + 1), now)).toBe(false);
    expect(isReportExpired(now, now)).toBe(true);
  });
});

describe("pickChecks", () => {
  it("has nothing for a report without checks", () => {
    expect(pickChecks([])).toEqual({ latest: undefined, previous: undefined });
  });

  it("keeps the previous check only while the latest runs", () => {
    const running = { id: "b", status: "running" };
    const done = { id: "a", status: "completed" };

    expect(pickChecks([running, done])).toEqual({
      latest: running,
      previous: done,
    });
    expect(pickChecks([{ id: "c", status: "partial" }, done])).toEqual({
      latest: { id: "c", status: "partial" },
      previous: undefined,
    });
  });
});

describe("summarizeRows", () => {
  const row = (name: string, analysis: PackageAnalysis) =>
    buildPackageRow({
      checkId: "c1",
      dependency: { name, specifier: "^1.0.0", type: "prod" },
      analysis,
      vulnerabilities: [],
      checkedAt: now,
    });
  const checked: PackageAnalysis = {
    checked: true,
    registryName: "a",
    current: "1.0.0",
    latest: "2.0.0",
    lag: { kind: "major", majors: 1 },
    status: "active",
  };

  it("counts every dependency and only source failures as failed", () => {
    const summary = summarizeRows(
      [
        row("a", checked),
        row("b", { checked: false, reason: "registry-unavailable" }),
        row("c", { checked: false, reason: "not-from-registry" }),
      ],
      5,
    );

    expect(summary.counts.dependencies).toBe(5);
    expect(summary.counts.major).toBe(1);
    expect(summary.sourceFailures).toBe(1);
    expect(summary.score.score).toBe(94);
  });
});

describe("previousRowsFor", () => {
  const rows = [{ name: "react" }, { name: "left-pad" }, { name: "zod" }];

  it("drops packages no longer in the report input", () => {
    expect(
      previousRowsFor(rows, [
        { name: "zod" },
        { name: "react" },
        { name: "vite" },
      ]),
    ).toEqual([{ name: "react" }, { name: "zod" }]);
  });

  it("keeps nothing for an empty input", () => {
    expect(previousRowsFor(rows, [])).toEqual([]);
  });
});
