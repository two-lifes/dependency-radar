import { describe, expect, it } from "vitest";
import type { PackageFindings } from "./package-findings";
import { reportCounts } from "./report-counts";
import type { Severity } from "./severity";
import type { Lag } from "./version-lag";

const pkg = (lag: Lag["kind"], vulns: Severity[] = []): PackageFindings => ({
  analysis: {
    checked: true,
    registryName: "pkg",
    current: "1.0.0",
    latest: "2.0.0",
    lag: lag === "major" ? { kind: "major", majors: 2 } : { kind: lag },
    status: "active",
  },
  vulnerabilities: vulns.map((severity, index) => ({
    ids: [`GHSA-${index}`],
    primaryId: `GHSA-${index}`,
    severity,
    fixedIn: null,
  })),
});

const unchecked: PackageFindings = {
  analysis: { checked: false, reason: "no-matching-version" },
  vulnerabilities: [],
};

describe("reportCounts", () => {
  it("counts the summary tiles and tab totals", () => {
    expect(
      reportCounts([
        pkg("current"),
        pkg("current", ["low"]),
        pkg("patch"),
        pkg("minor", ["moderate", "critical"]),
        pkg("major", ["high", "high", "low"]),
        pkg("major"),
        unchecked,
      ]),
    ).toEqual({
      upToDate: 2,
      patch: 1,
      minor: 1,
      major: 2,
      vulnerable: 3,
      vulnerableBySeverity: { critical: 1, high: 1, moderate: 0, low: 1 },
      dependencies: 7,
      vulnerabilities: 6,
    });
  });

  it("returns zeros for an empty report", () => {
    expect(reportCounts([])).toEqual({
      upToDate: 0,
      patch: 0,
      minor: 0,
      major: 0,
      vulnerable: 0,
      vulnerableBySeverity: { critical: 0, high: 0, moderate: 0, low: 0 },
      dependencies: 0,
      vulnerabilities: 0,
    });
  });
});
