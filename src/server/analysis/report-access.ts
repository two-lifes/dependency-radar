/** Who owns a report: null `projectId` means a guest report. */
export type ReportOwnership = {
  projectId: string | null;
  ownerId: string | null;
};

/**
 * A guest report is public to anyone with the link; a project's report only
 * to its owner. Callers answer "no access" as "not found" (screens 5.4), so
 * a project's existence isn't revealed.
 */
export function canAccessReport(
  report: ReportOwnership,
  userId: string | null,
): boolean {
  if (report.projectId === null) return true;
  return userId !== null && report.ownerId === userId;
}
