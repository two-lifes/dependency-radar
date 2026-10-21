"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  cancelCheck,
  resumeCheck,
  retryFailed,
  startCheck,
} from "@/server/check/check-control";
import { isReportExpired } from "@/server/check/report-view";
import { createPgCheckStore } from "@/server/db/check-store";
import { getDb } from "@/server/db/client";
import { getCheckReportMeta, getReportMeta } from "@/server/db/report-page";

// screens 5.4 report actions. Every outcome ends in a refresh: the page reads
// the check state from the database, so "already running", "not running" or
// an expired report all show up there without a separate error message.
// Rate limits on these come in task 21.

const idSchema = z.uuid();

export async function checkAgain(reportId: string): Promise<void> {
  if (!idSchema.safeParse(reportId).success) return;
  const db = getDb();
  const report = await getReportMeta(db, reportId);
  if (report && !isReportExpired(report.expiresAt, new Date())) {
    await startCheck(createPgCheckStore(db), reportId);
  }
  refresh();
}

export async function cancel(checkId: string): Promise<void> {
  await onOpenCheck(checkId, (store) => cancelCheck(store, checkId));
}

export async function resume(checkId: string): Promise<void> {
  await onOpenCheck(checkId, (store) => resumeCheck(store, checkId));
}

/** "Retry failed" and "Try again". */
export async function retry(checkId: string): Promise<void> {
  await onOpenCheck(checkId, (store) => retryFailed(store, checkId));
}

async function onOpenCheck(
  checkId: string,
  run: (store: ReturnType<typeof createPgCheckStore>) => Promise<unknown>,
): Promise<void> {
  if (!idSchema.safeParse(checkId).success) return;
  const db = getDb();
  const report = await getCheckReportMeta(db, checkId);
  if (report && !isReportExpired(report.expiresAt, new Date())) {
    await run(createPgCheckStore(db));
  }
  refresh();
}
