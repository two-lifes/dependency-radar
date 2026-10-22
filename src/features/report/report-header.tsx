"use client";

import {
  ArrowUpRight,
  Info,
  Link2,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { formatDayMonth } from "@/lib/format-time";
import { checkAgain, saveReport } from "./actions";
import { reportCopy } from "./copy";
import { RelativeTime } from "./relative-time";
import { useReport } from "./report-context";
import { useReportAction } from "./use-report-action";

const copy = reportCopy;

export type ReportSource =
  { kind: "paste" | "upload" } | { kind: "github"; url: string };

export type ReportHeaderMode =
  | { kind: "guest"; signedIn: boolean }
  | { kind: "project"; settingsHref: string };

/**
 * screens 5.4 report header. Guest: "Save project", "Copy link", "Check
 * again"; project: "Check again", "Copy link", "Settings". On mobile all but
 * the first move into the "⋯" menu.
 */
export function ReportHeader({
  reportId,
  mode,
  name,
  source,
  checkedAt,
  expiresAt,
  warnings,
}: {
  reportId: string;
  mode: ReportHeaderMode;
  name: string | null;
  source: ReportSource;
  /** When the shown results were checked; null before the first check ends. */
  checkedAt: string | null;
  expiresAt: string | null;
  warnings: string[];
}) {
  const { running } = useReport();
  const [pending, run] = useReportAction();
  const checkDisabled = running || pending;
  const checkLabel =
    pending && source.kind === "github"
      ? copy.actions.fetchingRepository
      : copy.actions.checkAgain;

  const [saving, startSaving] = useTransition();
  // saveReport ends in a redirect to the project.
  const onSave = () => startSaving(() => saveReport(reportId));

  const onCheckAgain = () => run(() => checkAgain(reportId));
  const onCopyLink = async () => {
    try {
      // The current URL carries the open tab and its filters.
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: copy.actions.linkCopied });
    } catch {
      toast({ title: copy.actions.copyFailed });
    }
  };

  return (
    <header className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {name ?? copy.untitled}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {source.kind === "github" ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 rounded-sm hover:text-foreground"
              >
                {source.url.replace(/^https:\/\//, "")}
                <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            ) : (
              <span>{copy.source[source.kind]}</span>
            )}
            <span aria-hidden>·</span>
            {checkedAt ? (
              <span>
                {copy.checked} <RelativeTime iso={checkedAt} />
              </span>
            ) : (
              <span>{copy.checking}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {mode.kind === "project" ? (
            <Button disabled={checkDisabled} onClick={onCheckAgain}>
              {pending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw aria-hidden />
              )}
              {checkLabel}
            </Button>
          ) : mode.signedIn ? (
            <Button disabled={saving} onClick={onSave}>
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {saving ? copy.actions.saving : copy.actions.save}
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/login?next=/r/${reportId}/save`}>
                {copy.actions.save}
              </Link>
            </Button>
          )}
          <Button
            variant="secondary"
            className="max-md:hidden"
            onClick={onCopyLink}
          >
            <Link2 aria-hidden />
            {copy.actions.copyLink}
          </Button>
          {mode.kind === "project" ? (
            <Button
              asChild
              variant="secondary"
              size="icon"
              className="max-md:hidden"
            >
              <Link href={mode.settingsHref} aria-label={copy.actions.settings}>
                <Settings aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="max-md:hidden"
              disabled={checkDisabled}
              onClick={onCheckAgain}
            >
              {pending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw aria-hidden />
              )}
              {checkLabel}
            </Button>
          )}
          {/* < 768px secondary actions move into a menu (screens 5.4). */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                aria-label={copy.actions.more}
                className="md:hidden"
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onCopyLink}>
                <Link2 aria-hidden />
                {copy.actions.copyLink}
              </DropdownMenuItem>
              {mode.kind === "project" ? (
                <DropdownMenuItem asChild>
                  <Link href={mode.settingsHref}>
                    <Settings aria-hidden />
                    {copy.actions.settings}
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={checkDisabled}
                  onSelect={onCheckAgain}
                >
                  <RefreshCw aria-hidden />
                  {checkLabel}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {expiresAt ? (
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          {copy.expiresOn(formatDayMonth(new Date(expiresAt)))}
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="grid gap-1 text-sm text-muted-foreground">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-center gap-2">
              <Info
                className="size-4 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
