"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { LagBadge, PackageStatusBadge } from "@/components/status-badges";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { maxSeverity } from "@/server/analysis/severity";
import { reportCopy, uncheckedReasonCopy } from "./copy";
import {
  type PackageOpener,
  rowOpenHandlers,
  type Selection,
} from "./dependency-table";
import type { ReportRow } from "./report-rows";
import { severityText } from "./severity-text";

const copy = reportCopy.table;

/** Card height before measuring. */
const ESTIMATED_CARD_HEIGHT = 92;

/**
 * screens 5.5 < 768px: name and lag, "current → latest", then vulnerabilities
 * and status. Long lists scroll with the page, so the window is the scroller.
 */
export function DependencyCards({
  rows,
  selection,
  opener,
  virtual,
}: {
  rows: readonly ReportRow[];
  selection: Selection;
  opener: PackageOpener;
  virtual: boolean;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  // Rows start below the header and summary; measured once laid out.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!virtual || !list) return;
    setScrollMargin(list.getBoundingClientRect().top + window.scrollY);
  }, [virtual]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    getItemKey: (index) => rows[index]?.name ?? index,
    overscan: 5,
    scrollMargin,
    enabled: virtual,
  });
  const items = virtual ? virtualizer.getVirtualItems() : null;
  // Item starts include the scroll margin; the spacers are relative to the list.
  const padTop = items?.[0] ? items[0].start - scrollMargin : 0;
  const padBottom = items
    ? virtualizer.getTotalSize() - ((items.at(-1)?.end ?? 0) - scrollMargin)
    : 0;
  const shown = items
    ? items.flatMap((item) => {
        const row = rows[item.index];
        return row ? [{ row, index: item.index }] : [];
      })
    : rows.map((row, index) => ({ row, index }));

  return (
    <ul
      ref={listRef}
      aria-label={copy.packages}
      className="divide-y divide-border rounded-xl border border-border bg-card"
      style={virtual ? { paddingTop: padTop, paddingBottom: padBottom } : {}}
    >
      {shown.map(({ row, index }) => (
        <li
          key={`${row.name}:${row.updatedAt ?? ""}`}
          {...rowOpenHandlers(row.name, opener)}
          ref={virtual ? virtualizer.measureElement : undefined}
          data-index={index}
          aria-busy={row.result === null || undefined}
          className={cn(
            // style guide 5: the open package gets a 2px brand bar on the left.
            "grid min-w-0 cursor-pointer gap-1.5 border-l-2 py-4 pr-4 pl-3.5 focus-visible:-outline-offset-2",
            opener.open === row.name
              ? "border-l-brand"
              : "border-l-transparent",
            selection.has(row.name) && "bg-accent",
            row.updatedAt !== undefined && "animate-row-flash",
          )}
        >
          <Card row={row} selection={selection} />
        </li>
      ))}
    </ul>
  );
}

function Card({ row, selection }: { row: ReportRow; selection: Selection }) {
  const { result } = row;
  const pending = result === null;
  return (
    <>
      <div className="flex items-center gap-3">
        <Checkbox
          aria-label={copy.select(row.name)}
          checked={selection.has(row.name)}
          onCheckedChange={(checked) =>
            selection.toggle(row.name, checked === true)
          }
        />
        <div className="grid min-w-0 flex-1">
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
            <Skeleton className="h-5 w-14" />
          </>
        ) : result.checked && result.lagKind !== null ? (
          <LagBadge
            lag={result.lagKind}
            majorsBehind={result.lagMajors ?? undefined}
          />
        ) : null}
      </div>
      <div className="pl-7">
        {pending ? (
          <Skeleton className="h-3 w-28" />
        ) : result.checked && result.current !== null ? (
          <p className="flex flex-wrap items-center gap-1.5 font-mono text-sm wrap-anywhere text-muted-foreground">
            <span className="min-w-0">{result.current}</span>
            {result.latest !== null && result.latest !== result.current ? (
              <>
                <ArrowRight
                  aria-label={copy.to}
                  className="size-3.5 shrink-0"
                />
                <span className="min-w-0 text-foreground">{result.latest}</span>
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            <span aria-hidden="true">{copy.none}</span>
            <span className="sr-only">{copy.noneLabel}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 pl-7">
        {pending ? (
          <Skeleton className="h-3 w-20" />
        ) : (
          <>
            <Vulnerabilities row={row} />
            {!result.checked || result.status === null ? (
              <PackageStatusBadge
                status="unchecked"
                reason={
                  result.reason ? uncheckedReasonCopy[result.reason] : undefined
                }
              />
            ) : (
              <PackageStatusBadge status={result.status} />
            )}
          </>
        )}
      </div>
    </>
  );
}

function Vulnerabilities({ row }: { row: ReportRow }) {
  const vulnerabilities = row.result?.checked ? row.result.vulnerabilities : [];
  const highest = maxSeverity(vulnerabilities.map((v) => v.severity));
  if (highest === undefined) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium tabular-nums",
        severityText[highest],
      )}
    >
      <ShieldAlert aria-hidden="true" className="size-4" />
      <span aria-hidden="true">{vulnerabilities.length}</span>
      <span className="sr-only">
        {copy.vulnerabilityCount(vulnerabilities.length)}
        {copy.highestSeverity(highest)}
      </span>
    </span>
  );
}
