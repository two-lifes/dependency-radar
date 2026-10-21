"use client";

import { AlertTriangle, CircleSlash, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancel, resume, retry } from "./actions";
import { reportCopy } from "./copy";
import { serializeFilters } from "./filters";
import { useReport } from "./report-context";

const copy = reportCopy;

/** Progress bar while a check runs (screens 5.4, style guide §5). */
export function CheckProgress() {
  const { checkId, running, stream, closeStream, retryStream } = useReport();
  const [pending, startTransition] = useTransition();
  if (!running || !checkId) return null;

  if (stream.connection === "lost") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-2 text-base text-danger"
      >
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">{copy.progress.lost}</span>
        <Button variant="secondary" size="sm" onClick={retryStream}>
          {copy.progress.retry}
        </Button>
      </div>
    );
  }

  const { checked, total } = stream;
  return (
    <div className="grid gap-2 rounded-lg bg-brand-soft px-4 py-2">
      <div className="flex items-center gap-3">
        <span
          id="check-progress-label"
          aria-live="polite"
          className="flex-1 text-base text-brand-text tabular-nums"
        >
          {copy.progress.label(checked, total)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              // Closing stops the check when this tab runs it; the action
              // covers a check another tab or stream runs.
              closeStream();
              await cancel(checkId);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {copy.progress.cancel}
        </Button>
      </div>
      <div
        role="progressbar"
        aria-labelledby="check-progress-label"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={checked}
        className="h-1 overflow-hidden rounded-full bg-background"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
          style={{ width: `${total > 0 ? (checked / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

/** "Partial" and "Cancelled" banners above the summary (screens 5.4). */
export function CheckBanner({
  status,
  checkId,
  sourceFailures,
  basePath,
}: {
  status: "partial" | "cancelled";
  checkId: string;
  sourceFailures: number;
  basePath: string;
}) {
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const run = (action: (id: string) => Promise<void>) =>
    startTransition(() => action(checkId));

  if (status === "cancelled") {
    return (
      <Banner icon={<CircleSlash />} text={copy.banner.cancelled}>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => run(resume)}
        >
          {copy.banner.resume}
        </Button>
      </Banner>
    );
  }

  // "Show" turns on the unchecked filter and keeps the rest of the query.
  const query = serializeFilters(search, { status: "unchecked" });
  return (
    <Banner icon={<AlertTriangle />} text={copy.banner.partial(sourceFailures)}>
      <Button asChild variant="secondary" size="sm">
        <Link href={`${basePath}/dependencies${query}`}>
          {copy.banner.show}
        </Link>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => run(retry)}
      >
        {copy.banner.retryFailed}
      </Button>
    </Banner>
  );
}

function Banner({
  icon,
  text,
  children,
}: {
  icon: ReactNode;
  text: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-2 text-base text-warning [&>svg]:size-4 [&>svg]:shrink-0"
    >
      {icon}
      <span className="flex-1">{text}</span>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

/** "We couldn't check this project." in place of the report content. */
export function CheckFailed({
  reason,
  onTryAgain,
}: {
  reason: string;
  onTryAgain: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <section
      role="alert"
      className="grid justify-items-center gap-3 rounded-xl border border-border bg-card px-4 py-12 text-center"
    >
      <AlertTriangle
        className="size-5 text-danger"
        strokeWidth={1.75}
        aria-hidden
      />
      <h2 className="text-lg font-semibold tracking-tight">
        {copy.failed.title}
      </h2>
      <p className="text-base text-muted-foreground">{reason}</p>
      <Button disabled={pending} onClick={() => startTransition(onTryAgain)}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {copy.failed.tryAgain}
      </Button>
    </section>
  );
}
