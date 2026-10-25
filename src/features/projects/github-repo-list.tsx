"use client";

import { RotateCw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { NetworkButton, OfflineNotice } from "../system/network-status";
import { isOnline, useOnlineStatus } from "@/lib/use-online-status";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatFullDate, formatRelativeTime } from "@/lib/format-time";
import type { Result } from "@/server/analysis/result";
import type { SourceError } from "@/server/sources/http";
import { githubErrorCopy } from "../check/copy";
import { loadGithubRepos } from "./actions";
import { newProjectCopy } from "./copy";
import { filterRepos, type GithubRepoList, type RepoRow } from "./github-repos";

const copy = newProjectCopy.repos;
const SKELETON_ROWS = 5;

export type GithubReposState =
  | { status: "idle" }
  | { status: "offline" }
  | { status: "loading" }
  | { status: "error"; error: SourceError; retry: () => void }
  | { status: "done"; value: GithubRepoList };

/**
 * Loads the list once `enabled` turns on and keeps it: the form owns this, so
 * switching tabs (which unmounts the panel) doesn't reload it.
 */
export function useGithubRepos(enabled: boolean): GithubReposState {
  const online = useOnlineStatus();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    attempt: number;
    result: Result<GithubRepoList, SourceError>;
  } | null>(null);
  // Latches: once asked for, the list stays even if the tab is left.
  const [started, setStarted] = useState(enabled);
  if (enabled && !started) setStarted(true);

  useEffect(() => {
    if (!started || !online || loaded?.attempt === attempt) return;
    let cancelled = false;
    const settle = (result: Result<GithubRepoList, SourceError>) => {
      if (!cancelled) setLoaded({ attempt, result });
    };
    loadGithubRepos().then(settle, () =>
      // The action itself failed (network, server): same as GitHub failing.
      settle({ ok: false, error: { code: "unavailable" } }),
    );
    return () => {
      cancelled = true;
    };
  }, [started, attempt, online, loaded]);

  if (!started) return { status: "idle" };
  if (loaded?.attempt !== attempt)
    return { status: online ? "loading" : "offline" };
  return loaded.result.ok
    ? { status: "done", value: loaded.result.value }
    : {
        status: "error",
        error: loaded.result.error,
        retry: () => {
          if (isOnline()) setAttempt((count) => count + 1);
        },
      };
}

/**
 * screens 5.11.1: the user's public repositories under the URL field. A
 * failure here only hides the list; the URL can still be typed.
 */
export function GithubRepoList({
  connected,
  state,
  selectedUrl,
  onSelect,
  disabled,
}: {
  connected: boolean;
  state: GithubReposState;
  selectedUrl?: string;
  onSelect: (repo: RepoRow) => void;
  disabled: boolean;
}) {
  if (!connected) {
    return (
      <Link
        href="/settings/profile"
        className="w-fit rounded-sm text-sm text-brand-text underline-offset-4 hover:underline"
      >
        {copy.connect}
      </Link>
    );
  }

  switch (state.status) {
    case "idle":
      return null;
    case "offline":
      return <OfflineNotice />;
    case "loading":
      return (
        <section className="grid gap-2">
          <h3 className="text-sm font-medium">{copy.titleLoading}</h3>
          <div
            aria-busy="true"
            aria-label={copy.loading}
            className="grid gap-2"
          >
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </section>
      );
    case "error":
      return (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          {state.error.code === "rate-limited" ? (
            <p className="text-sm text-muted-foreground">
              {githubErrorCopy["rate-limited"](state.error)}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{copy.failed}</p>
              <NetworkButton
                variant="secondary"
                size="sm"
                onClick={state.retry}
              >
                <RotateCw aria-hidden />
                {copy.retry}
              </NetworkButton>
            </>
          )}
        </div>
      );
    case "done":
      return (
        <RepoListBody
          list={state.value}
          selectedUrl={selectedUrl}
          onSelect={onSelect}
          disabled={disabled}
        />
      );
  }
}

function RepoListBody({
  list: { login, repos },
  selectedUrl,
  onSelect,
  disabled,
}: {
  list: GithubRepoList;
  selectedUrl?: string;
  onSelect: (repo: RepoRow) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const titleId = useId();
  const shown = filterRepos(repos, query);
  const now = new Date();

  return (
    <section aria-labelledby={titleId} className="grid gap-2">
      <h3 id={titleId} className="text-sm font-medium">
        {copy.title(login)}
      </h3>
      {repos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty(login)}</p>
      ) : (
        <>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // The list sits inside the project form: Enter here searches,
              // it must not submit "Create & check".
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder={copy.search}
              aria-label={copy.search}
              className="pl-8"
            />
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {copy.noMatches(query.trim())}
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {shown.map((repo) => (
                <li key={repo.fullName}>
                  <RepoItem
                    repo={repo}
                    selected={repo.url === selectedUrl}
                    onSelect={onSelect}
                    disabled={disabled}
                    now={now}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function RepoItem({
  repo,
  selected,
  onSelect,
  disabled,
  now,
}: {
  repo: RepoRow;
  selected: boolean;
  onSelect: (repo: RepoRow) => void;
  disabled: boolean;
  now: Date;
}) {
  const pushedAt = repo.pushedAt ? new Date(repo.pushedAt) : undefined;
  const details = (
    <>
      {repo.description ? (
        // screens 5.11.1: no description on mobile.
        <span className="hidden truncate text-sm text-muted-foreground sm:block">
          {repo.description}
        </span>
      ) : null}
      <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        {repo.language ? <span>{repo.language}</span> : null}
        {pushedAt ? (
          <time dateTime={repo.pushedAt} title={formatFullDate(pushedAt)}>
            {copy.updated(formatRelativeTime(pushedAt, now))}
          </time>
        ) : null}
      </span>
    </>
  );
  const rowClass = "grid w-full min-w-0 gap-0.5 px-3 py-2 text-left";

  // Already a project: a link to it, not something to pick again.
  if (repo.projectId) {
    return (
      <div className={rowClass}>
        <span className="flex min-w-0 items-center gap-2">
          <Link
            href={`/projects/${repo.projectId}/dependencies`}
            className="truncate rounded-sm font-mono text-sm text-brand-text underline-offset-4 hover:underline"
          >
            {repo.fullName}
          </Link>
          <Badge tone="neutral">{copy.added}</Badge>
        </span>
        {details}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(repo)}
      className={cn(
        rowClass,
        "transition-colors duration-150 ease-out hover:bg-muted focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        selected && "bg-brand-soft hover:bg-brand-soft",
      )}
    >
      <span className="truncate font-mono text-sm">{repo.fullName}</span>
      {details}
    </button>
  );
}
