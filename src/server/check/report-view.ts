import { isSourceFailure } from "../analysis/check-outcome";
import { type HealthScore, healthScore } from "../analysis/health-score";
import { type ReportCounts, reportCounts } from "../analysis/report-counts";
import { type CheckPackageRow, rowToFindings } from "./package-row";

/** decisions 11: expiry is checked on every open, not left to the daily job. */
export function isReportExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

/**
 * The check the page shows and, while it runs, the one before it: screens 5.4
 * keeps the previous results visible during "Check again". Expects checks
 * newest first; only one check of a report can be running.
 */
export function pickChecks<T extends { status: string }>(
  newestFirst: readonly T[],
): { latest: T | undefined; previous: T | undefined } {
  const [latest, before] = newestFirst;
  return {
    latest,
    previous: latest?.status === "running" ? before : undefined,
  };
}

/**
 * Rows of the previous check shown during "Check again": only packages still
 * in the report input, which the repository re-read may have changed
 * (decisions 42), so removed packages don't stay until the check ends.
 */
export function previousRowsFor<T extends { name: string }>(
  rows: readonly T[],
  dependencies: readonly { name: string }[],
): T[] {
  const names = new Set(dependencies.map(({ name }) => name));
  return rows.filter((row) => names.has(row.name));
}

export type ReportSummary = {
  score: HealthScore;
  counts: ReportCounts;
  /** "N packages couldn't be checked": the ones "Retry failed" re-checks. */
  sourceFailures: number;
};

export function summarizeRows(
  rows: readonly CheckPackageRow[],
  dependencies: number,
): ReportSummary {
  const findings = rows.map(rowToFindings);
  return {
    score: healthScore(findings),
    // "Dependencies (N)" counts every package of the report, rows or not.
    counts: { ...reportCounts(findings), dependencies },
    sourceFailures: rows.filter((row) => isSourceFailure(row.reason)).length,
  };
}
