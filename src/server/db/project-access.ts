import { eq, type SQL, sql } from "drizzle-orm";
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
  return never;
}

/**
 * `projectAccess(…) === "write"` as a WHERE condition. Old demo sessions
 * cannot mutate either shared or session-owned projects.
 */
export function editableProjects(viewer: Viewer): SQL {
  const owned = eq(projects.ownerId, viewer.userId);
  if (!isDemoUser(viewer.userId)) return owned;
  return never;
}
