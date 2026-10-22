import { describe, expect, it } from "vitest";
import { DEMO_USER } from "../demo/demo-user";
import { canAccessReport } from "./report-access";

const guestReport = { projectId: null, ownerId: null, demoSessionId: null };
const projectReport = { projectId: "p1", ownerId: "u1", demoSessionId: null };
const ada = { userId: "u1", sessionId: "s1" };

describe("canAccessReport", () => {
  it("opens a guest report to everyone", () => {
    expect(canAccessReport(guestReport, null)).toBe(true);
    expect(
      canAccessReport(guestReport, { userId: "u2", sessionId: "s2" }),
    ).toBe(true);
  });

  it("opens a project's report to its owner only", () => {
    expect(canAccessReport(projectReport, ada)).toBe(true);
    expect(
      canAccessReport(projectReport, { userId: "u2", sessionId: "s2" }),
    ).toBe(false);
  });

  it("closes a project's report to a guest", () => {
    expect(canAccessReport(projectReport, null)).toBe(false);
  });

  it("follows the demo rule: seeded to all sessions, own to one", () => {
    const seeded = {
      projectId: "p2",
      ownerId: DEMO_USER.id,
      demoSessionId: null,
    };
    const ofA = { ...seeded, demoSessionId: "s-a" };
    const demoA = { userId: DEMO_USER.id, sessionId: "s-a" };
    const demoB = { userId: DEMO_USER.id, sessionId: "s-b" };
    expect(canAccessReport(seeded, demoB)).toBe(true);
    expect(canAccessReport(ofA, demoA)).toBe(true);
    expect(canAccessReport(ofA, demoB)).toBe(false);
  });
});
