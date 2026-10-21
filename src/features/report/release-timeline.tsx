import { formatFullDate } from "@/lib/format-time";
import { cn } from "@/lib/cn";
import type { TimelineRelease } from "@/server/analysis/release-timeline";
import { reportCopy } from "./copy";

const copy = reportCopy.card;

/**
 * screens 5.9: dots from the current release to the latest one; majors are
 * larger and red (spec 7.2). The dots are decoration for pointer users (a
 * native title each); screen readers get the summary line.
 */
export function ReleaseTimeline({
  releases,
}: {
  releases: readonly TimelineRelease[];
}) {
  const majors = releases.filter((release) => release.major).length;
  return (
    <div className="grid gap-2">
      <div aria-hidden="true" className="relative mx-1.5 h-3">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        <span className="absolute top-1/2 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-muted-foreground bg-card" />
        {releases.map((release) => (
          <span
            key={release.version}
            title={copy.releasePoint(
              release.version,
              release.publishedAt
                ? formatFullDate(new Date(release.publishedAt))
                : null,
              release.major,
            )}
            className={cn(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
              release.major ? "size-3 bg-danger" : "size-2 bg-muted-foreground",
            )}
            style={{ left: `${release.position * 100}%` }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {copy.releases(releases.length, majors)}
      </p>
    </div>
  );
}
