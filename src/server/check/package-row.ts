import type { InferSelectModel } from "drizzle-orm";
import type { PackageAnalysis } from "../analysis/analyze-package";
import type { Vulnerability } from "../analysis/merge-vulnerabilities";
import type { PackageFindings } from "../analysis/package-findings";
import type { ManifestDependency } from "../analysis/parse-manifest";
import type { checkPackages } from "../db/schema";

export type CheckPackageRow = InferSelectModel<typeof checkPackages>;

/** A row as it travels in SSE events: dates become ISO strings. */
export type PackageRowJson = Omit<
  CheckPackageRow,
  "lastReleaseAt" | "checkedAt"
> & { lastReleaseAt: string | null; checkedAt: string };

export function buildPackageRow(input: {
  checkId: string;
  dependency: ManifestDependency;
  analysis: PackageAnalysis;
  vulnerabilities: readonly Vulnerability[];
  checkedAt: Date;
}): CheckPackageRow {
  const { analysis, dependency } = input;
  const base = {
    checkId: input.checkId,
    name: dependency.name,
    type: dependency.type,
    specifier: dependency.specifier,
    checkedAt: input.checkedAt,
  };
  if (!analysis.checked) {
    return {
      ...base,
      checked: false,
      reason: analysis.reason,
      registryName: null,
      current: null,
      latest: null,
      lagKind: null,
      lagMajors: null,
      status: null,
      deprecationMessage: null,
      lastReleaseAt: null,
      vulnerabilities: [],
    };
  }
  return {
    ...base,
    checked: true,
    reason: null,
    registryName: analysis.registryName,
    current: analysis.current,
    latest: analysis.latest,
    lagKind: analysis.lag.kind,
    lagMajors: analysis.lag.kind === "major" ? analysis.lag.majors : null,
    status: analysis.status,
    deprecationMessage: analysis.deprecationMessage ?? null,
    lastReleaseAt:
      analysis.lastReleaseAt === undefined
        ? null
        : new Date(analysis.lastReleaseAt),
    vulnerabilities: [...input.vulnerabilities],
  };
}

/**
 * The inverse of `buildPackageRow`, for the score and counters. Throws on a
 * row that `buildPackageRow` could never produce: that is corrupted data.
 */
export function rowToFindings(row: CheckPackageRow): PackageFindings {
  if (!row.checked) {
    if (row.reason === null) throw corrupted(row, "reason");
    return {
      analysis: { checked: false, reason: row.reason },
      vulnerabilities: [],
    };
  }

  const { registryName, current, latest, lagKind, status } = row;
  if (registryName === null) throw corrupted(row, "registryName");
  if (current === null) throw corrupted(row, "current");
  if (latest === null) throw corrupted(row, "latest");
  if (lagKind === null) throw corrupted(row, "lagKind");
  if (status === null) throw corrupted(row, "status");
  if (lagKind === "major" && row.lagMajors === null) {
    throw corrupted(row, "lagMajors");
  }

  return {
    analysis: {
      checked: true,
      registryName,
      current,
      latest,
      lag:
        lagKind === "major"
          ? { kind: "major", majors: row.lagMajors ?? 0 }
          : { kind: lagKind },
      status,
      ...(row.deprecationMessage !== null && {
        deprecationMessage: row.deprecationMessage,
      }),
      ...(row.lastReleaseAt !== null && {
        lastReleaseAt: row.lastReleaseAt.toISOString(),
      }),
    },
    vulnerabilities: row.vulnerabilities,
  };
}

export function toPackageRowJson(row: CheckPackageRow): PackageRowJson {
  return {
    ...row,
    lastReleaseAt: row.lastReleaseAt?.toISOString() ?? null,
    checkedAt: row.checkedAt.toISOString(),
  };
}

function corrupted(row: CheckPackageRow, field: string): Error {
  return new Error(
    `check_packages row ${row.checkId}/${row.name} has no ${field}`,
  );
}
