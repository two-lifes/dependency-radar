import type { CheckFailureCode } from "../analysis/check-outcome";
import type { LockedPackage } from "../analysis/parse-lockfile";
import type { ManifestDependency } from "../analysis/parse-manifest";
import type { ReportInput } from "../analysis/report-input";
import type { UncheckedReason } from "../analysis/resolve-versions";
import type { Result } from "../analysis/result";
import type { FinishedCheckStatus } from "./events";
import type { CheckPackageRow } from "./package-row";

export type CheckState = {
  id: string;
  reportId: string;
  status: FinishedCheckStatus | "running";
  totalPackages: number;
  failureReason: CheckFailureCode | null;
  retryAt: Date | null;
};

/** Where a report's input comes from. */
export type ReportOrigin = {
  source: "paste" | "upload" | "github";
  repoUrl: string | null;
};

/** The report input a check runs over. */
export type CheckInput = {
  dependencies: ManifestDependency[];
  lockedVersions: Record<string, LockedPackage> | null;
};

export type CheckSnapshot = {
  status: FinishedCheckStatus;
  failureReason: CheckFailureCode | null;
  retryAt: Date | null;
  score: number | null;
  vulnerabilityCount: number | null;
  severeVulnerableCount: number | null;
  finishedAt: Date;
};

export type CreateCheckError =
  "report-not-found" | "already-running" | "guest-quota-exhausted";

export type CreateCheckResult =
  | Result<{ checkId: string }, CreateCheckError>
  | { ok: false; error: "check-cooldown"; nextCheckAt: string };

export type ReopenCheckError =
  | "check-not-found"
  | "already-running"
  /** Only a cancelled, partial or failed check can be resumed or retried. */
  | "not-reopenable";

/**
 * Persistence the check engine needs. The Postgres implementation lives in
 * `src/server/db/check-store.ts`; tests use an in-memory one.
 */
export type CheckStore = {
  getCheck(checkId: string): Promise<CheckState | undefined>;
  getInput(checkId: string): Promise<CheckInput | undefined>;
  listRows(checkId: string): Promise<CheckPackageRow[]>;
  /** `false` when the row already exists: another runner wrote it first. */
  insertRow(row: CheckPackageRow): Promise<boolean>;
  /** Takes the lease of a running check if it is free or expired. */
  claimLease(checkId: string, now: Date, until: Date): Promise<boolean>;
  /** `false` once the check is no longer running, e.g. cancelled elsewhere. */
  renewLease(checkId: string, until: Date): Promise<boolean>;
  /** Frees the lease of a running check for the next stream to take. */
  releaseLease(checkId: string): Promise<void>;
  /** Finishes a running check and frees its lease; `false` if not running. */
  finish(checkId: string, snapshot: CheckSnapshot): Promise<boolean>;
  /**
   * With `input`, replaces the report input in the same transaction as the
   * new check: a check that can't start leaves the input as it was. `origin`
   * ("Replace source") replaces where the input comes from along with it.
   */
  createCheck(
    reportId: string,
    input?: ReportInput,
    origin?: ReportOrigin,
  ): Promise<CreateCheckResult>;
  /** Back to running, after deleting rows with `dropReasons`. */
  reopenCheck(
    checkId: string,
    dropReasons: readonly UncheckedReason[],
  ): Promise<Result<void, ReopenCheckError>>;
};
