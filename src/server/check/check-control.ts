import { SOURCE_FAILURE_REASONS } from "../analysis/check-outcome";
import type { Result } from "../analysis/result";
import type {
  CheckStore,
  CreateCheckError,
  ReopenCheckError,
} from "./check-store";
import { finishCheck } from "./run-check";

// Server Actions (rate limit, ownership) call these; the SSE stream started
// afterwards does the actual work.

/** A new check of the report: "Check again" or the first check. */
export function startCheck(
  store: CheckStore,
  reportId: string,
): Promise<Result<{ checkId: string }, CreateCheckError>> {
  return store.createCheck(reportId);
}

/** "Resume": checks only packages that have no result yet. */
export function resumeCheck(
  store: CheckStore,
  checkId: string,
): Promise<Result<void, ReopenCheckError>> {
  return store.reopenCheck(checkId, []);
}

/**
 * "Retry failed" and "Try again": drops results a source failed for, then
 * checks them along with any package that has no result yet.
 */
export function retryFailed(
  store: CheckStore,
  checkId: string,
): Promise<Result<void, ReopenCheckError>> {
  return store.reopenCheck(checkId, SOURCE_FAILURE_REASONS);
}

/**
 * Cancels a check from outside its stream. The runner notices on its next
 * lease renewal and stops; closing the stream itself also cancels.
 */
export async function cancelCheck(
  store: CheckStore,
  checkId: string,
  now: Date = new Date(),
): Promise<Result<void, "check-not-found" | "not-running">> {
  const check = await store.getCheck(checkId);
  if (!check) return { ok: false, error: "check-not-found" };
  if (check.status !== "running") return { ok: false, error: "not-running" };
  await finishCheck(store, checkId, { now, cancelled: true });
  return { ok: true, value: undefined };
}
