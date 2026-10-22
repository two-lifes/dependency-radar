import {
  canAccessReport,
  type ReportOwnership,
} from "./analysis/report-access";
import { getOptionalSession, viewerOf } from "./auth/session";

/**
 * `canAccessReport` for the current visitor. Every way into a report goes
 * through it (pages, actions, the check stream): someone else's project reads
 * as a missing report (decisions 45).
 */
export async function canOpenReport(report: ReportOwnership): Promise<boolean> {
  // A guest report needs no session read.
  if (report.projectId === null) return true;
  const session = await getOptionalSession();
  return canAccessReport(report, session ? viewerOf(session) : null);
}
