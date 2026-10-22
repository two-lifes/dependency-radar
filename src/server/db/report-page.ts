import { and, desc, eq } from "drizzle-orm";
import type { CheckPackageRow } from "../check/package-row";
import { pickChecks } from "../check/report-view";
import type { Db } from "./client";
import { checkPackages, checks, projects, reports } from "./schema";

/** `ownerId` and `demoSessionId` come with `projectId`, for `canAccessReport`. */
export type ReportMeta = {
  id: string;
  expiresAt: Date | null;
  projectId: string | null;
  ownerId: string | null;
  demoSessionId: string | null;
};

const metaColumns = {
  id: reports.id,
  expiresAt: reports.expiresAt,
  projectId: reports.projectId,
  ownerId: projects.ownerId,
  demoSessionId: projects.demoSessionId,
};

/**
 * Enough to answer 404, "no access" and "expired" before the report itself
 * loads, and for "Check again" to know whether to re-read the repository.
 */
export async function getReportMeta(
  db: Db,
  reportId: string,
): Promise<
  | (ReportMeta & Pick<typeof reports.$inferSelect, "source" | "repoUrl">)
  | undefined
> {
  const [report] = await db
    .select({
      ...metaColumns,
      source: reports.source,
      repoUrl: reports.repoUrl,
    })
    .from(reports)
    .leftJoin(projects, eq(projects.id, reports.projectId))
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
    .select(metaColumns)
    .from(checks)
    .innerJoin(reports, eq(reports.id, checks.reportId))
    .leftJoin(projects, eq(projects.id, reports.projectId))
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
    | "packageManager"
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
      packageManager: reports.packageManager,
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

/**
 * The newest result for one package of a report, from whichever check has
 * it (during "Check again" that is still the previous one).
 */
export async function getReportPackage(
  db: Db,
  reportId: string,
  name: string,
): Promise<
  { report: ReportMeta; row: CheckPackageRow | undefined } | undefined
> {
  const report = await getReportMeta(db, reportId);
  if (!report) return undefined;
  const [found] = await db
    .select({ row: checkPackages })
    .from(checkPackages)
    .innerJoin(checks, eq(checks.id, checkPackages.checkId))
    .where(and(eq(checks.reportId, reportId), eq(checkPackages.name, name)))
    .orderBy(desc(checks.startedAt))
    .limit(1);
  return { report, row: found?.row };
}
