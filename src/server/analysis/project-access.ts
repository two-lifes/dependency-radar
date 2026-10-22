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
 * The one access rule for projects (plan.md 26.1). Everyone but the demo owns
 * their projects outright. Demo sessions share one user: the seeded projects
 * are open to all of them read-only (checks still run), and a project a
 * session created is its own and nobody else's. `src/server/db/project-access.ts`
 * is the same rule in SQL.
 */
export function projectAccess(
  project: ProjectOwnership,
  viewer: Viewer | null,
): ProjectAccess {
  if (viewer === null || project.ownerId !== viewer.userId) return "none";
  if (!isDemoUser(viewer.userId)) return "write";
  if (project.demoSessionId === null) return "read";
  return project.demoSessionId === viewer.sessionId ? "write" : "none";
}

/** The session a new project belongs to: only demo projects have one. */
export function newProjectSession(viewer: Viewer): string | null {
  return isDemoUser(viewer.userId) ? viewer.sessionId : null;
}
