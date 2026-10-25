import type { FinishedCheckStatus } from "../check/events";

/** One project as the dashboard loads it (screens 5.10). */
export type DashboardProject = {
  nextCheckAt: string | null;
  id: string;
  name: string;
  source: "paste" | "upload" | "github";
  repoUrl: string | null;
  /** False for the seeded demo projects: no delete (plan.md 26.1). */
  editable: boolean;
  /** The newest check of any status; null before the first one. */
  latest: {
    id: string;
    status: FinishedCheckStatus | "running";
    totalPackages: number;
    /** Packages with a result so far, for "Checking… N%". */
    checkedPackages: number;
  } | null;
  /** The newest completed or partial check: what the card shows. */
  result: {
    score: number | null;
    vulnerabilityCount: number | null;
    severeVulnerableCount: number | null;
    finishedAt: Date;
  } | null;
};

export type CardStatus =
  | { kind: "checking"; percent: number }
  | { kind: "queued" }
  | { kind: "failed" }
  | { kind: "checked"; at: Date };

/** What the card shows instead of the date before the queue touches it. */
export function cardStatus(project: DashboardProject): CardStatus {
  const { latest, result } = project;
  if (latest?.status === "running") {
    return {
      kind: "checking",
      percent: checkPercent(latest.checkedPackages, latest.totalPackages),
    };
  }
  if (result) return { kind: "checked", at: result.finishedAt };
  return latest?.status === "failed" ? { kind: "failed" } : { kind: "queued" };
}

/**
 * decisions 43: the dashboard checks projects that never finished a check —
 * never started, cut short (cancelled) or running elsewhere. A failed one
 * waits for "Check now": retrying it on every visit would loop on errors.
 */
export function needsFirstCheck(project: DashboardProject): boolean {
  return project.result === null && project.latest?.status !== "failed";
}

export function checkPercent(checked: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.floor((checked / total) * 100));
}
