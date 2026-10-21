"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CircleCheck,
  SearchX,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { LagBadge, PackageStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { maxSeverity, type Severity } from "@/server/analysis/severity";
import type { PackageRowJson } from "@/server/check/package-row";
import { reportCopy, uncheckedReasonCopy } from "./copy";
import { DependencyToolbar } from "./dependency-toolbar";
import {
  filterRows,
  hasActiveFilters,
  sortingFromUrl,
  sortingToUrl,
} from "./filters";
import { RelativeTime } from "./relative-time";
import { useReport } from "./report-context";
import type { ReportRow } from "./report-rows";
import {
  compareNames,
  compareVulnerabilityRank,
  defaultOrder,
  lagRank,
  releasedAt,
  vulnerabilityRank,
} from "./row-order";
import { useReportFilters } from "./use-report-filters";

const copy = reportCopy.table;

// Module scope: new features or columns on every render would rebuild the
// row model.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const helper = createColumnHelper<typeof features, ReportRow>();

const compareNumbers = (a: number | undefined, b: number | undefined) =>
  (a ?? 0) - (b ?? 0);

const columns = helper.columns([
  helper.accessor("name", {
    header: copy.package,
    sortFn: (a, b) => compareNames(a.original.name, b.original.name),
    cell: (info) => <PackageCell row={info.row.original} />,
  }),
  helper.display({
    id: "current",
    header: copy.current,
    cell: (info) => (
      <Version row={info.row.original} value={(r) => r.current} />
    ),
  }),
  helper.display({
    id: "latest",
    header: copy.latest,
    cell: (info) => <Version row={info.row.original} value={(r) => r.latest} />,
  }),
  // The accessors return undefined for pending and unchecked rows, which
  // `sortUndefined: "last"` keeps at the bottom in both directions.
  helper.accessor(lagRank, {
    id: "behind",
    header: copy.behind,
    sortUndefined: "last",
    sortFn: (a, b) => compareNumbers(lagRank(a.original), lagRank(b.original)),
    cell: (info) => <BehindCell row={info.row.original} />,
  }),
  helper.accessor(vulnerabilityRank, {
    id: "vulnerabilities",
    header: copy.vulnerabilities,
    sortUndefined: "last",
    sortFn: (a, b) => {
      const rankA = vulnerabilityRank(a.original);
      const rankB = vulnerabilityRank(b.original);
      return rankA && rankB ? compareVulnerabilityRank(rankA, rankB) : 0;
    },
    cell: (info) => <VulnerabilitiesCell row={info.row.original} />,
  }),
  helper.accessor(releasedAt, {
    id: "released",
    header: copy.released,
    sortUndefined: "last",
    sortFn: (a, b) =>
      compareNumbers(releasedAt(a.original), releasedAt(b.original)),
    cell: (info) => <ReleasedCell row={info.row.original} />,
  }),
  helper.display({
    id: "status",
    header: copy.status,
    cell: (info) => <StatusCell row={info.row.original} />,
  }),
]);

/**
 * screens 5.5: rows fill in as the check streams results; search, filters and
 * sort live in the URL.
 */
export function DependencyTable({
  saveHint = false,
}: {
  /** Guest reports add "Save project to get notified…" to "All up to date". */
  saveHint?: boolean;
}) {
  const { rows, running } = useReport();
  const filterState = useReportFilters();
  const { filters, appliedQuery, setFilters, clear } = filterState;
  const { type, lag, vuln, status } = filters;
  // The search applies after the typing delay, the menus at once.
  const applied = useMemo(
    () => ({ q: appliedQuery, type, lag, vuln, status, sort: null }),
    [appliedQuery, type, lag, vuln, status],
  );
  const filtering = hasActiveFilters(applied);
  // An empty sorting state shows this order (screens 5.5 default).
  const ordered = useMemo(() => defaultOrder(rows), [rows]);
  const data = useMemo(() => filterRows(ordered, applied), [ordered, applied]);
  const sorting = useMemo(() => sortingFromUrl(filters.sort), [filters.sort]);
  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.name,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      void setFilters({ sort: sortingToUrl(next) });
    },
    // screens 5.5: a repeated click only flips the direction.
    enableSortingRemoval: false,
    enableMultiSort: false,
    sortDescFirst: false,
  });

  const allUpToDate =
    !filtering &&
    !running &&
    rows.length > 0 &&
    rows.every(
      ({ result }) =>
        result?.checked === true &&
        result.lagKind === "current" &&
        result.vulnerabilities.length === 0,
    );
  if (allUpToDate) {
    return (
      <EmptyState icon={<CircleCheck aria-hidden className="text-success" />}>
        <p className="text-base font-medium">
          {reportCopy.empty.allUpToDate(rows.length)}
        </p>
        {saveHint ? (
          <p className="text-base text-muted-foreground">
            {reportCopy.empty.saveToGetNotified}
          </p>
        ) : null}
      </EmptyState>
    );
  }

  return (
    <section className="grid gap-3">
      <DependencyToolbar
        state={filterState}
        shown={data.length}
        total={rows.length}
      />
      {data.length === 0 && filtering ? (
        <EmptyState
          icon={<SearchX aria-hidden className="text-muted-foreground" />}
        >
          <p className="text-base font-medium">{reportCopy.empty.noMatches}</p>
          <Button variant="secondary" size="sm" onClick={clear}>
            {reportCopy.empty.clearFilters}
          </Button>
        </EmptyState>
      ) : (
        // relative: sr-only cells are absolute and would otherwise widen the page.
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-base">
            <caption className="sr-only">{copy.caption}</caption>
            <thead className="bg-subtle">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          !canSort
                            ? undefined
                            : sorted === "asc"
                              ? "ascending"
                              : sorted === "desc"
                                ? "descending"
                                : "none"
                        }
                        className="h-9 px-4 text-xs font-medium whitespace-nowrap text-muted-foreground"
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 hover:text-foreground",
                              sorted && "text-foreground",
                            )}
                          >
                            <table.FlexRender header={header} />
                            <SortIcon sorted={sorted} />
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const { result, updatedAt } = row.original;
                return (
                  <tr
                    // A new key replays the highlight when a result arrives.
                    key={`${row.id}:${updatedAt ?? ""}`}
                    aria-busy={result === null || undefined}
                    className={cn(
                      "h-10 border-t border-border",
                      updatedAt !== undefined && "animate-row-flash",
                    )}
                  >
                    {row.getAllCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-1.5 whitespace-nowrap"
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EmptyState({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid justify-items-center gap-3 rounded-xl border border-border bg-card px-4 py-12 text-center [&>svg]:size-5">
      {icon}
      {children}
    </section>
  );
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-3", !sorted && "text-muted-foreground/60")}
    />
  );
}

function PackageCell({ row }: { row: ReportRow }) {
  const pending = row.result === null;
  return (
    <div className="flex items-center gap-2">
      <div className="grid min-w-0">
        <span
          className={cn(
            "truncate font-mono text-sm",
            pending ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {row.name}
        </span>
        {row.type === "dev" ? (
          <span className="text-xs text-muted-foreground">{copy.dev}</span>
        ) : null}
      </div>
      {pending ? <span className="sr-only">{copy.pending}</span> : null}
      {row.result?.status === "deprecated" ? (
        <Tooltip>
          {/* A button so the deprecation message is reachable by keyboard. */}
          <TooltipTrigger className="rounded-sm text-danger">
            <Ban aria-hidden="true" className="size-3.5" />
            <span className="sr-only">{copy.deprecated}</span>
          </TooltipTrigger>
          <TooltipContent>
            {row.result.deprecationMessage ?? copy.deprecated}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

/**
 * Pending rows show a skeleton, unchecked rows and missing values a dash;
 * `render` gets only a checked result.
 */
function CheckedCell({
  row,
  render,
}: {
  row: ReportRow;
  render: (result: PackageRowJson) => ReactNode;
}) {
  if (row.result === null) return <Skeleton className="h-3 w-12" />;
  if (!row.result.checked) return <Empty />;
  return render(row.result) ?? <Empty />;
}

function Empty() {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">{copy.none}</span>
      <span className="sr-only">{copy.noneLabel}</span>
    </span>
  );
}

function Version({
  row,
  value,
}: {
  row: ReportRow;
  value: (result: PackageRowJson) => string | null;
}) {
  return (
    <CheckedCell
      row={row}
      render={(result) => {
        const version = value(result);
        return version === null ? null : (
          <span className="font-mono text-sm">{version}</span>
        );
      }}
    />
  );
}

function BehindCell({ row }: { row: ReportRow }) {
  return (
    <CheckedCell
      row={row}
      render={(result) =>
        result.lagKind === null ? null : (
          <LagBadge
            lag={result.lagKind}
            majorsBehind={result.lagMajors ?? undefined}
          />
        )
      }
    />
  );
}

const severityText: Record<Severity, string> = {
  critical: "text-critical",
  high: "text-danger",
  moderate: "text-moderate",
  low: "text-muted-foreground",
};

function VulnerabilitiesCell({ row }: { row: ReportRow }) {
  return (
    <CheckedCell
      row={row}
      render={({ vulnerabilities }) => {
        const highest = maxSeverity(vulnerabilities.map((v) => v.severity));
        if (highest === undefined) return null;
        return (
          <span
            className={cn("font-medium tabular-nums", severityText[highest])}
          >
            {vulnerabilities.length}
            <span className="sr-only">{copy.highestSeverity(highest)}</span>
          </span>
        );
      }}
    />
  );
}

function ReleasedCell({ row }: { row: ReportRow }) {
  return (
    <CheckedCell
      row={row}
      render={({ lastReleaseAt }) =>
        lastReleaseAt === null ? null : (
          <span className="text-sm text-muted-foreground">
            <RelativeTime iso={lastReleaseAt} />
          </span>
        )
      }
    />
  );
}

function StatusCell({ row }: { row: ReportRow }) {
  const { result } = row;
  if (result === null) return <Skeleton className="h-3 w-12" />;
  if (!result.checked || result.status === null) {
    return (
      <PackageStatusBadge
        status="unchecked"
        reason={result.reason ? uncheckedReasonCopy[result.reason] : undefined}
      />
    );
  }
  return <PackageStatusBadge status={result.status} />;
}
