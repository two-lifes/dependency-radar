import { and, eq, isNull, or, type SQL, sql } from "drizzle-orm";
import type { Viewer } from "../analysis/project-access";
import { isDemoUser } from "../demo/demo-user";
import { projects } from "./schema";

// `and`/`or` of defined conditions are never undefined; `false` keeps the
// type honest and fails closed.
const never = sql`false`;

/** `projectAccess(…) !== "none"` as a WHERE condition. */
export function visibleProjects(viewer: Viewer): SQL {
  const owned = eq(projects.ownerId, viewer.userId);
  if (!isDemoUser(viewer.userId)) return owned;
  return (
    and(
      owned,
      or(
        isNull(projects.demoSessionId),
        eq(projects.demoSessionId, viewer.sessionId),
      ),
    ) ?? never
  );
}

/**
 * `projectAccess(…) === "write"` as a WHERE condition. For the demo it is
 * `demo_session_id = <this session>`, never `IS NULL`, so no demo session can
 * change the seeded projects or another session's.
 */
export function editableProjects(viewer: Viewer): SQL {
  const owned = eq(projects.ownerId, viewer.userId);
  if (!isDemoUser(viewer.userId)) return owned;
  return and(owned, eq(projects.demoSessionId, viewer.sessionId)) ?? never;
}
