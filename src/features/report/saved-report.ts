import type { SaveReportOutcome } from "@/server/db/projects";

/** `?saved=1` asks the project's report for the "Project saved" toast. */
export const SAVED_PARAM = "saved";

/**
 * Where "Save project" lands (screens 5.4): the project. Otherwise back to
 * the guest report, which shows "This report has expired." or the 404 page
 * (someone else saved it) by itself.
 */
export function savedReportPath(
  reportId: string,
  outcome: SaveReportOutcome,
): string {
  return outcome.kind === "saved"
    ? `/projects/${outcome.projectId}/dependencies?${SAVED_PARAM}=1`
    : `/r/${encodeURIComponent(reportId)}/dependencies`;
}
