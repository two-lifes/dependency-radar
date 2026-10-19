import { describe, expect, it } from "vitest";
import type { PackageAnalysis } from "./analyze-package";
import { healthScore, scoreBand } from "./health-score";
import type { Vulnerability } from "./merge-vulnerabilities";
import type { PackageFindings } from "./package-findings";
import type { Severity } from "./severity";
import type { Lag } from "./version-lag";

const pkg = (
  lag: Lag["kind"] = "current",
  options: { deprecated?: boolean; vulns?: Severity[] } = {},
): PackageFindings => ({
  analysis: {
    checked: true,
    registryName: "pkg",
    current: "1.0.0",
    latest: "2.0.0",
    lag: lag === "major" ? { kind: "major", majors: 3 } : { kind: lag },
    status: options.deprecated ? "deprecated" : "active",
  } satisfies PackageAnalysis,
  vulnerabilities: (options.vulns ?? []).map(
    (severity, index): Vulnerability => ({
      ids: [`GHSA-${index}`],
      primaryId: `GHSA-${index}`,
      severity,
      fixedIn: null,
    }),
  ),
});

const unchecked: PackageFindings = {
  analysis: { checked: false, reason: "not-from-registry" },
  vulnerabilities: [],
};

const times = (count: number, item: PackageFindings) =>
  Array.from({ length: count }, () => item);

describe("healthScore", () => {
  it("is 100 for a fully up-to-date project", () => {
    const result = healthScore([pkg(), pkg()]);
    expect(result.score).toBe(100);
    expect(result.band).toBe("good");
    expect(result.partial).toBe(false);
  });

  it.each([
    ["major", 6],
    ["minor", 2],
  ] as const)("charges %s lag per package", (lag, penalty) => {
    expect(healthScore([pkg(lag), pkg(lag)]).score).toBe(100 - 2 * penalty);
  });

  it("charges a major lag once regardless of the number of majors", () => {
    expect(healthScore([pkg("major")]).breakdown.major).toEqual({
      count: 1,
      penalty: 6,
      cap: 36,
    });
  });

  it("rounds half-point patch penalties", () => {
    expect(healthScore([pkg("patch")]).score).toBe(100); // 99.5
    expect(healthScore(times(3, pkg("patch"))).score).toBe(99); // 98.5
    expect(healthScore(times(3, pkg("patch"))).breakdown.patch.penalty).toBe(
      1.5,
    );
  });

  it.each([
    ["major", 7, 36],
    ["minor", 9, 16],
    ["patch", 13, 6],
  ] as const)("caps %s lag", (lag, count, cap) => {
    const result = healthScore(times(count, pkg(lag)));
    expect(result.breakdown[lag].penalty).toBe(cap);
    expect(result.score).toBe(100 - cap);
  });

  it("charges deprecated packages with a cap", () => {
    expect(healthScore([pkg("current", { deprecated: true })]).score).toBe(95);
    expect(
      healthScore(times(4, pkg("current", { deprecated: true }))).score,
    ).toBe(85);
  });

  it("charges each vulnerability by severity with one shared cap", () => {
    expect(
      healthScore([pkg("current", { vulns: ["high", "moderate", "low"] })])
        .score,
    ).toBe(85);
    const capped = healthScore([
      pkg("current", { vulns: ["critical", "critical"] }),
      pkg("current", { vulns: ["critical", "high"] }),
    ]);
    expect(capped.breakdown.vulnerabilities).toEqual({
      count: 4,
      penalty: 60,
      cap: 60,
    });
    expect(capped.score).toBe(40);
  });

  it("never drops below 0", () => {
    const result = healthScore([
      ...times(6, pkg("major", { deprecated: true })),
      ...times(8, pkg("minor")),
      ...times(12, pkg("patch")),
      pkg("current", { vulns: ["critical", "critical", "critical"] }),
    ]);
    // 36 + 16 + 6 + 15 + 60 = 133
    expect(result.score).toBe(0);
    expect(result.band).toBe("poor");
  });

  it("leaves unchecked packages out", () => {
    const result = healthScore([pkg("major"), ...times(1, unchecked)]);
    expect(result.score).toBe(94);
  });

  it("marks the score partial above 20% unchecked", () => {
    expect(healthScore([...times(4, pkg()), unchecked]).partial).toBe(false);
    expect(healthScore([...times(3, pkg()), unchecked]).partial).toBe(true);
  });

  it("has no score when nothing was checked", () => {
    expect(healthScore([unchecked])).toMatchObject({
      score: null,
      band: null,
      partial: true,
    });
    expect(healthScore([])).toMatchObject({ score: null, partial: false });
  });

  it("returns the band with the score", () => {
    // 36 + 16 = 52
    const result = healthScore([
      ...times(6, pkg("major")),
      ...times(8, pkg("minor")),
    ]);
    expect(result).toMatchObject({ score: 48, band: "poor" });
  });
});

describe("scoreBand", () => {
  it.each([
    [100, "good"],
    [80, "good"],
    [79, "fair"],
    [50, "fair"],
    [49, "poor"],
    [0, "poor"],
  ] as const)("colors %d as %s", (score, band) => {
    expect(scoreBand(score)).toBe(band);
  });
});
