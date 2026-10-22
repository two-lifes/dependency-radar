import { describe, expect, it } from "vitest";
import { canAccessReport } from "./report-access";

const guestReport = { projectId: null, ownerId: null };
const projectReport = { projectId: "p1", ownerId: "u1" };

describe("canAccessReport", () => {
  it("opens a guest report to everyone", () => {
    expect(canAccessReport(guestReport, null)).toBe(true);
    expect(canAccessReport(guestReport, "u2")).toBe(true);
  });

  it("opens a project's report to its owner only", () => {
    expect(canAccessReport(projectReport, "u1")).toBe(true);
    expect(canAccessReport(projectReport, "u2")).toBe(false);
  });

  it("closes a project's report to a guest", () => {
    expect(canAccessReport(projectReport, null)).toBe(false);
  });
});
