"use server";

import { checkLaunchBlock } from "@/server/db/check-cooldown";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginPath } from "@/lib/safe-next";
import type { ReportInput } from "@/server/analysis/report-input";
import { getOptionalSession, viewerOf } from "@/server/auth/session";
import {
  cancelCheck,
  resumeCheck,
  retryFailed,
  startCheck,
} from "@/server/check/check-control";
import { isReportExpired } from "@/server/check/report-view";
import { createPgCheckStore } from "@/server/db/check-store";
import { getDb } from "@/server/db/client";
import { saveGuestReport } from "@/server/db/projects";
import { getCheckReportMeta, getReportMeta } from "@/server/db/report-page";
import { consumeCheck } from "@/server/rate-limit";
import { canOpenReport } from "@/server/report-access";
import { tooManyChecks } from "../check/copy";
import { readRepoInput } from "../check/read-repo";
import { savedReportPath } from "./saved-report";
import { prepareGuestLaunch } from "@/server/guest-quota";
import { GuestQuotaExhausted } from "@/server/db/guest-quota";
import { guestQuotaCopy } from "../guest-quota/copy";

// screens 5.4 report actions. Every outcome ends in a refresh: the page reads
// the check state from the database, so "already running", "not running" or
// an expired report all show up there without a separate error message.
// Only the rate limit (decisions 44) and a failed repository read
// (decisions 42) come back as a message, for a toast: nothing in the database
// changes then. Someone else's project is treated as a missing report
// (decisions 45), before the check counts against the limit.

export type ReportActionResult = {
  error?: string;
  code?: "guest-quota-exhausted" | "check-cooldown";
  nextCheckAt?: string;
  remaining?: 0;
};

const idSchema = z.uuid();

export async function checkAgain(
  reportId: string,
): Promise<ReportActionResult> {
  if (!idSchema.safeParse(reportId).success) return {};
  try {
    const db = getDb();
    const report = await getReportMeta(db, reportId);
    if (
      report &&
      (await canOpenReport(report)) &&
      !isReportExpired(report.expiresAt, new Date())
    ) {
      const blocked = await checkLaunchBlock(db, reportId);
      if (blocked?.error === "check-cooldown")
        return { code: "check-cooldown", nextCheckAt: blocked.nextCheckAt };
      if (blocked) {
        refresh();
        return {};
      }
      const guestId = await prepareGuestLaunch();
      const allowed = await consumeCheck();
      if (!allowed.ok) {
        return { error: tooManyChecks(allowed.error.retryAfterSeconds) };
      }
      // decisions 42: a repository report checks what the repository holds now.
      // A failed read starts nothing and leaves the report as it was.
      let input: ReportInput | undefined;
      if (report.source === "github" && report.repoUrl) {
        const read = await readRepoInput(report.repoUrl);
        if (!read.ok) return { error: read.error };
        input = read.value.input;
      }
      const result = await startCheck(
        createPgCheckStore(db, guestId),
        reportId,
        input,
      );
      if (!result.ok && result.error === "check-cooldown")
        return { code: "check-cooldown", nextCheckAt: result.nextCheckAt };
      if (!result.ok && result.error === "guest-quota-exhausted")
        return { code: "guest-quota-exhausted", remaining: 0 };
    }
    refresh();
    return {};
  } catch (error) {
    if (error instanceof GuestQuotaExhausted)
      return { code: "guest-quota-exhausted", remaining: 0 };
    console.error("[report] couldn't start check", error);
    return { error: guestQuotaCopy.startFailed };
  }
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
  if (
    report &&
    (await canOpenReport(report)) &&
    !isReportExpired(report.expiresAt, new Date())
  ) {
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

/**
 * screens 5.4 "Save project" for a signed-in user on a guest report; a guest
 * goes through `/login?next=/r/[id]/save` instead. A Server Action rather
 * than a link to `/r/[id]/save`: a prefetched link would save on hover.
 */
export async function saveReport(reportId: string): Promise<void> {
  if (!idSchema.safeParse(reportId).success) return;
  const session = await getOptionalSession();
  if (!session) redirect(loginPath(`/r/${reportId}/save`));
  const outcome = await saveGuestReport(getDb(), reportId, viewerOf(session));
  redirect(savedReportPath(reportId, outcome));
}
