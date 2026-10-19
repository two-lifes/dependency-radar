import type { PackageAnalysis } from "./analyze-package";
import type { Vulnerability } from "./merge-vulnerabilities";

/** Everything the report summary needs to know about one dependency. */
export type PackageFindings = {
  analysis: PackageAnalysis;
  /** Merged list from `mergeVulnerabilities`; empty for unchecked packages. */
  vulnerabilities: readonly Vulnerability[];
};
