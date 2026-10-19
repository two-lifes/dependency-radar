import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PackageStatus as CheckedStatus } from "@/server/analysis/package-status";
import type { Severity } from "@/server/analysis/severity";
import type { Lag as LagResult } from "@/server/analysis/version-lag";

// Colors per style guide §3 / screens.md §6.

export type Lag = LagResult["kind"];
export type { Severity };
export type PackageStatus = CheckedStatus | "unchecked";

const lagTone: Record<Lag, BadgeTone> = {
  current: "success",
  patch: "neutral",
  minor: "warning",
  major: "danger",
};

export function LagBadge({
  lag,
  majorsBehind = 1,
}: {
  lag: Lag;
  /** Only read for `major`: 2+ renders "N majors" (screens 5.5). */
  majorsBehind?: number;
}) {
  const label =
    lag === "current"
      ? "up to date"
      : lag === "major" && majorsBehind > 1
        ? `${majorsBehind} majors`
        : lag;
  return <Badge tone={lagTone[lag]}>{label}</Badge>;
}

const severityTone: Record<Severity, BadgeTone> = {
  critical: "critical",
  high: "danger",
  moderate: "moderate",
  low: "neutral",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={severityTone[severity]}>{severity}</Badge>;
}

const statusTone: Record<PackageStatus, BadgeTone> = {
  active: "neutral",
  stale: "warning",
  deprecated: "danger",
  unchecked: "neutral",
};

export function PackageStatusBadge({
  status,
  reason,
}: {
  status: PackageStatus;
  /** Why the package couldn't be checked; shown in a tooltip for `unchecked`. */
  reason?: string;
}) {
  if (status !== "unchecked") {
    return <Badge tone={statusTone[status]}>{status}</Badge>;
  }
  const badge = (
    <Badge tone={statusTone.unchecked} dashed>
      not checked
    </Badge>
  );
  if (!reason) return badge;
  return (
    <Tooltip>
      {/* The badge is a span, so the trigger is a button to make the reason reachable by keyboard. */}
      <TooltipTrigger className="rounded-full">{badge}</TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
