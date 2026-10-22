import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { DashboardProject } from "../analysis/dashboard-card";
import { isReportExpired } from "../check/report-view";
import type { Db } from "./client";
import type { NewGuestReport } from "./reports";
import { checkPackages, checks, projects, reports } from "./schema";

// screens 5.4: a report without a name from package.json.
const UNTITLED_PROJECT = "Untitled project";

export type SaveReportOutcome =
  | { kind: "saved"; projectId: string }
  | { kind: "expired" }
  | { kind: "not-found" };

/**
 * "Save project" (decisions 24, 45): the guest report itself becomes the
 * project's report, so its checks and results stay and a running check goes
 * on. Saving again returns the same project; a report someone else saved is
 * "not found" to everyone else.
 */
export function saveGuestReport(
  db: Db,
  reportId: string,
  userId: string,
  now: Date = new Date(),
): Promise<SaveReportOutcome> {
  return db.transaction(async (tx) => {
    // The lock makes two parallel saves (double click, two tabs) create one
    // project: the second waits and then sees `project_id` set.
    const [report] = await tx
      .select({
        projectId: reports.projectId,
        expiresAt: reports.expiresAt,
        name: reports.name,
      })
      .from(reports)
      .where(eq(reports.id, reportId))
      .for("update")
      .limit(1);
    if (!report) return { kind: "not-found" };

    if (report.projectId !== null) {
      const [own] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(eq(projects.id, report.projectId), eq(projects.ownerId, userId)),
        )
        .limit(1);
      return own ? { kind: "saved", projectId: own.id } : { kind: "not-found" };
    }
    if (isReportExpired(report.expiresAt, now)) return { kind: "expired" };

    const [project] = await tx
      .insert(projects)
      .values({ ownerId: userId, name: report.name ?? UNTITLED_PROJECT })
      .returning({ id: projects.id });
    if (!project) throw new Error("Insert into projects returned no row");

    await tx
      .update(reports)
      .set({ projectId: project.id, expiresAt: null })
      .where(eq(reports.id, reportId));
    return { kind: "saved", projectId: project.id };
  });
}

export type ProjectReportMeta = {
  projectId: string;
  name: string;
  reportId: string;
};

/** A project and its report, only for its owner (screens 5.4: else 404). */
export async function getProjectReportMeta(
  db: Db,
  projectId: string,
  userId: string,
): Promise<ProjectReportMeta | undefined> {
  const [found] = await db
    .select({
      projectId: projects.id,
      name: projects.name,
      reportId: reports.id,
    })
    .from(projects)
    .innerJoin(reports, eq(reports.projectId, projects.id))
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  return found;
}

/**
 * `/projects/new` "Create & check": the project, its report and the first
 * check in one transaction, like a guest report (createGuestReport).
 */
export function createProjectWithCheck(
  db: Db,
  userId: string,
  name: string,
  { source, repoUrl, input }: NewGuestReport,
): Promise<{ projectId: string }> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ ownerId: userId, name })
      .returning({ id: projects.id });
    if (!project) throw new Error("Insert into projects returned no row");

    const [report] = await tx
      .insert(reports)
      .values({
        projectId: project.id,
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

    await tx.insert(checks).values({
      reportId: report.id,
      totalPackages: input.dependencies.length,
    });
    return { projectId: project.id };
  });
}

export type ProjectSettings = {
  id: string;
  name: string;
  reportId: string;
  source: (typeof reports.$inferSelect)["source"];
  repoUrl: string | null;
};

/** screens 5.12: what the settings page shows, only for the project's owner. */
export async function getProjectSettings(
  db: Db,
  projectId: string,
  userId: string,
): Promise<ProjectSettings | undefined> {
  const [found] = await db
    .select({
      id: projects.id,
      name: projects.name,
      reportId: reports.id,
      source: reports.source,
      repoUrl: reports.repoUrl,
    })
    .from(projects)
    .innerJoin(reports, eq(reports.projectId, projects.id))
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  return found;
}

/** Renames an owned project; `false` if it isn't this user's. */
export async function renameProject(
  db: Db,
  projectId: string,
  userId: string,
  name: string,
): Promise<boolean> {
  const renamed = await db
    .update(projects)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .returning({ id: projects.id });
  return renamed.length > 0;
}

/** Deletes an owned project; its report and checks go with it (cascade). */
export async function deleteProject(
  db: Db,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .returning({ id: projects.id });
  return deleted.length > 0;
}

/** screens 5.10: the user's projects in the order they were added. */
export async function listProjects(
  db: Db,
  userId: string,
): Promise<DashboardProject[]> {
  const owned = await db
    .select({
      id: projects.id,
      name: projects.name,
      reportId: reports.id,
      source: reports.source,
      repoUrl: reports.repoUrl,
    })
    .from(projects)
    .innerJoin(reports, eq(reports.projectId, projects.id))
    .where(eq(projects.ownerId, userId))
    .orderBy(asc(projects.createdAt), asc(projects.id));
  if (owned.length === 0) return [];
  const reportIds = owned.map((project) => project.reportId);

  const [latest, results] = await Promise.all([
    db
      .selectDistinctOn([checks.reportId], {
        reportId: checks.reportId,
        id: checks.id,
        status: checks.status,
        totalPackages: checks.totalPackages,
      })
      .from(checks)
      .where(inArray(checks.reportId, reportIds))
      .orderBy(checks.reportId, desc(checks.startedAt)),
    db
      .selectDistinctOn([checks.reportId], {
        reportId: checks.reportId,
        score: checks.score,
        vulnerabilityCount: checks.vulnerabilityCount,
        severeVulnerableCount: checks.severeVulnerableCount,
        finishedAt: checks.finishedAt,
      })
      .from(checks)
      .where(
        and(
          inArray(checks.reportId, reportIds),
          inArray(checks.status, ["completed", "partial"]),
        ),
      )
      .orderBy(checks.reportId, desc(checks.startedAt)),
  ]);

  const runningIds = latest
    .filter((check) => check.status === "running")
    .map((check) => check.id);
  const progress =
    runningIds.length === 0
      ? []
      : await db
          .select({ checkId: checkPackages.checkId, checked: count() })
          .from(checkPackages)
          .where(inArray(checkPackages.checkId, runningIds))
          .groupBy(checkPackages.checkId);

  const latestBy = new Map(latest.map((check) => [check.reportId, check]));
  const resultBy = new Map(results.map((check) => [check.reportId, check]));
  const checkedBy = new Map(progress.map((row) => [row.checkId, row.checked]));

  return owned.map(({ id, name, reportId, source, repoUrl }) => {
    const check = latestBy.get(reportId);
    const result = resultBy.get(reportId);
    return {
      id,
      name,
      source,
      repoUrl,
      latest: check
        ? {
            id: check.id,
            status: check.status,
            totalPackages: check.totalPackages,
            checkedPackages: checkedBy.get(check.id) ?? 0,
          }
        : null,
      // A finished check always has `finished_at`; the guard keeps types honest.
      result: result?.finishedAt
        ? {
            score: result.score,
            vulnerabilityCount: result.vulnerabilityCount,
            severeVulnerableCount: result.severeVulnerableCount,
            finishedAt: result.finishedAt,
          }
        : null,
    };
  });
}

export type ProjectCheckState = {
  reportId: string;
  source: (typeof reports.$inferSelect)["source"];
  repoUrl: string | null;
  latest: { id: string; status: (typeof checks.$inferSelect)["status"] } | null;
};

/** What the dashboard queue needs to start or resume a project's check. */
export async function getProjectCheckState(
  db: Db,
  projectId: string,
  userId: string,
): Promise<ProjectCheckState | undefined> {
  const [project] = await db
    .select({
      reportId: reports.id,
      source: reports.source,
      repoUrl: reports.repoUrl,
    })
    .from(projects)
    .innerJoin(reports, eq(reports.projectId, projects.id))
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  if (!project) return undefined;
  const [latest] = await db
    .select({ id: checks.id, status: checks.status })
    .from(checks)
    .where(eq(checks.reportId, project.reportId))
    .orderBy(desc(checks.startedAt))
    .limit(1);
  return { ...project, latest: latest ?? null };
}
