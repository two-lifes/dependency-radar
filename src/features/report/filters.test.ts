import { createLoader } from "nuqs";
import { describe, expect, it } from "vitest";
import type { PackageRowJson } from "@/server/check/package-row";
import {
  clearedFilters,
  filterParsers,
  filterRows,
  hasActiveFilters,
  serializeFilters,
  sortingFromUrl,
  sortingToUrl,
  type Filters,
} from "./filters";
import type { ReportRow } from "./report-rows";

const load = createLoader(filterParsers);

const none: Filters = {
  q: "",
  type: null,
  lag: null,
  vuln: null,
  status: null,
  sort: null,
};

const result = (overrides: Partial<PackageRowJson> = {}): PackageRowJson => ({
  checkId: "c1",
  name: "pkg",
  type: "prod",
  specifier: "^1.0.0",
  checked: true,
  reason: null,
  registryName: "pkg",
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

const vulnerability = {
  ids: ["GHSA-1"],
  primaryId: "GHSA-1",
  severity: "high" as const,
  fixedIn: null,
};

const rows: ReportRow[] = [
  { name: "react", type: "prod", result: result() },
  {
    name: "react-dom",
    type: "prod",
    result: result({ lagKind: "major", lagMajors: 2 }),
  },
  {
    name: "eslint",
    type: "dev",
    result: result({ lagKind: "minor", vulnerabilities: [vulnerability] }),
  },
  {
    name: "request",
    type: "prod",
    result: result({ lagKind: "patch", status: "deprecated" }),
  },
  {
    name: "local-lib",
    type: "prod",
    result: result({
      checked: false,
      reason: "not-from-registry",
      lagKind: null,
      status: null,
    }),
  },
  { name: "zod", type: "prod", result: null },
];

const names = (filters: Partial<Filters>) =>
  filterRows(rows, { ...none, ...filters }).map((row) => row.name);

describe("URL filters", () => {
  it("parses every key", () => {
    expect(
      load("?q=re&type=dev&lag=major&vuln=yes&status=unchecked&sort=-vulns"),
    ).toEqual({
      q: "re",
      type: "dev",
      lag: "major",
      vuln: "yes",
      status: "unchecked",
      sort: "-vulns",
    });
  });

  it("treats a missing or unknown value as no filter", () => {
    expect(load("")).toEqual(none);
    expect(
      load("?type=peer&lag=2majors&vuln=maybe&status=gone&sort=size"),
    ).toEqual(none);
  });

  it("doesn't write defaults or cleared values", () => {
    expect(serializeFilters(none)).toBe("");
    expect(serializeFilters({ q: "", lag: "major" })).toBe("?lag=major");
    expect(
      serializeFilters(new URLSearchParams("lag=major&q=re&sort=name"), {
        ...clearedFilters,
      }),
    ).toBe("?sort=name");
  });

  it("adds a filter to the current query and keeps the rest", () => {
    expect(
      serializeFilters(new URLSearchParams("q=re&pkg=react"), {
        status: "unchecked",
      }),
    ).toBe("?q=re&pkg=react&status=unchecked");
  });

  it("knows when anything narrows the rows", () => {
    expect(hasActiveFilters(none)).toBe(false);
    expect(hasActiveFilters({ ...none, q: "  " })).toBe(false);
    expect(hasActiveFilters({ ...none, sort: "-vulns" })).toBe(false);
    expect(hasActiveFilters({ ...none, q: "re" })).toBe(true);
    expect(hasActiveFilters({ ...none, vuln: "no" })).toBe(true);
  });
});

describe("filterRows", () => {
  it("keeps every row without filters, pending ones included", () => {
    expect(names({})).toHaveLength(rows.length);
  });

  it("searches names case-insensitively, pending rows included", () => {
    expect(names({ q: " REACT " })).toEqual(["react", "react-dom"]);
    expect(names({ q: "zo" })).toEqual(["zod"]);
  });

  it("filters by type", () => {
    expect(names({ type: "dev" })).toEqual(["eslint"]);
    expect(names({ type: "prod" })).not.toContain("eslint");
  });

  it("filters by lag, with several majors counting as major", () => {
    expect(names({ lag: "current" })).toEqual(["react"]);
    expect(names({ lag: "major" })).toEqual(["react-dom"]);
    expect(names({ lag: "patch" })).toEqual(["request"]);
  });

  it("filters by vulnerabilities among checked packages", () => {
    expect(names({ vuln: "yes" })).toEqual(["eslint"]);
    expect(names({ vuln: "no" })).toEqual(["react", "react-dom", "request"]);
  });

  it("filters by status, unchecked included", () => {
    expect(names({ status: "deprecated" })).toEqual(["request"]);
    expect(names({ status: "unchecked" })).toEqual(["local-lib"]);
    expect(names({ status: "active" })).toEqual([
      "react",
      "react-dom",
      "eslint",
    ]);
  });

  it("combines filters", () => {
    expect(names({ q: "react", lag: "major" })).toEqual(["react-dom"]);
    expect(names({ type: "dev", vuln: "no" })).toEqual([]);
  });
});

describe("sort in the URL", () => {
  it("maps to TanStack sorting and back", () => {
    expect(sortingFromUrl(null)).toEqual([]);
    expect(sortingFromUrl("behind")).toEqual([{ id: "behind", desc: false }]);
    expect(sortingFromUrl("-vulns")).toEqual([
      { id: "vulnerabilities", desc: true },
    ]);

    expect(sortingToUrl([])).toBeNull();
    expect(sortingToUrl([{ id: "vulnerabilities", desc: true }])).toBe(
      "-vulns",
    );
    expect(sortingToUrl([{ id: "name", desc: false }])).toBe("name");
    expect(sortingToUrl([{ id: "current", desc: false }])).toBeNull();
  });
});
