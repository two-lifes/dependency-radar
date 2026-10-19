import type { PackageFindings } from "./package-findings";
import type { Severity } from "./severity";

/** spec 7.1. Also rendered in the "How it's calculated" popover. */
export const SCORE_RULES = {
  major: { penalty: 6, cap: 36 },
  minor: { penalty: 2, cap: 16 },
  patch: { penalty: 0.5, cap: 6 },
  deprecated: { penalty: 5, cap: 15 },
  vulnerabilities: {
    penalty: { critical: 20, high: 10, moderate: 4, low: 1 } satisfies Record<
      Severity,
      number
    >,
    cap: 60,
  },
} as const;

/** More unchecked packages than this share → "Partial" next to the score. */
export const PARTIAL_UNCHECKED_SHARE = 0.2;

export type ScoreCategory = keyof typeof SCORE_RULES;

export type ScoreBand = "good" | "fair" | "poor";

export type HealthScore = {
  /** null when no package could be checked. */
  score: number | null;
  band: ScoreBand | null;
  partial: boolean;
  /** Penalty per category after its cap, for the popover. */
  breakdown: Record<
    ScoreCategory,
    { count: number; penalty: number; cap: number }
  >;
};

export function healthScore(packages: readonly PackageFindings[]): HealthScore {
  const counts: Record<ScoreCategory, number> = {
    major: 0,
    minor: 0,
    patch: 0,
    deprecated: 0,
    vulnerabilities: 0,
  };
  let vulnerabilityPoints = 0;
  let checked = 0;

  for (const { analysis, vulnerabilities } of packages) {
    if (!analysis.checked) continue;
    checked++;
    if (analysis.lag.kind !== "current") counts[analysis.lag.kind]++;
    // `status` is "deprecated" only when the latest version is (spec 7.1).
    if (analysis.status === "deprecated") counts.deprecated++;
    for (const vulnerability of vulnerabilities) {
      counts.vulnerabilities++;
      vulnerabilityPoints +=
        SCORE_RULES.vulnerabilities.penalty[vulnerability.severity];
    }
  }

  const capped = (category: ScoreCategory, points: number) => ({
    count: counts[category],
    penalty: Math.min(points, SCORE_RULES[category].cap),
    cap: SCORE_RULES[category].cap,
  });
  const breakdown: HealthScore["breakdown"] = {
    major: capped("major", counts.major * SCORE_RULES.major.penalty),
    minor: capped("minor", counts.minor * SCORE_RULES.minor.penalty),
    patch: capped("patch", counts.patch * SCORE_RULES.patch.penalty),
    deprecated: capped(
      "deprecated",
      counts.deprecated * SCORE_RULES.deprecated.penalty,
    ),
    vulnerabilities: capped("vulnerabilities", vulnerabilityPoints),
  };

  const unchecked = packages.length - checked;
  const partial =
    packages.length > 0 &&
    unchecked / packages.length > PARTIAL_UNCHECKED_SHARE;

  // A score of 100 for a project we could not check would be a lie.
  if (checked === 0) return { score: null, band: null, partial, breakdown };

  const totalPenalty = Object.values(breakdown).reduce(
    (sum, { penalty }) => sum + penalty,
    0,
  );
  const score = Math.max(0, Math.round(100 - totalPenalty));
  return { score, band: scoreBand(score), partial, breakdown };
}

/** spec 7.1: 80–100 green, 50–79 yellow, below 50 red. */
export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "good";
  if (score >= 50) return "fair";
  return "poor";
}
