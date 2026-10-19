import type { OsvRecord } from "./osv-record";

export type Severity = "critical" | "high" | "moderate" | "low";

/** Highest first. */
export const SEVERITIES: readonly Severity[] = [
  "critical",
  "high",
  "moderate",
  "low",
];

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITIES.indexOf(a) - SEVERITIES.indexOf(b);
}

export function maxSeverity(
  severities: Iterable<Severity>,
): Severity | undefined {
  let max: Severity | undefined;
  for (const severity of severities) {
    if (max === undefined || compareSeverity(severity, max) < 0) {
      max = severity;
    }
  }
  return max;
}

const GHSA_LABELS: Record<string, Severity> = {
  CRITICAL: "critical",
  HIGH: "high",
  MODERATE: "moderate",
  LOW: "low",
};

/**
 * The GHSA label when present (nearly every npm record has one), else the CVSS
 * v3 base score. Records with neither get "moderate" so they still count in the
 * score without dominating it.
 */
export function recordSeverity(record: OsvRecord): Severity {
  // OpenSSF malicious-package reports carry no severity, but installing
  // malware is as bad as it gets.
  if (record.id.startsWith("MAL-")) return "critical";

  const label = record.database_specific?.severity?.toUpperCase();
  const labeled = label !== undefined ? GHSA_LABELS[label] : undefined;
  if (labeled !== undefined) return labeled;

  for (const entry of record.severity ?? []) {
    if (entry.type !== "CVSS_V3") continue;
    const score = cvss3BaseScore(entry.score);
    if (score !== undefined) return severityFromScore(score);
  }
  return "moderate";
}

// CVSS v3.1 qualitative rating scale; "none" (0.0) is folded into low.
function severityFromScore(score: number): Severity {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "moderate";
  return "low";
}

const WEIGHTS = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0 },
} as const;

// Privileges required weigh more when the scope changes.
const PR_WEIGHTS = {
  U: { N: 0.85, L: 0.62, H: 0.27 },
  C: { N: 0.85, L: 0.68, H: 0.5 },
} as const;

/** CVSS v3.0/v3.1 base score from a vector string, per the FIRST spec. */
export function cvss3BaseScore(vector: string): number | undefined {
  const [prefix, ...parts] = vector.split("/");
  if (prefix !== "CVSS:3.0" && prefix !== "CVSS:3.1") return undefined;

  const metrics = new Map<string, string>();
  for (const part of parts) {
    const [key, value] = part.split(":");
    if (key !== undefined && value !== undefined) metrics.set(key, value);
  }

  const pick = <T extends Record<string, number>>(
    table: T,
    key: string,
  ): number | undefined => {
    const value = metrics.get(key);
    return value !== undefined && value in table ? table[value] : undefined;
  };

  const scope = metrics.get("S");
  if (scope !== "U" && scope !== "C") return undefined;
  const av = pick(WEIGHTS.AV, "AV");
  const ac = pick(WEIGHTS.AC, "AC");
  const pr = pick(PR_WEIGHTS[scope], "PR");
  const ui = pick(WEIGHTS.UI, "UI");
  const c = pick(WEIGHTS.CIA, "C");
  const i = pick(WEIGHTS.CIA, "I");
  const a = pick(WEIGHTS.CIA, "A");
  if (
    av === undefined ||
    ac === undefined ||
    pr === undefined ||
    ui === undefined ||
    c === undefined ||
    i === undefined ||
    a === undefined
  ) {
    return undefined;
  }

  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact =
    scope === "U"
      ? 6.42 * iss
      : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  if (impact <= 0) return 0;

  const exploitability = 8.22 * av * ac * pr * ui;
  const base =
    scope === "U" ? impact + exploitability : 1.08 * (impact + exploitability);
  return roundUp(Math.min(base, 10));
}

// CVSS v3.1 Roundup: integer math avoids float artefacts like 4.000000001.
function roundUp(value: number): number {
  const scaled = Math.round(value * 100000);
  return scaled % 10000 === 0
    ? scaled / 100000
    : (Math.floor(scaled / 10000) + 1) / 10;
}
