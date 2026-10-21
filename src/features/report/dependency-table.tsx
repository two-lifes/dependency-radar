"use client";

import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { reportCopy } from "./copy";
import { useReport } from "./report-context";
import type { ReportRow } from "./report-rows";

const copy = reportCopy.table;

// Module scope: new features or columns on every render would rebuild the
// row model. Task 13 adds the remaining columns of screens 5.5 and sorting.
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ReportRow>();
const columns = helper.columns([
  helper.accessor("name", {
    header: copy.package,
    cell: (info) => <PackageCell row={info.row.original} />,
  }),
]);

/** screens 5.5: rows fill in as the check streams results. */
export function DependencyTable() {
  const { rows } = useReport();
  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.name,
  });
  const ready = rows.filter((row) => row.result !== null).length;

  return (
    <section className="grid gap-2">
      <p
        className="justify-self-end text-sm text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {copy.ready(ready, rows.length)}
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-base">
          <caption className="sr-only">{copy.caption}</caption>
          <thead className="bg-subtle">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="h-9 px-4 text-xs font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
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
                    <td key={cell.id} className="px-4 py-1.5">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PackageCell({ row }: { row: ReportRow }) {
  const pending = row.result === null;
  return (
    <div className="flex items-center gap-4">
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
      {pending ? (
        <>
          <span className="sr-only">{copy.pending}</span>
          <Skeleton className="h-3 max-w-xl flex-1" />
        </>
      ) : null}
    </div>
  );
}
