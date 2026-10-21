import { formatFullDate } from "@/lib/format-time";
import { cn } from "@/lib/cn";
import type { TimelineRelease } from "@/server/analysis/release-timeline";
import { reportCopy } from "./copy";

const copy = reportCopy.card;

/**
 * screens 5.9: dots from the current release to the latest one; majors are
 * larger, and every possibly breaking release is red (spec 7.2): majors and
 * the minors `flagged` by their release notes. The dots are decoration for
 * pointer users (a native title each); screen readers get the summary line.
 */
export function ReleaseTimeline({
  releases,
  flagged,
}: {
  releases: readonly TimelineRelease[];
  flagged: ReadonlySet<string>;
}) {
  const majors = releases.filter((release) => release.major).length;
  const flaggedMinors = releases.filter(
    (release) => !release.major && flagged.has(release.version),
  ).length;
  return (
    <div className="grid gap-2">
      <div aria-hidden="true" className="relative mx-1.5 h-3">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        <span className="absolute top-1/2 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-muted-foreground bg-card" />
        {releases.map((release) => {
          const breaking = release.major || flagged.has(release.version);
          return (
            <span
              key={release.version}
              data-breaking={breaking || undefined}
              title={copy.releasePoint(
                release.version,
                release.publishedAt
                  ? formatFullDate(new Date(release.publishedAt))
                  : null,
                release.major,
                breaking,
              )}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                release.major ? "size-3" : "size-2",
                breaking ? "bg-danger" : "bg-muted-foreground",
              )}
              style={{ left: `${release.position * 100}%` }}
            />
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {copy.releases(releases.length, majors, flaggedMinors)}
      </p>
    </div>
  );
}
