import { checkLaunchBlock } from "./check-cooldown";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { CheckStore } from "../check/check-store";
import type { Db } from "./client";
import { checkPackages, checks, reports } from "./schema";
import { consumeGuestQuota, GuestQuotaExhausted } from "./guest-quota";

const running = (checkId: string) =>
  and(eq(checks.id, checkId), eq(checks.status, "running"));

export function createPgCheckStore(db: Db, guestId?: string): CheckStore {
  return {
    async getCheck(checkId) {
      const [check] = await db
        .select({
          id: checks.id,
          reportId: checks.reportId,
          status: checks.status,
          totalPackages: checks.totalPackages,
          failureReason: checks.failureReason,
          retryAt: checks.retryAt,
        })
        .from(checks)
        .where(eq(checks.id, checkId))
        .limit(1);
      return check;
    },

    async getInput(checkId) {
      const [input] = await db
        .select({
          dependencies: reports.dependencies,
          lockedVersions: reports.lockedVersions,
        })
        .from(checks)
        .innerJoin(reports, eq(reports.id, checks.reportId))
        .where(eq(checks.id, checkId))
        .limit(1);
      return input;
    },

    listRows(checkId) {
      return db
        .select()
        .from(checkPackages)
        .where(eq(checkPackages.checkId, checkId));
    },

    async insertRow(row) {
      const inserted = await db
        .insert(checkPackages)
        .values(row)
        .onConflictDoNothing()
        .returning({ name: checkPackages.name });
      return inserted.length > 0;
    },

    async claimLease(checkId, now, until) {
      const claimed = await db
        .update(checks)
        .set({ leaseUntil: until })
        .where(
          and(
            running(checkId),
            or(isNull(checks.leaseUntil), lt(checks.leaseUntil, now)),
          ),
        )
        .returning({ id: checks.id });
      return claimed.length > 0;
    },

    async renewLease(checkId, until) {
      const renewed = await db
        .update(checks)
        .set({ leaseUntil: until })
        .where(running(checkId))
        .returning({ id: checks.id });
      return renewed.length > 0;
    },

    async releaseLease(checkId) {
      await db.update(checks).set({ leaseUntil: null }).where(running(checkId));
    },

    async finish(checkId, snapshot) {
      const finished = await db
        .update(checks)
        .set({ ...snapshot, leaseUntil: null })
        .where(running(checkId))
        .returning({ id: checks.id });
      return finished.length > 0;
    },

    async createCheck(reportId, input, origin) {
      try {
        return await db.transaction(async (tx) => {
          // Serialize all new launches for this report, including a changed source.
          const [locked] = await tx
            .select({ id: reports.id })
            .from(reports)
            .where(eq(reports.id, reportId))
            .for("update");
          if (!locked) return { ok: false, error: "report-not-found" };
          const blocked = await checkLaunchBlock(tx, reportId);
          if (blocked) return { ok: false, ...blocked };
          if (guestId) await consumeGuestQuota(tx, guestId);
          const [report] = input
            ? await tx
                .update(reports)
                .set({
                  name: input.name ?? null,
                  dependencies: input.dependencies,
                  lockedVersions: input.lockedVersions,
                  warnings: input.warnings,
                  packageManager: input.packageManager,
                  ...origin,
                })
                .where(eq(reports.id, reportId))
                .returning({ dependencies: reports.dependencies })
            : await tx
                .select({ dependencies: reports.dependencies })
                .from(reports)
                .where(eq(reports.id, reportId))
                .limit(1);
          if (!report) throw new Error("report-not-found");

          const [check] = await tx
            .insert(checks)
            .values({
              reportId,
              totalPackages: report.dependencies.length,
              startedAt: sql`clock_timestamp()`,
            })
            .returning({ id: checks.id });
          if (!check) throw new Error("Insert into checks returned no row");
          return { ok: true, value: { checkId: check.id } };
        });
      } catch (error) {
        if (error instanceof GuestQuotaExhausted)
          return { ok: false, error: "guest-quota-exhausted" };
        if (error instanceof Error && error.message === "report-not-found")
          return { ok: false, error: "report-not-found" };
        // checks_one_running_per_report_idx: a check of this report runs;
        // the transaction rolls back the new input with it.
        if (isUniqueViolation(error)) {
          return { ok: false, error: "already-running" };
        }
        throw error;
      }
    },

    async reopenCheck(checkId, dropReasons) {
      try {
        return await db.transaction(async (tx) => {
          const [check] = await tx
            .select({ status: checks.status })
            .from(checks)
            .where(eq(checks.id, checkId))
            .for("update")
            .limit(1);
          if (!check) return { ok: false, error: "check-not-found" } as const;
          if (check.status === "running" || check.status === "completed") {
            return { ok: false, error: "not-reopenable" } as const;
          }

          if (dropReasons.length > 0) {
            await tx
              .delete(checkPackages)
              .where(
                and(
                  eq(checkPackages.checkId, checkId),
                  inArray(checkPackages.reason, [...dropReasons]),
                ),
              );
          }
          await tx
            .update(checks)
            .set({
              status: "running",
              failureReason: null,
              retryAt: null,
              finishedAt: null,
              score: null,
              vulnerabilityCount: null,
              severeVulnerableCount: null,
              leaseUntil: null,
            })
            .where(eq(checks.id, checkId));
          return { ok: true, value: undefined } as const;
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return { ok: false, error: "already-running" };
        }
        throw error;
      }
    },
  };
}

// Drizzle wraps driver errors in DrizzleQueryError with the original as cause.
function isUniqueViolation(error: unknown): boolean {
  const candidates = [error, error instanceof Error ? error.cause : undefined];
  return candidates.some(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      candidate.code === "23505",
  );
}
