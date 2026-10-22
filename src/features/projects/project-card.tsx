"use client";

import {
  FileJson,
  GitBranch,
  MoreHorizontal,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import type { DashboardProject } from "@/server/analysis/dashboard-card";
import { type ScoreBand, scoreBand } from "@/server/analysis/health-score";
import { tooManyChecks } from "../check/copy";
import { demoCopy } from "../demo/copy";
import { RelativeTime } from "../report/relative-time";
import type { DisplayStatus } from "./check-queue";
import { projectsCopy } from "./copy";

const copy = projectsCopy.card;

// spec 7.1, style guide §3: the same colours as the report's score circle.
const bandColor: Record<ScoreBand, string> = {
  good: "text-success",
  fair: "text-warning",
  poor: "text-danger",
};

/**
 * screens 5.10: one project. The name's link covers the whole card; the
 * "⋯" menu and the date tooltip sit above it, since interactive elements
 * can't nest inside a link.
 */
export function ProjectCard({
  project,
  status,
  onCheckNow,
  onDelete,
  demo = false,
}: {
  project: DashboardProject;
  status: DisplayStatus;
  onCheckNow: () => void;
  onDelete: () => void;
  /** The shared demo account can't delete projects (plan.md 25). */
  demo?: boolean;
}) {
  const { result } = project;
  const score = result?.score ?? null;
  const vulnerabilities = result?.vulnerabilityCount ?? null;
  const SourceIcon = project.source === "github" ? GitBranch : FileJson;
  const checking = status.kind === "checking";

  return (
    <article className="relative grid gap-4 rounded-xl border border-border bg-card p-4 transition-colors duration-150 ease-out hover:bg-subtle has-focus-visible:border-ring sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="grid min-w-0 gap-1">
          <h2 className="truncate text-md font-semibold tracking-tight">
            <Link
              href={`/projects/${project.id}/dependencies`}
              className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            >
              {project.name}
            </Link>
          </h2>
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <SourceIcon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {project.source === "github" && project.repoUrl
                ? project.repoUrl.replace(/^https:\/\//, "")
                : copy.source[project.source === "upload" ? "upload" : "paste"]}
            </span>
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={copy.actions(project.name)}
              className="relative z-10 -mt-1 -mr-2"
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={checking || status.kind === "queued"}
              onSelect={onCheckNow}
            >
              <RefreshCw aria-hidden />
              {copy.checkNow}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/projects/${project.id}/settings`}>
                <Settings aria-hidden />
                {copy.settings}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={demo}
              onSelect={onDelete}
            >
              <Trash2 aria-hidden />
              {demo ? (
                <span className="grid">
                  {copy.delete}
                  <span className="text-xs text-muted-foreground">
                    {demoCopy.unavailable}
                  </span>
                </span>
              ) : (
                copy.delete
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* W4 wireframe: the score, and beside it the findings and the date. */}
      <div className="flex items-center gap-4">
        <p className="grid min-w-12">
          <span
            className={cn(
              "text-xl font-semibold tabular-nums",
              score === null
                ? "text-muted-foreground"
                : bandColor[scoreBand(score)],
            )}
          >
            {score ?? "—"}
          </span>
          <span className="text-xs text-muted-foreground">
            {score === null ? copy.noScore : copy.score}
          </span>
        </p>
        <div className="grid min-w-0 gap-0.5 text-sm">
          {vulnerabilities !== null ? (
            <p
              className={
                (result?.severeVulnerableCount ?? 0) > 0
                  ? "font-medium text-danger"
                  : "text-muted-foreground"
              }
            >
              {copy.vulnerabilities(vulnerabilities)}
            </p>
          ) : null}
          <p className="text-muted-foreground" aria-live="polite">
            <StatusText status={status} />
          </p>
        </div>
      </div>
    </article>
  );
}

function StatusText({ status }: { status: DisplayStatus }) {
  switch (status.kind) {
    case "checked":
      return (
        <>
          {copy.checked}{" "}
          <span className="relative z-10">
            <RelativeTime iso={status.at.toISOString()} />
          </span>
        </>
      );
    case "checking":
      return (
        <span className="text-brand-text">{copy.checking(status.percent)}</span>
      );
    case "queued":
      return <>{copy.queued}</>;
    case "limited":
      return (
        <span className="text-warning">
          {tooManyChecks(status.retryAfterSeconds)}
        </span>
      );
    case "failed":
      return <span className="text-danger">{copy.failed}</span>;
  }
}
