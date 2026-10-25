"use client";

import { ChevronRight, ExternalLink, RotateCw } from "lucide-react";
import type { ElementType, HTMLAttributes } from "react";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { NetworkButton, OfflineNotice } from "../system/network-status";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatFullDate } from "@/lib/format-time";
import type { ReleaseNote } from "@/server/analysis/release-notes";
import type { ReleaseNotesView } from "@/server/check/release-notes";
import { reportCopy } from "./copy";
import type { LoadState } from "./use-checked-load";

const copy = reportCopy.card;

export type ReleaseNotesState = LoadState<ReleaseNotesView>;

/**
 * screens 5.9: versions newest first, each collapsed; possibly breaking ones
 * carry a badge. Native <details> gives keyboard and expanded state for free.
 */
export function ReleaseNotes({ state }: { state: ReleaseNotesState }) {
  switch (state.status) {
    case "idle":
      return null;
    case "offline":
      return <OfflineNotice />;
    case "loading":
      return (
        <div
          aria-busy="true"
          aria-label={copy.loadingReleaseNotes}
          className="grid gap-2"
        >
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    case "error":
      return (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {copy.releaseNotesFailed}
          </p>
          <NetworkButton variant="secondary" size="sm" onClick={state.retry}>
            <RotateCw aria-hidden />
            {copy.retry}
          </NetworkButton>
        </div>
      );
    case "done": {
      const { notes, repositoryUrl } = state.value;
      if (notes.length === 0) {
        return (
          <p className="text-sm text-muted-foreground">
            {copy.noReleaseNotes}{" "}
            {repositoryUrl !== null ? (
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-brand-text underline-offset-4 hover:underline"
              >
                {copy.openRepository}
              </a>
            ) : null}
          </p>
        );
      }
      return (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {notes.map((note) => (
            <li key={note.version}>
              <ReleaseItem note={note} />
            </li>
          ))}
        </ul>
      );
    }
  }
}

function ReleaseItem({ note }: { note: ReleaseNote }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-90 motion-reduce:transition-none"
        />
        <span className="font-mono text-sm">{note.version}</span>
        {note.title !== null ? (
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            {note.title}
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {note.possiblyBreaking ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge tone="danger">{copy.possiblyBreaking}</Badge>
              </TooltipTrigger>
              <TooltipContent>{copy.possiblyBreakingHint}</TooltipContent>
            </Tooltip>
          ) : null}
          {note.publishedAt !== null ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {formatFullDate(new Date(note.publishedAt))}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="grid gap-3 px-4 pb-4">
        {/* The tooltip is pointer-only; keyboard and touch read the hint here. */}
        {note.possiblyBreaking ? (
          <p className="text-xs text-muted-foreground">
            {copy.possiblyBreakingHint}
          </p>
        ) : null}
        {note.body !== null ? (
          <div className="grid gap-2 text-sm wrap-anywhere">
            <Markdown
              remarkPlugins={[remarkGfm]}
              // Raw HTML is dropped, not rendered: release text is untrusted.
              skipHtml
              // Remote images would load third-party trackers into the card.
              disallowedElements={["img"]}
              unwrapDisallowed
              components={markdownComponents}
            >
              {note.body}
            </Markdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{copy.emptyRelease}</p>
        )}
        <a
          href={note.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 justify-self-start rounded-sm text-sm text-brand-text underline-offset-4 hover:underline"
        >
          {copy.viewOnGithub}
          <ExternalLink aria-hidden className="size-3" />
        </a>
      </div>
    </details>
  );
}

// The card's own headings are h2 (package) and h3 (sections), so release
// headings start at h4 whatever level the author used.
const heading = "text-sm font-semibold";

const markdownComponents: Components = {
  h1: styled("h4", heading),
  h2: styled("h4", heading),
  h3: styled("h5", heading),
  h4: styled("h5", heading),
  h5: styled("h6", heading),
  h6: styled("h6", heading),
  a: (props) => (
    <a
      {...withoutNode(props)}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-sm text-brand-text underline underline-offset-4"
    />
  ),
  ul: styled("ul", "grid list-disc gap-1 pl-5"),
  ol: styled("ol", "grid list-decimal gap-1 pl-5"),
  code: styled("code", "rounded-sm bg-muted px-1 font-mono text-xs"),
  // Wrapped, not scrolled: the card itself must never scroll sideways
  // (decisions 34).
  pre: styled(
    "pre",
    "rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap wrap-anywhere [&_code]:bg-transparent [&_code]:p-0",
  ),
  blockquote: styled(
    "blockquote",
    "border-l-2 border-border pl-3 text-muted-foreground",
  ),
  table: (props) => (
    <div className="overflow-x-auto">
      <table {...withoutNode(props)} className="text-xs" />
    </div>
  ),
  th: styled("th", "border border-border px-2 py-1 text-left"),
  td: styled("td", "border border-border px-2 py-1"),
  hr: styled("hr", "border-border"),
};

/** react-markdown passes its syntax tree as `node`; the DOM must not get it. */
function withoutNode<Props extends ExtraProps>(
  props: Props,
): Omit<Props, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

// Props stay loose on purpose: each tag's own prop type would not fit the
// slot it is mapped to (`h1` renders an `h4`).
type StyledTag =
  | "h4"
  | "h5"
  | "h6"
  | "ul"
  | "ol"
  | "code"
  | "pre"
  | "blockquote"
  | "th"
  | "td"
  | "hr";

function styled(tag: StyledTag, className: string) {
  return function Styled(props: HTMLAttributes<HTMLElement> & ExtraProps) {
    const Element: ElementType<HTMLAttributes<HTMLElement>> = tag;
    return <Element {...withoutNode(props)} className={className} />;
  };
}
