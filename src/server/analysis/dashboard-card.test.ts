import { describe, expect, it } from "vitest";
import {
  cardStatus,
  checkPercent,
  type DashboardProject,
  needsFirstCheck,
} from "./dashboard-card";

const FINISHED = new Date("2026-10-22T12:00:00.000Z");

function project(
  latest: DashboardProject["latest"],
  result: DashboardProject["result"] = null,
): DashboardProject {
  return {
    nextCheckAt: null,
    id: "p1",
    name: "shop",
    source: "paste",
    repoUrl: null,
    editable: true,
    latest,
    result,
  };
}

const check = (
  status: NonNullable<DashboardProject["latest"]>["status"],
  checkedPackages = 0,
) => ({ id: "c1", status, totalPackages: 40, checkedPackages });

const result = {
  score: 72,
  vulnerabilityCount: 3,
  severeVulnerableCount: 1,
  finishedAt: FINISHED,
};

describe("cardStatus", () => {
  it("shows progress of a running check, even over an older result", () => {
    expect(cardStatus(project(check("running", 16)))).toEqual({
      kind: "checking",
      percent: 40,
    });
    expect(cardStatus(project(check("running", 10), result))).toEqual({
      kind: "checking",
      percent: 25,
    });
  });

  it("is queued without any finished result", () => {
    expect(cardStatus(project(null))).toEqual({ kind: "queued" });
    expect(cardStatus(project(check("cancelled", 5)))).toEqual({
      kind: "queued",
    });
  });

  it("is failed when the only check failed", () => {
    expect(cardStatus(project(check("failed")))).toEqual({ kind: "failed" });
  });

  it("shows the last result's date, also after a later failure", () => {
    expect(cardStatus(project(check("completed"), result))).toEqual({
      kind: "checked",
      at: FINISHED,
    });
    expect(cardStatus(project(check("failed"), result))).toEqual({
      kind: "checked",
      at: FINISHED,
    });
  });
});

describe("needsFirstCheck", () => {
  it("queues projects that never finished a check", () => {
    expect(needsFirstCheck(project(null))).toBe(true);
    expect(needsFirstCheck(project(check("cancelled")))).toBe(true);
    expect(needsFirstCheck(project(check("running")))).toBe(true);
  });

  it("skips a failed first check and any project with a result", () => {
    expect(needsFirstCheck(project(check("failed")))).toBe(false);
    expect(needsFirstCheck(project(check("cancelled"), result))).toBe(false);
    expect(needsFirstCheck(project(check("running"), result))).toBe(false);
  });
});

describe("checkPercent", () => {
  it("rounds down and stays within 0–100", () => {
    expect(checkPercent(1, 3)).toBe(33);
    expect(checkPercent(0, 0)).toBe(0);
    expect(checkPercent(5, 4)).toBe(100);
  });
});
