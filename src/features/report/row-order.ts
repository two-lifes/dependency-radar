import { maxSeverity, SEVERITIES } from "@/server/analysis/severity";
import type { PackageRowJson } from "@/server/check/package-row";
import { filterRows, sortingFromUrl, type Filters } from "./filters";
import type { ReportRow } from "./report-rows";

// Sort keys per column (screens 5.5). `undefined` means there is nothing to
// compare: the package is still pending or couldn't be checked. Such rows go
// last in both directions (`sortUndefined: "last"` in the table).

function checkedResult(row: ReportRow): PackageRowJson | undefined {
  return row.result?.checked ? row.result : undefined;
}

/** current < patch < minor < major < "2 majors" < … */
export function lagRank(row: ReportRow): number | undefined {
  const result = checkedResult(row);
  switch (result?.lagKind) {
    case undefined:
    case null:
      return undefined;
    case "current":
      return 0;
    case "patch":
      return 1;
    case "minor":
      return 2;
    case "major":
      return 2 + (result.lagMajors ?? 1);
  }
}

export type VulnerabilityRank = {
  /** 0 = no vulnerabilities, then low … critical. */
  severity: number;
  count: number;
};

/** By the highest severity first, then by the number of vulnerabilities. */
export function vulnerabilityRank(
  row: ReportRow,
): VulnerabilityRank | undefined {
  const result = checkedResult(row);
  if (!result) return undefined;
  const highest = maxSeverity(result.vulnerabilities.map((v) => v.severity));
  return {
    severity:
      highest === undefined
        ? 0
        : SEVERITIES.length - SEVERITIES.indexOf(highest),
    count: result.vulnerabilities.length,
  };
}

export function compareVulnerabilityRank(
  a: VulnerabilityRank,
  b: VulnerabilityRank,
): number {
  return a.severity - b.severity || a.count - b.count;
}

/** Milliseconds of the last release, so newer sorts higher. */
export function releasedAt(row: ReportRow): number | undefined {
  const iso = checkedResult(row)?.lastReleaseAt;
  return iso ? Date.parse(iso) : undefined;
}

export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, "en");
}

/**
 * screens 5.5 default order: vulnerable first, then the furthest behind,
 * then by name. Pending and unchecked rows keep package.json order at the end.
 */
export function defaultOrder(rows: readonly ReportRow[]): ReportRow[] {
  const known: { row: ReportRow; lag: number; vuln: VulnerabilityRank }[] = [];
  const rest: ReportRow[] = [];
  for (const row of rows) {
    const lag = lagRank(row);
    const vuln = vulnerabilityRank(row);
    if (lag === undefined || vuln === undefined) rest.push(row);
    else known.push({ row, lag, vuln });
  }
  known.sort(
    (a, b) =>
      compareVulnerabilityRank(b.vuln, a.vuln) ||
      b.lag - a.lag ||
      compareNames(a.row.name, b.row.name),
  );
  return [...known.map(({ row }) => row), ...rest];
}

type ColumnSort = {
  /** undefined: nothing to compare, the row goes last. */
  defined: (row: ReportRow) => boolean;
  /** Called only when both rows are defined. */
  compare: (a: ReportRow, b: ReportRow) => number;
};

const byNumber = (key: (row: ReportRow) => number | undefined): ColumnSort => ({
  defined: (row) => key(row) !== undefined,
  compare: (a, b) => (key(a) ?? 0) - (key(b) ?? 0),
});

// The same keys and comparators as the table columns.
const COLUMN_SORTS: Record<string, ColumnSort> = {
  name: {
    defined: () => true,
    compare: (a, b) => compareNames(a.name, b.name),
  },
  behind: byNumber(lagRank),
  vulnerabilities: {
    defined: (row) => vulnerabilityRank(row) !== undefined,
    compare: (a, b) => {
      const rankA = vulnerabilityRank(a);
      const rankB = vulnerabilityRank(b);
      return rankA && rankB ? compareVulnerabilityRank(rankA, rankB) : 0;
    },
  },
  released: byNumber(releasedAt),
};

/**
 * The table's sort outside the table (screens 5.9 `j`/`k`): rows with
 * nothing to compare go last in both directions, ties keep the input order.
 * Mirrors TanStack's sorted row model with `sortUndefined: "last"`.
 */
export function sortRows(
  rows: readonly ReportRow[],
  sort: Filters["sort"],
): ReportRow[] {
  const [sorting] = sortingFromUrl(sort);
  const column = sorting && COLUMN_SORTS[sorting.id];
  if (!sorting || !column) return [...rows];
  const direction = sorting.desc ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, defined: column.defined(row) }))
    .sort((a, b) => {
      if (a.defined !== b.defined) return a.defined ? -1 : 1;
      const order = a.defined ? direction * column.compare(a.row, b.row) : 0;
      return order || a.index - b.index;
    })
    .map(({ row }) => row);
}

/** Rows in the order the table shows them for these search params. */
export function orderedRows(
  rows: readonly ReportRow[],
  filters: Filters,
): ReportRow[] {
  return sortRows(filterRows(defaultOrder(rows), filters), filters.sort);
}
