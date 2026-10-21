import { describe, expect, it } from "vitest";
import type { Severity } from "@/server/analysis/severity";
import type { PackageRowJson } from "@/server/check/package-row";
import type { ReportRow } from "./report-rows";
import {
  compareVulnerabilityRank,
  defaultOrder,
  lagRank,
  releasedAt,
  vulnerabilityRank,
} from "./row-order";

const result = (
  name: string,
  overrides: Partial<PackageRowJson> = {},
): PackageRowJson => ({
  checkId: "c1",
  name,
  type: "prod",
  specifier: "^1.0.0",
  checked: true,
  reason: null,
  registryName: name,
  current: "1.0.0",
  latest: "1.0.0",
  lagKind: "current",
  lagMajors: null,
  status: "active",
  deprecationMessage: null,
  lastReleaseAt: null,
  vulnerabilities: [],
  checkedAt: "2026-10-20T10:00:00.000Z",
  ...overrides,
});

const row = (
  name: string,
  overrides?: Partial<PackageRowJson> | null,
): ReportRow => ({
  name,
  type: "prod",
  result: overrides === null ? null : result(name, overrides),
});

const vuln = (severity: Severity) => ({
  ids: [`GHSA-${severity}`],
  primaryId: `GHSA-${severity}`,
  severity,
  fixedIn: null,
});

const unchecked = (name: string) =>
  row(name, {
    checked: false,
    reason: "not-from-registry",
    lagKind: null,
    status: null,
    current: null,
    latest: null,
  });

describe("lagRank", () => {
  it("orders current < patch < minor < major < N majors", () => {
    const ranks = [
      row("a"),
      row("b", { lagKind: "patch" }),
      row("c", { lagKind: "minor" }),
      row("d", { lagKind: "major", lagMajors: 1 }),
      row("e", { lagKind: "major", lagMajors: 3 }),
    ].map(lagRank);
    expect(ranks).toEqual([...ranks].sort((x, y) => (x ?? 0) - (y ?? 0)));
    expect(new Set(ranks).size).toBe(5);
  });

  it("has no rank for pending or unchecked rows", () => {
    expect(lagRank(row("a", null))).toBeUndefined();
    expect(lagRank(unchecked("a"))).toBeUndefined();
  });
});

describe("vulnerabilityRank", () => {
  it("puts the highest severity before the count", () => {
    const oneCritical = vulnerabilityRank(
      row("a", { vulnerabilities: [vuln("critical")] }),
    );
    const threeHigh = vulnerabilityRank(
      row("b", {
        vulnerabilities: [vuln("high"), vuln("high"), vuln("low")],
      }),
    );
    const none = vulnerabilityRank(row("c"));
    if (!oneCritical || !threeHigh || !none) throw new Error("no rank");
    expect(compareVulnerabilityRank(oneCritical, threeHigh)).toBeGreaterThan(0);
    expect(compareVulnerabilityRank(threeHigh, none)).toBeGreaterThan(0);
  });

  it("breaks a severity tie by count", () => {
    const one = vulnerabilityRank(
      row("a", { vulnerabilities: [vuln("high")] }),
    );
    const two = vulnerabilityRank(
      row("b", { vulnerabilities: [vuln("high"), vuln("low")] }),
    );
    if (!one || !two) throw new Error("no rank");
    expect(compareVulnerabilityRank(two, one)).toBeGreaterThan(0);
  });

  it("has no rank for unchecked rows", () => {
    expect(vulnerabilityRank(unchecked("a"))).toBeUndefined();
  });
});

describe("releasedAt", () => {
  it("is undefined without a release date", () => {
    expect(releasedAt(row("a"))).toBeUndefined();
    expect(
      releasedAt(row("a", { lastReleaseAt: "2026-01-01T00:00:00.000Z" })),
    ).toBe(Date.UTC(2026, 0, 1));
  });
});

describe("defaultOrder", () => {
  it("puts vulnerable first, then the furthest behind, then by name", () => {
    const rows = [
      row("zod", { lagKind: "patch" }),
      unchecked("local-lib"),
      row("pending", null),
      row("react", { lagKind: "major", lagMajors: 1 }),
      row("lodash", { vulnerabilities: [vuln("moderate")] }),
      row("axios", { lagKind: "minor", vulnerabilities: [vuln("critical")] }),
      row("next", { lagKind: "major", lagMajors: 2 }),
      row("clsx"),
      row("ajv", { lagKind: "patch" }),
    ];
    expect(defaultOrder(rows).map((r) => r.name)).toEqual([
      "axios",
      "lodash",
      "next",
      "react",
      "ajv",
      "zod",
      "clsx",
      // No data: package.json order.
      "local-lib",
      "pending",
    ]);
  });

  it("does not mutate its input", () => {
    const rows = [row("b"), row("a")];
    defaultOrder(rows);
    expect(rows.map((r) => r.name)).toEqual(["b", "a"]);
  });
});
