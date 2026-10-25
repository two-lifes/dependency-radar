import { isDemoUser } from "../demo/demo-user";

/**
 * Who is asking: the session id comes from the session cookie on the server,
 * never from the request body, so a visitor can't claim another session.
 */
export type Viewer = { userId: string; sessionId: string };

export type ProjectOwnership = {
  ownerId: string;
  /** See `projects.demoSessionId`. */
  demoSessionId: string | null;
};

export type ProjectAccess = "none" | "read" | "write";

/**
 * Demo access is closed, including historical session-owned projects.
 * `src/server/db/project-access.ts` is the same rule in SQL.
 */
export function projectAccess(
  project: ProjectOwnership,
  viewer: Viewer | null,
): ProjectAccess {
  if (viewer === null || project.ownerId !== viewer.userId) return "none";
  return isDemoUser(viewer.userId) ? "none" : "write";
}

/** The session a new project belongs to: only demo projects have one. */
export function newProjectSession(viewer: Viewer): string | null {
  if (isDemoUser(viewer.userId)) throw new Error("Demo access is closed");
  return null;
}
