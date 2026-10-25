import { eq, sql } from "drizzle-orm";
import { checkSnapshot } from "../check/run-check";
import { buildDemoProjects, demoPackageRows } from "../demo/demo-data";
import { DEMO_USER } from "../demo/demo-user";
import type { Db } from "./client";
import {
  account,
  checkPackages,
  checks,
  projects,
  reports,
  user,
} from "./schema";

/** Any fixed number; only this file takes the lock. */
const DEMO_SEED_LOCK = 25_001;

/** Whether the demo user exists, i.e. the database was seeded. */
export async function isDemoSeeded(db: Db): Promise<boolean> {
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, DEMO_USER.id))
    .limit(1);
  return found !== undefined;
}

/**
 * Manually recreates historical fixtures (screens 7): `pnpm db:seed`.
 * No route or scheduled job calls this; old sessions remain denied access.
 */
export function seedDemo(db: Db, now: Date = new Date()): Promise<void> {
  return db.transaction(async (tx) => {
    // Concurrent manual seeds
    // would both delete nothing and insert the projects twice.
    await tx.execute(sql`select pg_advisory_xact_lock(${DEMO_SEED_LOCK})`);
    await tx
      .insert(user)
      .values({ ...DEMO_USER, emailVerified: true })
      .onConflictDoUpdate({
        target: user.id,
        set: { name: DEMO_USER.name, email: DEMO_USER.email },
      });
    // Linking is blocked (auth.ts); this only clears rows from before that.
    await tx.delete(account).where(eq(account.userId, DEMO_USER.id));
    // Reports, checks and their packages go with the projects (cascade).
    await tx.delete(projects).where(eq(projects.ownerId, DEMO_USER.id));

    for (const demo of buildDemoProjects(now)) {
      const [project] = await tx
        .insert(projects)
        .values({
          ownerId: DEMO_USER.id,
          name: demo.name,
          createdAt: demo.createdAt,
          updatedAt: demo.createdAt,
        })
        .returning({ id: projects.id });
      if (!project) throw new Error("Insert into projects returned no row");

      const [report] = await tx
        .insert(reports)
        .values({
          projectId: project.id,
          name: demo.name,
          source: "upload",
          dependencies: demo.dependencies,
          lockedVersions: demo.lockedVersions,
          packageManager: demo.packageManager,
          createdAt: demo.createdAt,
          updatedAt: demo.checkedAt,
        })
        .returning({ id: reports.id });
      if (!report) throw new Error("Insert into reports returned no row");

      const [check] = await tx
        .insert(checks)
        .values({
          reportId: report.id,
          totalPackages: demo.dependencies.length,
          startedAt: demo.checkedAt,
        })
        .returning({ id: checks.id });
      if (!check) throw new Error("Insert into checks returned no row");

      const rows = demoPackageRows(demo, check.id);
      await tx.insert(checkPackages).values(rows);
      await tx
        .update(checks)
        .set(checkSnapshot(rows, { now: demo.checkedAt }))
        .where(eq(checks.id, check.id));
    }
  });
}
