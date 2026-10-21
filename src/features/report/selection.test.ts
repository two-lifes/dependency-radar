import { describe, expect, it } from "vitest";
import type { PackageRowJson } from "@/server/check/package-row";
import type { ReportRow } from "./report-rows";
import {
  headerState,
  majorUpdates,
  pruneSelection,
  selectionCommand,
} from "./selection";

const result = (overrides: Partial<PackageRowJson> = {}): PackageRowJson => ({
  checkId: "c1",
  name: "pkg",
  type: "prod",
  specifier: "^1.0.0",
  checked: true,
  reason: null,
  registryName: "pkg",
  current: "1.0.0",
  latest: "2.0.0",
  lagKind: "major",
  lagMajors: 1,
  status: "active",
  deprecationMessage: null,
  lastReleaseAt: null,
  vulnerabilities: [],
  checkedAt: "2026-10-20T10:00:00.000Z",
  ...overrides,
});

const row = (
  name: string,
  overrides: Partial<PackageRowJson> | null = {},
  type: ReportRow["type"] = "prod",
): ReportRow => ({
  name,
  type,
  result:
    overrides === null
      ? null
      : result({ name, registryName: name, type, ...overrides }),
});

describe("majorUpdates", () => {
  it("names only the rows the command moves across a major, in order", () => {
    expect(
      majorUpdates([
        row("react"),
        row("zod", { lagKind: "patch", latest: "1.0.1" }),
        row("pending", null),
        row("eslint", {}, "dev"),
        row("next", { lagKind: "major", lagMajors: 2, latest: "3.0.0" }),
        row("up", { lagKind: "current", latest: "1.0.0" }),
        row("local", { checked: false, latest: null, lagKind: null }),
      ]),
    ).toEqual(["react", "eslint", "next"]);
  });
});

describe("pruneSelection", () => {
  it("drops names that are no longer visible", () => {
    expect(pruneSelection(new Set(["a", "b", "c"]), ["a", "c", "d"])).toEqual(
      new Set(["a", "c"]),
    );
  });

  it("keeps the same set when nothing was hidden", () => {
    const selected = new Set(["a"]);
    expect(pruneSelection(selected, ["a", "b"])).toBe(selected);
  });
});

describe("headerState", () => {
  it.each([
    [[], ["a", "b"], false],
    [["a"], ["a", "b"], "indeterminate"],
    [["a", "b"], ["a", "b"], true],
    [[], [], false],
  ] as const)("selected %j of %j → %j", (selected, visible, expected) => {
    expect(headerState(new Set(selected), visible)).toBe(expected);
  });
});

describe("selectionCommand", () => {
  it("joins the prod and dev commands with &&", () => {
    expect(
      selectionCommand(
        [
          row("react", { latest: "19.1.0" }),
          row("vitest", { latest: "3.2.0" }, "dev"),
          row("react-dom", { latest: "19.1.0" }),
        ],
        "npm",
      ),
    ).toBe("npm i react@19.1.0 react-dom@19.1.0 && npm i -D vitest@3.2.0");
  });

  it("uses the report's package manager", () => {
    const rows = [row("vitest", { latest: "3.2.0" }, "dev")];
    expect(selectionCommand(rows, "pnpm")).toBe("pnpm add -D vitest@3.2.0");
    expect(selectionCommand(rows, "yarn")).toBe("yarn add -D vitest@3.2.0");
  });

  it("keeps an npm: alias an alias", () => {
    expect(
      selectionCommand([row("lodash4", { registryName: "lodash" })], "npm"),
    ).toBe("npm i lodash4@npm:lodash@2.0.0");
  });

  it("skips rows that are up to date, pending or not checked", () => {
    expect(
      selectionCommand(
        [
          row("zod", { lagKind: "current", latest: "1.0.0" }),
          row("pending", null),
          row("local", {
            checked: false,
            reason: "not-from-registry",
            registryName: null,
            latest: null,
            lagKind: null,
          }),
          row("react"),
        ],
        "npm",
      ),
    ).toBe("npm i react@2.0.0");
  });

  it("is null when no selected row has an update", () => {
    expect(
      selectionCommand([row("zod", { lagKind: "current" })], "npm"),
    ).toBeNull();
    expect(selectionCommand([], "npm")).toBeNull();
  });
});
