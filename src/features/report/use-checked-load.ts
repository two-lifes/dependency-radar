"use client";

import { useEffect, useState } from "react";
import type { Result } from "@/server/analysis/result";
import type { PackageDetailsError } from "./package-actions";
import type { ReportRow } from "./report-rows";

export type LoadState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "done"; value: T };

/**
 * A card section loaded by a Server Action once the row has a checked
 * result: a pending row (first check) has no registry name yet, an unchecked
 * one has nothing to load. Each section fails and retries on its own.
 */
export function useCheckedLoad<T>(
  load: (
    reportId: string,
    name: string,
  ) => Promise<Result<T, PackageDetailsError>>,
  reportId: string,
  row: ReportRow,
): LoadState<T> {
  const { name, result } = row;
  const key = result?.checked
    ? [result.registryName, result.current, result.latest].join("|")
    : null;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    attempt: number;
    result: Result<T, PackageDetailsError>;
  } | null>(null);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    const settle = (outcome: Result<T, PackageDetailsError>) => {
      if (!cancelled) setLoaded({ key, attempt, result: outcome });
    };
    load(reportId, name).then(settle, () =>
      // The action itself failed (network, server): same as a source failure.
      settle({ ok: false, error: "unavailable" }),
    );
    return () => {
      cancelled = true;
    };
  }, [load, reportId, name, key, attempt]);

  if (key === null) return { status: "idle" };
  if (loaded?.key !== key || loaded.attempt !== attempt) {
    return { status: "loading" };
  }
  return loaded.result.ok
    ? { status: "done", value: loaded.result.value }
    : { status: "error", retry: () => setAttempt((count) => count + 1) };
}
