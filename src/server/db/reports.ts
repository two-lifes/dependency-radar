import type { ReportInput } from "../analysis/report-input";
import type { Db } from "./client";
import { checks, reports } from "./schema";

// spec 9: guest reports are deleted after 7 days.
const GUEST_REPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type NewGuestReport = {
  source: "paste" | "upload" | "github";
  repoUrl?: string;
  input: ReportInput;
};

/**
 * A guest report with its first check, in one transaction: a report without a
 * check would open with nothing to stream.
 */
export function createGuestReport(
  db: Db,
  { source, repoUrl, input }: NewGuestReport,
  now: Date = new Date(),
): Promise<{ reportId: string; checkId: string }> {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .insert(reports)
      .values({
        expiresAt: new Date(now.getTime() + GUEST_REPORT_TTL_MS),
        name: input.name ?? null,
        source,
        repoUrl: repoUrl ?? null,
        dependencies: input.dependencies,
        lockedVersions: input.lockedVersions,
        warnings: input.warnings,
        packageManager: input.packageManager,
      })
      .returning({ id: reports.id });
    if (!report) throw new Error("Insert into reports returned no row");

    const [check] = await tx
      .insert(checks)
      .values({
        reportId: report.id,
        totalPackages: input.dependencies.length,
      })
      .returning({ id: checks.id });
    if (!check) throw new Error("Insert into checks returned no row");

    return { reportId: report.id, checkId: check.id };
  });
}
