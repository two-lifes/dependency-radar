import { desc, eq } from "drizzle-orm";
import type { CheckPackageRow } from "../check/package-row";
import { pickChecks } from "../check/report-view";
import type { Db } from "./client";
import { checkPackages, checks, reports } from "./schema";

export type ReportMeta = { id: string; expiresAt: Date | null };

/** Enough to answer 404 and "expired" before the report itself loads. */
export async function getReportMeta(
  db: Db,
  reportId: string,
): Promise<ReportMeta | undefined> {
  const [report] = await db
    .select({ id: reports.id, expiresAt: reports.expiresAt })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);
  return report;
}

/** The report a check belongs to, for Server Actions that get a check id. */
export async function getCheckReportMeta(
  db: Db,
  checkId: string,
): Promise<ReportMeta | undefined> {
  const [report] = await db
    .select({ id: reports.id, expiresAt: reports.expiresAt })
    .from(checks)
    .innerJoin(reports, eq(reports.id, checks.reportId))
    .where(eq(checks.id, checkId))
    .limit(1);
  return report;
}

const checkColumns = {
  id: checks.id,
  status: checks.status,
  failureReason: checks.failureReason,
  retryAt: checks.retryAt,
  totalPackages: checks.totalPackages,
  finishedAt: checks.finishedAt,
};

export type ReportCheck = {
  id: string;
  status: (typeof checks.$inferSelect)["status"];
  failureReason: (typeof checks.$inferSelect)["failureReason"];
  retryAt: Date | null;
  totalPackages: number;
  finishedAt: Date | null;
};

export type ReportPageData = {
  report: Pick<
    typeof reports.$inferSelect,
    | "id"
    | "name"
    | "source"
    | "repoUrl"
    | "expiresAt"
    | "warnings"
    | "dependencies"
  >;
  check: (ReportCheck & { rows: CheckPackageRow[] }) | undefined;
  /** The check before a running one, whose results stay on screen. */
  previous: (ReportCheck & { rows: CheckPackageRow[] }) | undefined;
};

export async function getReportPage(
  db: Db,
  reportId: string,
): Promise<ReportPageData | undefined> {
  const [report] = await db
    .select({
      id: reports.id,
      name: reports.name,
      source: reports.source,
      repoUrl: reports.repoUrl,
      expiresAt: reports.expiresAt,
      warnings: reports.warnings,
      dependencies: reports.dependencies,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);
  if (!report) return undefined;

  const recent = await db
    .select(checkColumns)
    .from(checks)
    .where(eq(checks.reportId, reportId))
    .orderBy(desc(checks.startedAt))
    .limit(2);
  const { latest, previous } = pickChecks(recent);

  const withRows = async (check: ReportCheck | undefined) =>
    check && {
      ...check,
      rows: await db
        .select()
        .from(checkPackages)
        .where(eq(checkPackages.checkId, check.id)),
    };
  const [check, before] = await Promise.all([
    withRows(latest),
    withRows(previous),
  ]);
  return { report, check, previous: before };
}
