"use client";

import {
  Copy,
  ExternalLink,
  FolderGit2,
  Package,
  RotateCw,
} from "lucide-react";
import { useQueryStates } from "nuqs";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PackageStatusBadge, SeverityBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { Vulnerability } from "@/server/analysis/merge-vulnerabilities";
import { npmPageUrl } from "@/server/analysis/package-links";
import type { Result } from "@/server/analysis/result";
import type { PackageDetails } from "@/server/check/package-details";
import type { PackageRowJson } from "@/server/check/package-row";
import { reportCopy, uncheckedReasonCopy } from "./copy";
import { filterParsers } from "./filters";
import { getPackageDetails, type PackageDetailsError } from "./package-actions";
import { ReleaseTimeline } from "./release-timeline";
import { useReport } from "./report-context";
import type { ReportRow } from "./report-rows";
import { orderedRows } from "./row-order";
import { selectionCommand } from "./selection";
import { useOpenPackage } from "./use-open-package";
import { vulnerabilitySourceUrl } from "./vulnerability-list";

const copy = reportCopy.card;

/**
 * screens 5.9: the package card over the report, opened by `?pkg=`. What the
 * check stored (versions, vulnerabilities) shows at once; description,
 * license, links and the release scale load from npm's cached document.
 */
export function PackageCard() {
  const { rows } = useReport();
  const { pkg, switchPackage, closePackage, dropPackage } = useOpenPackage();
  const [filters] = useQueryStates(filterParsers);
  const row = pkg === null ? undefined : rows.find((r) => r.name === pkg);
  const missing = pkg !== null && row === undefined;

  // One toast per bad link, also under StrictMode's double effects.
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (!missing) {
      notified.current = null;
      return;
    }
    if (notified.current === pkg) return;
    notified.current = pkg;
    toast({ title: copy.notFound });
    dropPackage();
  }, [missing, pkg, dropPackage]);

  // `pkg` is already gone when the card finishes closing.
  const lastOpened = useRef<string | null>(null);
  useEffect(() => {
    if (row) lastOpened.current = row.name;
  }, [row]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      !row ||
      (event.key !== "j" && event.key !== "k") ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isTyping(event.target)
    ) {
      return;
    }
    const names = orderedRows(rows, filters).map((r) => r.name);
    const index = names.indexOf(row.name);
    // A package hidden by the filters (opened from Vulnerabilities): `j`
    // starts from the top of the table.
    const next =
      event.key === "j"
        ? names[index + 1]
        : index > 0
          ? names[index - 1]
          : undefined;
    if (next === undefined) return;
    event.preventDefault();
    switchPackage(next);
  };

  const onCloseAutoFocus = (event: Event) => {
    const name = lastOpened.current;
    const target = name === null ? undefined : visiblePackageElement(name);
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  return (
    <Sheet
      open={row !== undefined}
      onOpenChange={(open) => {
        if (!open) closePackage();
      }}
    >
      {row ? (
        <SheetContent
          side="end"
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <PackagePanel key={row.name} row={row} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function isTyping(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select") !== null)
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-border px-1.5 font-mono text-xs">
      {children}
    </kbd>
  );
}

/**
 * The table row (or the mobile card, or a "Details" button) of a package.
 * Both the table and the cards render; CSS hides one, so pick the visible.
 */
function visiblePackageElement(name: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>("[data-package]")].find(
    (element) =>
      element.dataset.package === name &&
      // jsdom has no checkVisibility; everything counts as visible there.
      (typeof element.checkVisibility !== "function" ||
        element.checkVisibility()),
  );
}

function PackagePanel({ row }: { row: ReportRow }) {
  const { reportId, guest, packageManager } = useReport();
  const details = usePackageDetails(reportId, row);
  const { result } = row;
  const registryName = result?.checked ? result.registryName : null;
  const command = selectionCommand([row], packageManager);

  const onCopy = async () => {
    if (command === null) return;
    try {
      await navigator.clipboard.writeText(command);
      toast({ title: copy.commandCopied, description: command });
    } catch {
      toast({ title: copy.copyFailed, description: command });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-1 border-b border-border py-3 pr-12 pl-4 md:pl-6">
        <SheetTitle className="min-w-0 flex-1 truncate pr-0 font-mono text-lg">
          {row.name}
        </SheetTitle>
        {registryName !== null ? (
          <IconLink
            href={npmPageUrl(registryName)}
            label={copy.npmLabel(registryName)}
            tooltip={copy.npm}
            icon={<Package aria-hidden />}
          />
        ) : null}
        {details.status === "done" && details.value.repositoryUrl !== null ? (
          <IconLink
            href={details.value.repositoryUrl}
            label={copy.repositoryLabel}
            tooltip={copy.repository}
            icon={<FolderGit2 aria-hidden />}
          />
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto p-4 md:p-6">
        <About details={details} />
        <Versions row={row} details={details} />
        {result?.checked ? (
          <Vulnerabilities vulnerabilities={result.vulnerabilities} />
        ) : result === null ? (
          <SectionSkeleton />
        ) : null}
      </div>

      <footer
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 md:px-6",
          // Only the shortcut hint is left, and phones have no keyboard.
          command === null && !guest && "hidden md:flex",
        )}
      >
        {command !== null ? (
          <Button variant="secondary" size="sm" onClick={onCopy}>
            <Copy aria-hidden />
            {copy.copyCommand}
          </Button>
        ) : null}
        {guest ? (
          <p className="text-sm text-muted-foreground">{copy.guestHint}</p>
        ) : null}
        <p className="hidden w-full items-center gap-1 text-xs text-muted-foreground md:flex">
          <Kbd>{copy.nextShortcut}</Kbd>
          <Kbd>{copy.previousShortcut}</Kbd>
          <span>{copy.nextPrevious} ·</span>
          <Kbd>{copy.closeShortcut}</Kbd>
          <span>{copy.close}</span>
        </p>
      </footer>
    </div>
  );
}

function IconLink({
  href,
  label,
  tooltip,
  icon,
}: {
  href: string;
  label: string;
  tooltip: string;
  icon: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" asChild>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
          >
            {icon}
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

type DetailsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "done"; value: PackageDetails };

/**
 * Loads once the row has a checked result: a pending row (first check) has
 * no registry name yet, an unchecked one has nothing to load.
 */
function usePackageDetails(reportId: string, row: ReportRow): DetailsState {
  const { name, result } = row;
  const key = result?.checked
    ? [result.registryName, result.current, result.latest].join("|")
    : null;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    attempt: number;
    result: Result<PackageDetails, PackageDetailsError>;
  } | null>(null);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    const settle = (outcome: Result<PackageDetails, PackageDetailsError>) => {
      if (!cancelled) setLoaded({ key, attempt, result: outcome });
    };
    getPackageDetails(reportId, name).then(settle, () =>
      // The action itself failed (network, server): same as a source failure.
      settle({ ok: false, error: "unavailable" }),
    );
    return () => {
      cancelled = true;
    };
  }, [reportId, name, key, attempt]);

  if (key === null) return { status: "idle" };
  if (loaded?.key !== key || loaded.attempt !== attempt) {
    return { status: "loading" };
  }
  return loaded.result.ok
    ? { status: "done", value: loaded.result.value }
    : { status: "error", retry: () => setAttempt((count) => count + 1) };
}

function About({ details }: { details: DetailsState }) {
  switch (details.status) {
    case "idle":
      return null;
    case "loading":
      return (
        <div aria-busy="true" aria-label={copy.loading} className="grid gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-20" />
        </div>
      );
    case "error":
      return (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{copy.detailsFailed}</p>
          <Button variant="secondary" size="sm" onClick={details.retry}>
            <RotateCw aria-hidden />
            {copy.retry}
          </Button>
        </div>
      );
    case "done":
      return (
        <div className="grid gap-2">
          {details.value.description !== null ? (
            <Description text={details.value.description} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {copy.noDescription}
            </p>
          )}
          <p className="text-sm">
            <span className="text-muted-foreground">{copy.license} </span>
            {details.value.license ?? copy.noLicense}
          </p>
        </div>
      );
  }
}

/** Two lines, and "Show more" only when the text is actually cut. */
function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const measure = useCallback((element: HTMLParagraphElement | null) => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setOverflowing(element.scrollHeight > element.clientHeight),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid justify-items-start gap-1">
      <p
        ref={measure}
        id="package-description"
        className={cn("text-base wrap-anywhere", !expanded && "line-clamp-2")}
      >
        {text}
      </p>
      {overflowing || expanded ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="package-description"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-sm text-sm text-brand-text underline-offset-4 hover:underline"
        >
          {expanded ? copy.showLess : copy.showMore}
        </button>
      ) : null}
    </div>
  );
}

function Versions({ row, details }: { row: ReportRow; details: DetailsState }) {
  const { result } = row;
  if (result === null) return <SectionSkeleton />;
  if (!result.checked || result.current === null || result.latest === null) {
    return <NotChecked result={result} />;
  }
  return (
    <section className="grid gap-3">
      <p className="text-sm">
        <span className="text-muted-foreground">{copy.current} </span>
        <span className="font-mono">{result.current}</span>
        <span aria-hidden="true" className="text-muted-foreground">
          {" · "}
        </span>
        <span className="text-muted-foreground">{copy.latest} </span>
        <span className="font-mono">{result.latest}</span>
      </p>
      {details.status === "loading" ? (
        <Skeleton className="h-3 w-full" />
      ) : details.status === "done" ? (
        details.value.releases.length > 0 ? (
          <ReleaseTimeline releases={details.value.releases} />
        ) : (
          <p className="text-xs text-muted-foreground">{copy.upToDate}</p>
        )
      ) : null}
    </section>
  );
}

function NotChecked({ result }: { result: PackageRowJson }) {
  return (
    <section className="flex flex-wrap items-center gap-2">
      <PackageStatusBadge
        status="unchecked"
        reason={result.reason ? uncheckedReasonCopy[result.reason] : undefined}
      />
      {result.reason ? (
        <p className="text-sm text-muted-foreground">
          {uncheckedReasonCopy[result.reason]}
        </p>
      ) : null}
    </section>
  );
}

function Vulnerabilities({
  vulnerabilities,
}: {
  vulnerabilities: readonly Vulnerability[];
}) {
  return (
    <section aria-labelledby="package-vulnerabilities" className="grid gap-2">
      <h3 id="package-vulnerabilities" className="text-sm font-semibold">
        {copy.vulnerabilities(vulnerabilities.length)}
      </h3>
      {vulnerabilities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {copy.noVulnerabilities}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {vulnerabilities.map((vulnerability) => (
            <VulnerabilityItem
              key={vulnerability.primaryId}
              vulnerability={vulnerability}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function VulnerabilityItem({
  vulnerability: { ids, severity, summary, details, fixedIn },
}: {
  vulnerability: Vulnerability;
}) {
  const vulnerabilitiesCopy = reportCopy.vulnerabilities;
  return (
    <li className="grid gap-2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SeverityBadge severity={severity} />
        {ids.map((id) => (
          <a
            key={id}
            href={vulnerabilitySourceUrl(id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={vulnerabilitiesCopy.sourceLabel(id)}
            className="inline-flex items-center gap-1 rounded-sm font-mono text-xs text-brand-text underline-offset-4 hover:underline"
          >
            {id}
            <ExternalLink aria-hidden className="size-3" />
          </a>
        ))}
      </div>
      {/* wrap-anywhere, not break-words: an unbroken URL in OSV text would
          otherwise set the grid column's min-content width and scroll the
          panel sideways. */}
      {summary ? (
        <p className="text-sm font-medium wrap-anywhere">{summary}</p>
      ) : null}
      {details ? (
        <p className="text-sm wrap-anywhere whitespace-pre-line text-muted-foreground">
          {details}
        </p>
      ) : null}
      <p
        className={cn(
          "text-sm",
          fixedIn === null ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {fixedIn === null
          ? vulnerabilitiesCopy.noFix
          : vulnerabilitiesCopy.fixedIn(fixedIn)}
      </p>
    </li>
  );
}

function SectionSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}
