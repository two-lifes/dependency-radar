import { Skeleton } from "@/components/ui/skeleton";
import { ReportSummarySkeleton } from "./report-summary";

const ROWS = 10;

/** screens 5.4 first load: header, summary and ten table rows. */
export function ReportSkeleton() {
  return (
    <main
      aria-busy="true"
      className="mx-auto grid max-w-320 grid-cols-1 gap-6 px-4 pt-8 pb-16 sm:px-6"
    >
      <div aria-hidden className="flex items-start justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <ReportSummarySkeleton />
      <Skeleton className="h-10 w-72" />
      <div
        aria-hidden
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="h-9 bg-subtle" />
        {Array.from({ length: ROWS }, (_, i) => (
          <div
            key={i}
            className="flex h-10 items-center border-t border-border px-4"
          >
            <Skeleton className="h-3 w-full max-w-xl" />
          </div>
        ))}
      </div>
    </main>
  );
}
