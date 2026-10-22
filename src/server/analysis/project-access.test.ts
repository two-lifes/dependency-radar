import { describe, expect, it } from "vitest";
import { DEMO_USER } from "../demo/demo-user";
import { newProjectSession, projectAccess } from "./project-access";

const ada = { userId: "u1", sessionId: "s-ada" };
const demoA = { userId: DEMO_USER.id, sessionId: "s-a" };
const demoB = { userId: DEMO_USER.id, sessionId: "s-b" };

const adaProject = { ownerId: "u1", demoSessionId: null };
const seeded = { ownerId: DEMO_USER.id, demoSessionId: null };
const demoAProject = { ownerId: DEMO_USER.id, demoSessionId: "s-a" };

describe("projectAccess", () => {
  it("gives the owner full access and nobody else any", () => {
    expect(projectAccess(adaProject, ada)).toBe("write");
    expect(projectAccess(adaProject, { userId: "u2", sessionId: "s" })).toBe(
      "none",
    );
    expect(projectAccess(adaProject, null)).toBe("none");
  });

  it("opens seeded demo projects to every demo session read-only", () => {
    expect(projectAccess(seeded, demoA)).toBe("read");
    expect(projectAccess(seeded, demoB)).toBe("read");
    expect(projectAccess(seeded, ada)).toBe("none");
  });

  it("keeps a demo session's project to that session", () => {
    expect(projectAccess(demoAProject, demoA)).toBe("write");
    expect(projectAccess(demoAProject, demoB)).toBe("none");
  });

  it("doesn't let a real user's session id open a demo project", () => {
    expect(
      projectAccess(demoAProject, { userId: "u1", sessionId: "s-a" }),
    ).toBe("none");
  });
});

describe("newProjectSession", () => {
  it("ties a new project to the demo session only", () => {
    expect(newProjectSession(demoA)).toBe("s-a");
    expect(newProjectSession(ada)).toBeNull();
  });
});
