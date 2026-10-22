import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { toPackageRowJson } from "@/server/check/package-row";
import { previousRowsFor, summarizeRows } from "@/server/check/report-view";
import { getDb } from "@/server/db/client";
import { getReportPage } from "@/server/db/report-page";
import { checkAgain, retry } from "./actions";
import { CheckBanner, CheckFailed, CheckProgress } from "./check-status";
import { checkFailureCopy } from "./copy";
import { FirstCheckStarter } from "./first-check-starter";
import { PackageCard } from "./package-card";
import { ProjectSavedToast } from "./project-saved-toast";
import { ReportProvider } from "./report-context";
import {
  ReportHeader,
  type ReportHeaderMode,
  type ReportSource,
} from "./report-header";
import { ReportSummary, ReportSummarySkeleton } from "./report-summary";
import { ReportTabs } from "./report-tabs";
import { reportWarningCopy } from "./warning-copy";

export type ReportViewMode =
  | { kind: "guest"; signedIn: boolean }
  | { kind: "project"; projectId: string; name: string };

/**
 * screens 5.4: everything above the tab content, plus the live state. The
 * guest report and a project's report differ only in `mode`.
 */
export async function ReportView({
  reportId,
  mode,
  children,
}: {
  reportId: string;
  mode: ReportViewMode;
  children: ReactNode;
}) {
  const data = await getReportPage(getDb(), reportId);
  if (!data) notFound();
  const { report, check, previous } = data;
  const now = new Date();
  const basePath =
    mode.kind === "project" ? `/projects/${mode.projectId}` : `/r/${report.id}`;
  const headerMode: ReportHeaderMode =
    mode.kind === "project"
      ? { kind: "project", settingsHref: `${basePath}/settings` }
      : { kind: "guest", signedIn: mode.signedIn };

  const running = check?.status === "running";
  const previousRows = previous
    ? previousRowsFor(previous.rows, report.dependencies)
    : [];
  // During "Check again" the previous results stay on screen until `done`;
  // during the first check there is nothing to summarize yet.
  const shown = running ? previous : check;
  const shownRows = running ? previousRows : check?.rows;
  const summary =
    shown && shownRows
      ? summarizeRows(shownRows, report.dependencies.length)
      : undefined;
  // A guest report always gets its first check with it (createGuestReport),
  // so no check there means something broke; "Try again" starts one. A
  // project may have none yet (imported) and starts it on opening.
  const startFirst = mode.kind === "project" && !check;
  const failed = !startFirst && (!check || check.status === "failed");

  const source: ReportSource =
    report.source === "github" && report.repoUrl
      ? { kind: "github", url: report.repoUrl }
      : { kind: report.source === "upload" ? "upload" : "paste" };

  return (
    // grid-cols-1 is minmax(0, 1fr): an implicit `auto` column would grow to
    // the min-content width of the scrolling tile strip on mobile.
    <main className="mx-auto grid max-w-320 grid-cols-1 gap-6 px-4 pt-8 pb-16 sm:px-6">
      <ReportProvider
        key={`${check?.id}:${check?.status}`}
        reportId={report.id}
        guest={mode.kind === "guest"}
        checkId={check?.id}
        running={running}
        packageManager={report.packageManager}
        totalPackages={check?.totalPackages ?? report.dependencies.length}
        dependencies={report.dependencies}
        previousRows={previousRows.map(toPackageRowJson)}
        currentRows={check?.rows.map(toPackageRowJson) ?? []}
      >
        <ReportHeader
          reportId={report.id}
          mode={headerMode}
          name={mode.kind === "project" ? mode.name : report.name}
          source={source}
          checkedAt={shown?.finishedAt?.toISOString() ?? null}
          expiresAt={report.expiresAt?.toISOString() ?? null}
          warnings={report.warnings.map((code) => reportWarningCopy[code])}
        />
        <CheckProgress />
        {check?.status === "partial" || check?.status === "cancelled" ? (
          <CheckBanner
            status={check.status}
            checkId={check.id}
            sourceFailures={summary?.sourceFailures ?? 0}
            basePath={basePath}
          />
        ) : null}

        {startFirst ? (
          <FirstCheckStarter reportId={report.id} />
        ) : failed ? (
          <CheckFailed
            reason={checkFailureCopy[check?.failureReason ?? "internal-error"](
              check?.retryAt ?? null,
              now,
            )}
            onTryAgain={
              check
                ? retry.bind(null, check.id)
                : checkAgain.bind(null, report.id)
            }
          />
        ) : (
          <>
            {summary ? (
              <ReportSummary
                score={summary.score}
                counts={summary.counts}
                basePath={basePath}
              />
            ) : (
              <ReportSummarySkeleton />
            )}
            <ReportTabs
              basePath={basePath}
              dependencies={report.dependencies.length}
              vulnerabilities={summary?.counts.vulnerabilities ?? null}
            />
            {children}
          </>
        )}
        <PackageCard />
        {mode.kind === "project" ? <ProjectSavedToast /> : null}
      </ReportProvider>
    </main>
  );
}
