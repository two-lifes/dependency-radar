import { describe, expect, it } from "vitest";
import type { PackageAnalysis } from "../analysis/analyze-package";
import type { Vulnerability } from "../analysis/merge-vulnerabilities";
import {
  buildPackageRow,
  rowToFindings,
  toPackageRowJson,
} from "./package-row";

const checkedAt = new Date("2026-10-20T10:00:00.000Z");
const dependency = {
  name: "react",
  specifier: "^18.2.0",
  type: "prod" as const,
};

const vulnerability: Vulnerability = {
  ids: ["GHSA-xxxx", "CVE-2026-1"],
  primaryId: "GHSA-xxxx",
  severity: "high",
  fixedIn: "18.3.1",
};

const build = (
  analysis: PackageAnalysis,
  vulnerabilities: Vulnerability[] = [],
) =>
  buildPackageRow({
    checkId: "c1",
    dependency,
    analysis,
    vulnerabilities,
    checkedAt,
  });

describe("buildPackageRow / rowToFindings", () => {
  it("round-trips a checked major-behind package", () => {
    const analysis: PackageAnalysis = {
      checked: true,
      registryName: "react",
      current: "18.2.0",
      latest: "20.1.0",
      lag: { kind: "major", majors: 2 },
      status: "deprecated",
      deprecationMessage: "moved",
      lastReleaseAt: "2026-01-01T00:00:00.000Z",
    };
    const row = build(analysis, [vulnerability]);

    expect(row).toMatchObject({
      checked: true,
      reason: null,
      lagKind: "major",
      lagMajors: 2,
      lastReleaseAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(rowToFindings(row)).toEqual({
      analysis,
      vulnerabilities: [vulnerability],
    });
  });

  it("round-trips a checked package without optional fields", () => {
    const analysis: PackageAnalysis = {
      checked: true,
      registryName: "react",
      current: "18.2.0",
      latest: "18.2.0",
      lag: { kind: "current" },
      status: "active",
    };
    const row = build(analysis);

    expect(row.lagMajors).toBeNull();
    expect(row.deprecationMessage).toBeNull();
    expect(rowToFindings(row)).toEqual({ analysis, vulnerabilities: [] });
  });

  it("round-trips an unchecked package and drops vulnerabilities", () => {
    const row = build({ checked: false, reason: "registry-unavailable" }, [
      vulnerability,
    ]);

    expect(row).toMatchObject({ checked: false, current: null });
    expect(row.vulnerabilities).toEqual([]);
    expect(rowToFindings(row)).toEqual({
      analysis: { checked: false, reason: "registry-unavailable" },
      vulnerabilities: [],
    });
  });

  it("throws on a checked row with missing fields", () => {
    const row = {
      ...build({
        checked: true,
        registryName: "react",
        current: "1.0.0",
        latest: "1.0.0",
        lag: { kind: "current" },
        status: "active",
      }),
      latest: null,
    };
    expect(() => rowToFindings(row)).toThrow(/no latest/);
  });
});

describe("toPackageRowJson", () => {
  it("turns dates into ISO strings", () => {
    const row = build({ checked: false, reason: "not-from-registry" });
    const json = toPackageRowJson(row);
    expect(json.checkedAt).toBe("2026-10-20T10:00:00.000Z");
    expect(json.lastReleaseAt).toBeNull();
  });
});
