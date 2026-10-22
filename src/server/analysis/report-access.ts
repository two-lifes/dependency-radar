import { projectAccess, type Viewer } from "./project-access";

/** Who owns a report: null `projectId` means a guest report. */
export type ReportOwnership = {
  projectId: string | null;
  ownerId: string | null;
  demoSessionId: string | null;
};

/**
 * A guest report is public to anyone with the link; a project's report to
 * whoever may see the project (`projectAccess`). Callers answer "no access"
 * as "not found" (screens 5.4), so a project's existence isn't revealed.
 */
export function canAccessReport(
  report: ReportOwnership,
  viewer: Viewer | null,
): boolean {
  if (report.projectId === null) return true;
  if (report.ownerId === null) return false;
  return (
    projectAccess(
      { ownerId: report.ownerId, demoSessionId: report.demoSessionId },
      viewer,
    ) !== "none"
  );
}
