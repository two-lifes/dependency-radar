import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { HealthScore as Score } from "@/server/analysis/health-score";
import type { ReportCounts } from "@/server/analysis/report-counts";
import { reportCopy } from "./copy";
import { HealthScore } from "./health-score";
import { SummaryTile, type TileFilter } from "./summary-tile";

const copy = reportCopy.tiles;

/**
 * screens 5.4 summary: score circle and five counter tiles. Below 768px the
 * circle gets its own row and the tiles shrink to fit one row without
 * scrolling: number first, a short label, the severity line under the row.
 */
export function ReportSummary({
  score,
  counts,
  basePath,
}: {
  score: Score;
  counts: ReportCounts;
  basePath: string;
}) {
  const severity = copy.bySeverity(
    counts.vulnerableBySeverity.critical,
    counts.vulnerableBySeverity.high,
  );
  const tiles: {
    label: string;
    short?: string;
    value: number;
    color: string;
    detail?: string;
    filter: TileFilter;
  }[] = [
    {
      label: copy.upToDate,
      value: counts.upToDate,
      color: "text-success",
      filter: { key: "lag", value: "current" },
    },
    {
      label: copy.patch,
      short: copy.short.patch,
      value: counts.patch,
      color: "text-neutral-badge",
      filter: { key: "lag", value: "patch" },
    },
    {
      label: copy.minor,
      short: copy.short.minor,
      value: counts.minor,
      color: "text-warning",
      filter: { key: "lag", value: "minor" },
    },
    {
      label: copy.major,
      short: copy.short.major,
      value: counts.major,
      color: "text-danger",
      filter: { key: "lag", value: "major" },
    },
    {
      label: copy.vulnerable,
      value: counts.vulnerable,
      color: "text-danger",
      detail: severity,
      filter: { key: "vuln", value: "yes" },
    },
  ];

  return (
    <section
      aria-label={reportCopy.score.label}
      className="grid gap-3 md:flex md:items-center md:gap-6"
    >
      <HealthScore score={score} />
      <div className="grid gap-1 md:flex-1">
        <ul className="grid grid-cols-5 gap-1 md:gap-4">
          {tiles.map((tile) => (
            <li key={tile.label} className="grid">
              <SummaryTile
                basePath={basePath}
                filter={tile.filter}
                className="grid content-start gap-0.5 rounded-lg border border-border bg-card px-0.5 py-2 text-center md:gap-1 md:p-4 md:text-left"
              >
                <span className="text-xs leading-tight font-medium text-muted-foreground max-md:order-last max-md:tracking-tight">
                  {tile.short ? (
                    <>
                      <span className="md:hidden">{tile.short}</span>
                      <span className="max-md:hidden">{tile.label}</span>
                    </>
                  ) : (
                    tile.label
                  )}
                </span>
                <span
                  className={cn(
                    "text-lg font-semibold tracking-tight tabular-nums md:text-xl",
                    tile.color,
                  )}
                >
                  {tile.value}
                </span>
                {tile.detail ? (
                  <span className="text-xs font-medium text-danger max-md:hidden">
                    {tile.detail}
                  </span>
                ) : null}
              </SummaryTile>
            </li>
          ))}
        </ul>
        {severity ? (
          <p className="text-right text-xs font-medium text-danger md:hidden">
            {severity}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** First check: the summary has nothing to show until the check ends. */
export function ReportSummarySkeleton() {
  return (
    <div aria-hidden className="grid gap-3 md:flex md:items-center md:gap-6">
      <Skeleton className="size-20 shrink-0 rounded-full" />
      <div className="grid grid-cols-5 gap-1 md:flex-1 md:gap-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg md:h-21" />
        ))}
      </div>
    </div>
  );
}
