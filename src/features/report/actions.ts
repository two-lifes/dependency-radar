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
import { consumeCheck } from "@/server/rate-limit";
import { tooManyChecks } from "../check/copy";

// screens 5.4 report actions. Every outcome ends in a refresh: the page reads
// the check state from the database, so "already running", "not running" or
// an expired report all show up there without a separate error message.
// Only the rate limit (decisions 44) comes back as a message, for a toast:
// nothing in the database changes then.

export type ReportActionResult = { error?: string };

const idSchema = z.uuid();

export async function checkAgain(
  reportId: string,
): Promise<ReportActionResult> {
  if (!idSchema.safeParse(reportId).success) return {};
  const db = getDb();
  const report = await getReportMeta(db, reportId);
  if (report && !isReportExpired(report.expiresAt, new Date())) {
    const allowed = await consumeCheck();
    if (!allowed.ok) {
      return { error: tooManyChecks(allowed.error.retryAfterSeconds) };
    }
    await startCheck(createPgCheckStore(db), reportId);
  }
  refresh();
  return {};
}

export async function cancel(checkId: string): Promise<ReportActionResult> {
  return onOpenCheck(checkId, false, (store) => cancelCheck(store, checkId));
}

export async function resume(checkId: string): Promise<ReportActionResult> {
  return onOpenCheck(checkId, true, (store) => resumeCheck(store, checkId));
}

/** "Retry failed" and "Try again". */
export async function retry(checkId: string): Promise<ReportActionResult> {
  return onOpenCheck(checkId, true, (store) => retryFailed(store, checkId));
}

async function onOpenCheck(
  checkId: string,
  countsAsCheck: boolean,
  run: (store: ReturnType<typeof createPgCheckStore>) => Promise<unknown>,
): Promise<ReportActionResult> {
  if (!idSchema.safeParse(checkId).success) return {};
  const db = getDb();
  const report = await getCheckReportMeta(db, checkId);
  if (report && !isReportExpired(report.expiresAt, new Date())) {
    if (countsAsCheck) {
      const allowed = await consumeCheck();
      if (!allowed.ok) {
        return { error: tooManyChecks(allowed.error.retryAfterSeconds) };
      }
    }
    await run(createPgCheckStore(db));
  }
  refresh();
  return {};
}
