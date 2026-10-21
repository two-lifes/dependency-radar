import type { SortingState } from "@tanstack/react-table";
import {
  createSerializer,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs";
import type { ReportRow } from "./report-rows";

// screens 5.5 toolbar. Every filter is a single choice; a value that isn't on
// the list parses as "no filter", and defaults never reach the URL.

export const TYPE_FILTERS = ["prod", "dev"] as const;
export const LAG_FILTERS = ["current", "patch", "minor", "major"] as const;
export const VULN_FILTERS = ["yes", "no"] as const;
export const STATUS_FILTERS = [
  "active",
  "stale",
  "deprecated",
  "unchecked",
] as const;

/** URL name of each sortable column; `-` in front sorts descending. */
const SORT_KEYS = {
  name: "name",
  behind: "behind",
  vulnerabilities: "vulns",
  released: "released",
} as const;
type SortKey = (typeof SORT_KEYS)[keyof typeof SORT_KEYS];
const sortValues = Object.values(SORT_KEYS).flatMap(
  (key) => [key, `-${key}`] as const,
);

export const filterParsers = {
  q: parseAsString.withDefault(""),
  type: parseAsStringLiteral(TYPE_FILTERS),
  lag: parseAsStringLiteral(LAG_FILTERS),
  vuln: parseAsStringLiteral(VULN_FILTERS),
  status: parseAsStringLiteral(STATUS_FILTERS),
  sort: parseAsStringLiteral(sortValues),
};

export type Filters = inferParserType<typeof filterParsers>;
/** The filters that narrow the rows and have a menu and a chip. */
export type FilterKey = "type" | "lag" | "vuln" | "status";
export const FILTER_KEYS: readonly FilterKey[] = [
  "type",
  "lag",
  "vuln",
  "status",
];
export const FILTER_VALUES: {
  [K in FilterKey]: readonly NonNullable<Filters[K]>[];
} = {
  type: TYPE_FILTERS,
  lag: LAG_FILTERS,
  vuln: VULN_FILTERS,
  status: STATUS_FILTERS,
};

/** Query string (with `?`, or "" when empty) from a base and changed values. */
export const serializeFilters = createSerializer(filterParsers);

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.q.trim() !== "" || FILTER_KEYS.some((key) => filters[key] !== null)
  );
}

/** Values that reset `q` and every filter; the sort is kept. */
export const clearedFilters = {
  q: null,
  type: null,
  lag: null,
  vuln: null,
  status: null,
} as const;

export function filterRows(
  rows: readonly ReportRow[],
  filters: Omit<Filters, "sort">,
): ReportRow[] {
  const query = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (query && !row.name.toLowerCase().includes(query)) return false;
    if (filters.type && row.type !== filters.type) return false;
    const narrowsByResult =
      filters.lag !== null || filters.vuln !== null || filters.status !== null;
    if (!narrowsByResult) return true;
    // Pending rows have nothing to match yet.
    const { result } = row;
    if (result === null) return false;
    if (filters.status === "unchecked") {
      return !result.checked || result.status === null;
    }
    if (!result.checked) return false;
    if (filters.status && result.status !== filters.status) return false;
    // "major" covers "2 majors" too.
    if (filters.lag && result.lagKind !== filters.lag) return false;
    if (filters.vuln) {
      const vulnerable = result.vulnerabilities.length > 0;
      if (vulnerable !== (filters.vuln === "yes")) return false;
    }
    return true;
  });
}

const columnBySortKey = Object.fromEntries(
  Object.entries(SORT_KEYS).map(([column, key]) => [key, column]),
) as Record<SortKey, keyof typeof SORT_KEYS>;

/** `sort` from the URL as TanStack sorting state; empty = default order. */
export function sortingFromUrl(sort: Filters["sort"]): SortingState {
  if (sort === null) return [];
  const desc = sort.startsWith("-");
  const key = (desc ? sort.slice(1) : sort) as SortKey;
  return [{ id: columnBySortKey[key], desc }];
}

export function sortingToUrl(sorting: SortingState): Filters["sort"] {
  const [first] = sorting;
  if (!first || !(first.id in SORT_KEYS)) return null;
  const key = SORT_KEYS[first.id as keyof typeof SORT_KEYS];
  return first.desc ? `-${key}` : key;
}
