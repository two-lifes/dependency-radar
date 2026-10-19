import type { PackageFindings } from "./package-findings";
import { maxSeverity, type Severity } from "./severity";

export type ReportCounts = {
  upToDate: number;
  patch: number;
  minor: number;
  major: number;
  /** Packages with at least one vulnerability (the "Vulnerable" tile). */
  vulnerable: number;
  /** Vulnerable packages by their highest severity. */
  vulnerableBySeverity: Record<Severity, number>;
  /** "Dependencies (N)": every package, unchecked included. */
  dependencies: number;
  /** "Vulnerabilities (N)": merged vulnerabilities summed over packages. */
  vulnerabilities: number;
};

/** spec 7.3. Unchecked packages count only towards `dependencies`. */
export function reportCounts(
  packages: readonly PackageFindings[],
): ReportCounts {
  const counts: ReportCounts = {
    upToDate: 0,
    patch: 0,
    minor: 0,
    major: 0,
    vulnerable: 0,
    vulnerableBySeverity: { critical: 0, high: 0, moderate: 0, low: 0 },
    dependencies: packages.length,
    vulnerabilities: 0,
  };

  for (const { analysis, vulnerabilities } of packages) {
    if (!analysis.checked) continue;
    if (analysis.lag.kind === "current") counts.upToDate++;
    else counts[analysis.lag.kind]++;

    const highest = maxSeverity(vulnerabilities.map((v) => v.severity));
    if (highest === undefined) continue;
    counts.vulnerable++;
    counts.vulnerableBySeverity[highest]++;
    counts.vulnerabilities += vulnerabilities.length;
  }
  return counts;
}
