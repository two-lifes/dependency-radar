import { describe, expect, it } from "vitest";
import { isSourceFailure } from "../analysis/check-outcome";
import { healthScore } from "../analysis/health-score";
import { reportCounts } from "../analysis/report-counts";
import { rowToFindings } from "../check/package-row";
import { checkSnapshot } from "../check/run-check";
import { buildDemoProjects, demoPackageRows } from "./demo-data";

const now = new Date("2026-10-22T12:00:00Z");

function project(name: string) {
  const found = buildDemoProjects(now).find((p) => p.name === name);
  if (!found) throw new Error(`No demo project ${name}`);
  const rows = demoPackageRows(found, "check-1");
  const findings = rows.map(rowToFindings);
  return {
    project: found,
    rows,
    score: healthScore(findings),
    counts: reportCounts(findings),
    snapshot: checkSnapshot(rows, { now }),
  };
}

describe("buildDemoProjects", () => {
  it("has the four projects of screens 7", () => {
    expect(buildDemoProjects(now).map((p) => p.name)).toEqual([
      "shop-frontend",
      "admin-dashboard",
      "marketing-site",
      "legacy-widget",
    ]);
  });

  it("adds them in that order, so the dashboard lists them so", () => {
    const created = buildDemoProjects(now).map((p) => p.createdAt.getTime());
    expect(created).toEqual([...created].sort((a, b) => a - b));
  });

  it("makes shop-frontend a poor report with 2 critical vulnerabilities", () => {
    const { score, counts, rows } = project("shop-frontend");
    expect(score.score).toBeGreaterThanOrEqual(40);
    expect(score.score).toBeLessThanOrEqual(50);
    expect(counts.vulnerableBySeverity.critical).toBe(2);
    for (const name of ["react", "next"]) {
      expect(rows.find((row) => row.name === name)?.lagKind).toBe("major");
    }
  });

  it("makes admin-dashboard a fair report", () => {
    const { score } = project("admin-dashboard");
    expect(score.score).toBeGreaterThanOrEqual(70);
    expect(score.score).toBeLessThanOrEqual(80);
  });

  it("keeps marketing-site nearly up to date", () => {
    expect(project("marketing-site").score.score).toBeGreaterThanOrEqual(95);
  });

  it("makes legacy-widget partial with 5 unchecked and deprecated packages", () => {
    const { rows, score, snapshot } = project("legacy-widget");
    // Only source failures count as "couldn't be checked" in the report.
    expect(rows.filter((row) => isSourceFailure(row.reason))).toHaveLength(5);
    expect(rows.filter((row) => !row.checked)).toHaveLength(5);
    expect(rows.some((row) => row.status === "deprecated")).toBe(true);
    expect(score.partial).toBe(true);
    expect(snapshot.status).toBe("partial");
  });

  it("finishes the other projects as completed checks", () => {
    for (const name of ["shop-frontend", "admin-dashboard", "marketing-site"]) {
      expect(project(name).snapshot.status).toBe("completed");
    }
  });

  it("locks every checked package to its current version", () => {
    const { project: legacy, rows } = project("legacy-widget");
    for (const row of rows.filter((r) => r.checked)) {
      expect(legacy.lockedVersions[row.name]).toEqual({ version: row.current });
    }
    expect(legacy.lockedVersions["backbone"]).toBeUndefined();
  });
});
