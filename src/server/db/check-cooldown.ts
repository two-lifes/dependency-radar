import { desc, eq } from "drizzle-orm";
import { cooldownSeconds, nextCheckAt } from "@/lib/check-cooldown";
import type { Db } from "./client";
import { checks } from "./schema";

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Also called after locking the report, before any writes in createCheck. */
export async function checkLaunchBlock(db: Db | Transaction, reportId: string) {
  const [latest] = await db
    .select({ startedAt: checks.startedAt, status: checks.status })
    .from(checks)
    .where(eq(checks.reportId, reportId))
    .orderBy(desc(checks.startedAt))
    .limit(1);
  if (!latest) return null;
  if (latest.status === "running") return { error: "already-running" as const };
  const until = nextCheckAt(latest.startedAt);
  return cooldownSeconds(until, Date.now()) > 0
    ? { error: "check-cooldown" as const, nextCheckAt: until }
    : null;
}

export async function reportNextCheckAt(db: Db, reportId: string) {
  const [latest] = await db
    .select({ startedAt: checks.startedAt })
    .from(checks)
    .where(eq(checks.reportId, reportId))
    .orderBy(desc(checks.startedAt))
    .limit(1);
  return latest ? nextCheckAt(latest.startedAt) : null;
}
