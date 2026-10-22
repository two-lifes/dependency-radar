import { and, eq } from "drizzle-orm";
import { isReportExpired } from "../check/report-view";
import type { Db } from "./client";
import { projects, reports } from "./schema";

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
