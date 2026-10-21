import type { CheckFailureCode } from "@/server/analysis/check-outcome";
import type { ScoreCategory } from "@/server/analysis/health-score";
import type { UncheckedReason } from "@/server/analysis/resolve-versions";
import type { Severity } from "@/server/analysis/severity";
import { minutesUntilRetry } from "../check/copy";

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

// screens 5.4
export const reportCopy = {
  untitled: "Untitled project",
  source: {
    paste: "Pasted manually",
    upload: "package.json upload",
  },
  checked: "Checked",
  checking: "Checking…",
  expiresOn: (date: string) =>
    `This report is public via link and expires on ${date}.`,
  actions: {
    save: "Save project",
    copyLink: "Copy link",
    checkAgain: "Check again",
    more: "More actions",
    linkCopied: "Link copied",
    copyFailed: "Couldn't copy the link. Copy it from the address bar.",
  },
  progress: {
    label: (checked: number, total: number) =>
      `Checking dependencies… ${checked} of ${total}`,
    cancel: "Cancel",
    lost: "Lost connection to the check.",
    retry: "Retry",
  },
  banner: {
    partial: (count: number) =>
      `${plural(count, "package", "packages")} couldn't be checked.`,
    show: "Show",
    retryFailed: "Retry failed",
    cancelled: "Check cancelled. Showing partial results.",
    resume: "Resume",
  },
  failed: {
    title: "We couldn't check this project.",
    tryAgain: "Try again",
  },
  expired: {
    title: "This report has expired.",
    description: "Guest reports are kept for 7 days.",
    action: "Run a new check",
  },
  score: {
    label: "Health score",
    partial: "Partial",
    howItsCalculated: "How it's calculated",
    noScore: "No packages could be checked yet.",
    intro: "Starts at 100. Each finding takes points off, up to a cap:",
    categories: {
      major: "Major behind",
      minor: "Minor behind",
      patch: "Patch behind",
      deprecated: "Deprecated",
      vulnerabilities: "Vulnerabilities",
    } satisfies Record<ScoreCategory, string>,
    perPackage: (penalty: number, cap: number) =>
      `−${penalty} each, max −${cap}`,
    vulnerabilityRule: (penalty: Record<Severity, number>, cap: number) =>
      `critical −${penalty.critical}, high −${penalty.high}, moderate −${penalty.moderate}, low −${penalty.low}; max −${cap}`,
    thisReport: "This report",
    footnote: (partialShare: number) =>
      `Unchecked packages don't count. “Partial” means more than ${Math.round(partialShare * 100)}% couldn't be checked.`,
  },
  tiles: {
    upToDate: "Up to date",
    patch: "Patch behind",
    minor: "Minor behind",
    major: "Major behind",
    vulnerable: "Vulnerable",
    // < 768px all five tiles share one row.
    short: {
      patch: "Patch",
      minor: "Minor",
      major: "Major",
    },
    bySeverity: (critical: number, high: number) =>
      [
        critical > 0 ? `${critical} critical` : null,
        high > 0 ? `${high} high` : null,
      ]
        .filter(Boolean)
        .join(" · "),
  },
  tabs: {
    label: "Report sections",
    dependencies: (count: number) => `Dependencies (${count})`,
    vulnerabilities: (count: number) => `Vulnerabilities (${count})`,
    vulnerabilitiesUnknown: "Vulnerabilities",
  },
  table: {
    caption: "Dependencies",
    package: "Package",
    current: "Current",
    latest: "Latest",
    behind: "Behind",
    vulnerabilities: "Vulnerabilities",
    released: "Released",
    status: "Status",
    dev: "dev",
    deprecated: "deprecated",
    none: "—",
    noneLabel: "None",
    highestSeverity: (severity: Severity) => `, highest ${severity}`,
    pending: "Checking…",
    ready: (ready: number, total: number) => `${ready} of ${total} ready`,
  },
};

// Keyed by code so a new reason fails typecheck until it has text.
export const uncheckedReasonCopy: Record<UncheckedReason, string> = {
  "not-from-registry": "Not from npm registry",
  "invalid-specifier": "Invalid version range",
  "no-matching-version": "No version matches the range",
  "unknown-tag": "Unknown dist-tag",
  "no-stable-version": "No stable version",
  "not-in-registry": "Not found in npm registry",
  "registry-rate-limited": "npm rate limit reached",
  "registry-unavailable": "Couldn't reach the npm registry",
  "vulnerabilities-unavailable": "Couldn't reach OSV.dev",
};

// Keyed by code so a new failure code fails typecheck until it has text.
export const checkFailureCopy: Record<
  CheckFailureCode,
  (retryAt: Date | null, now: Date) => string
> = {
  "registry-rate-limited": (retryAt, now) =>
    `npm is rate-limiting us. Try again in ${minutesUntilRetry(
      retryAt ? (retryAt.getTime() - now.getTime()) / 1000 : undefined,
    )}.`,
  "registry-unavailable": () => "Couldn't reach the npm registry.",
  "vulnerabilities-unavailable": () =>
    "Couldn't reach OSV.dev to check vulnerabilities.",
  "internal-error": () => "Something went wrong on our side.",
};
