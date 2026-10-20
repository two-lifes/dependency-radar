import type { UncheckedReason } from "./resolve-versions";

/** Why a whole check failed; the report page turns it into text. */
export type CheckFailureCode =
  | "registry-rate-limited"
  | "registry-unavailable"
  | "vulnerabilities-unavailable"
  | "internal-error";

/** Reasons a retry can fix: "Retry failed" re-checks only these packages. */
export const SOURCE_FAILURE_REASONS = [
  "registry-rate-limited",
  "registry-unavailable",
  "vulnerabilities-unavailable",
] as const satisfies readonly UncheckedReason[];

// Never looked up in the registry, so they say nothing about the sources.
const NOT_LOOKED_UP: readonly UncheckedReason[] = [
  "not-from-registry",
  "invalid-specifier",
];

export function isSourceFailure(reason: UncheckedReason | null): boolean {
  return (
    reason !== null &&
    (SOURCE_FAILURE_REASONS as readonly UncheckedReason[]).includes(reason)
  );
}

export type CheckOutcome =
  | { status: "completed" | "partial"; failure: null }
  | { status: "failed"; failure: CheckFailureCode };

/**
 * screens 5.4: "partial" when some packages hit a source failure, "failed"
 * when every package looked up in the registry did. Git dependencies or a
 * package missing from npm don't make a check partial: a retry won't fix them.
 */
export function checkOutcome(
  packages: readonly { reason: UncheckedReason | null }[],
): CheckOutcome {
  const lookedUp = packages.filter(
    ({ reason }) => reason === null || !NOT_LOOKED_UP.includes(reason),
  );
  const failed = lookedUp.filter(({ reason }) => isSourceFailure(reason));

  if (failed.length === 0) return { status: "completed", failure: null };
  if (failed.length < lookedUp.length) {
    return { status: "partial", failure: null };
  }

  const has = (reason: UncheckedReason) =>
    failed.some((p) => p.reason === reason);
  // The rate limit comes first: it is the one with a known time to retry.
  if (has("registry-rate-limited")) {
    return { status: "failed", failure: "registry-rate-limited" };
  }
  if (has("registry-unavailable")) {
    return { status: "failed", failure: "registry-unavailable" };
  }
  return { status: "failed", failure: "vulnerabilities-unavailable" };
}
