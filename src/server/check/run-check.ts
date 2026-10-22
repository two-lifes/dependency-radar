import {
  analyzePackage,
  type PackageAnalysis,
} from "../analysis/analyze-package";
import { checkOutcome } from "../analysis/check-outcome";
import { classifySpecifier } from "../analysis/classify-specifier";
import { healthScore } from "../analysis/health-score";
import {
  mergeVulnerabilities,
  type Vulnerability,
} from "../analysis/merge-vulnerabilities";
import type { OsvRecord } from "../analysis/osv-record";
import type { ManifestDependency } from "../analysis/parse-manifest";
import { reportCounts } from "../analysis/report-counts";
import type { UncheckedReason } from "../analysis/resolve-versions";
import type { Result } from "../analysis/result";
import type { Cache } from "../sources/cache";
import type { FetchJsonOptions, SourceError } from "../sources/http";
import type { Limiter } from "../sources/limiter";
import { fetchNpmPackage } from "../sources/npm";
import {
  fetchVulnerabilities,
  type OsvClientOptions,
  type OsvQuery,
} from "../sources/osv";
import type { CheckSnapshot, CheckStore } from "./check-store";
import type { CheckEvent, EmitEvent } from "./events";
import {
  buildPackageRow,
  type CheckPackageRow,
  rowToFindings,
  toPackageRowJson,
} from "./package-row";

export type CheckEngineDeps = {
  store: CheckStore;
  cache: Cache;
  limit: Limiter;
  /** Retry and timeout settings for sources; the signal comes from the run. */
  http?: Omit<FetchJsonOptions, "signal">;
  now?: () => Date;
  leaseMs?: number;
  leaseRenewMs?: number;
  osvBatchSize?: number;
  osvBatchWaitMs?: number;
};

// A renewal every 10 s keeps a 30 s lease alive through one slow npm request
// (30 s timeout) while a dead runner frees the check within half a minute.
export const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_LEASE_RENEW_MS = 10_000;
// Small enough that results show up while npm lookups are still running.
const DEFAULT_OSV_BATCH_SIZE = 25;
const DEFAULT_OSV_BATCH_WAIT_MS = 300;
// npm sent no Retry-After; GitHub's advice for this case is a minute.
const DEFAULT_RETRY_AFTER_SECONDS = 60;

type DoneEvent = Extract<CheckEvent, { type: "done" }>;

/**
 * Checks the packages of `checkId` that have no row yet, writing each result
 * as soon as it is ready. The caller must hold the lease. Aborting `signal`
 * (closed stream) or a cancel from elsewhere ends it as cancelled; rows
 * written so far stay, so Resume only does the rest. At `deadline` the check
 * stays running and the lease is freed without a `done` event: EventSource
 * reconnects and the next stream goes on.
 */
export async function runCheck(
  checkId: string,
  deps: CheckEngineDeps,
  {
    signal,
    deadline,
    emit,
  }: { signal: AbortSignal; deadline?: AbortSignal; emit: EmitEvent },
): Promise<void> {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  const leaseMs = deps.leaseMs ?? DEFAULT_LEASE_MS;

  const run = new AbortController();
  const stops = [signal, deadline].flatMap((source) => {
    if (!source) return [];
    const stop = () => run.abort(source.reason);
    if (source.aborted) stop();
    source.addEventListener("abort", stop, { once: true });
    return [() => source.removeEventListener("abort", stop)];
  });
  const renewal = setInterval(() => {
    store
      .renewLease(checkId, new Date(now().getTime() + leaseMs))
      .then((held) => {
        // Cancelled through `cancelCheck` while this stream runs it.
        if (!held) run.abort(new Error("Check is no longer running"));
      })
      .catch((error: unknown) => {
        console.error(`[check] lease renewal for ${checkId} failed`, error);
      });
  }, deps.leaseRenewMs ?? DEFAULT_LEASE_RENEW_MS);

  let retryAfterSeconds: number | undefined;
  let written = 0;

  try {
    const input = await store.getInput(checkId);
    if (!input) throw new Error(`Check ${checkId} has no report`);

    const existing = await store.listRows(checkId);
    const done = new Set(existing.map((row) => row.name));
    const total = input.dependencies.length;
    let checked = existing.length;
    emit({ type: "progress", checked, total });

    const pending = input.dependencies.filter((d) => !done.has(d.name));
    const lookups = pending.map((dependency) => ({
      dependency,
      name: registryName(dependency),
    }));

    const sources = {
      cache: deps.cache,
      limit: deps.limit,
      http: { ...deps.http, signal: run.signal },
    };
    const osv = createOsvBatcher(
      sources,
      {
        batchSize: deps.osvBatchSize ?? DEFAULT_OSV_BATCH_SIZE,
        maxWaitMs: deps.osvBatchWaitMs ?? DEFAULT_OSV_BATCH_WAIT_MS,
      },
      lookups.filter(({ name }) => name.ok).length,
      run.signal,
    );

    const record = async (
      dependency: ManifestDependency,
      analysis: PackageAnalysis,
      vulnerabilities: readonly Vulnerability[] = [],
    ) => {
      run.signal.throwIfAborted();
      const row = buildPackageRow({
        checkId,
        dependency,
        analysis,
        vulnerabilities,
        checkedAt: now(),
      });
      // Another runner got there first after our lease lapsed; its row stands.
      if (!(await store.insertRow(row))) return;
      checked++;
      written++;
      emit({ type: "package", package: toPackageRowJson(row) });
      emit({ type: "progress", checked, total });
    };

    const checkOne = async ({ dependency, name }: (typeof lookups)[number]) => {
      if (!name.ok) return record(dependency, unchecked(name.error));

      let analysis: PackageAnalysis;
      try {
        const npm = await fetchNpmPackage(name.value, sources);
        if (npm.ok) {
          analysis = analyzePackage({
            dependency,
            locked: input.lockedVersions?.[dependency.name],
            registry: npm.value.registry,
            now: now(),
          });
        } else {
          if (npm.error.code === "rate-limited") {
            retryAfterSeconds = Math.max(
              retryAfterSeconds ?? 0,
              npm.error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS,
            );
          }
          analysis = unchecked(npmFailureReason(npm.error));
        }
      } catch (error) {
        osv.skip();
        throw error;
      }

      if (!analysis.checked) {
        osv.skip();
        return record(dependency, analysis);
      }

      const records = await osv.query({
        name: analysis.registryName,
        version: analysis.current,
      });
      // An incomplete list would show the package safer than it is.
      if (!records.ok) {
        return record(dependency, unchecked("vulnerabilities-unavailable"));
      }
      return record(
        dependency,
        analysis,
        mergeVulnerabilities(records.value, {
          packageName: analysis.registryName,
          currentVersion: analysis.current,
        }),
      );
    };

    // allSettled, not all: after an abort every task must stop before the
    // check is marked cancelled, or a late row would land after the event.
    const results = await Promise.allSettled(lookups.map(checkOne));
    clearInterval(renewal);

    if (run.signal.aborted) {
      // Out of time, not cancelled. Without progress a reconnect would just
      // burn another function run, so then it ends as cancelled after all.
      if (deadline?.aborted && !signal.aborted && written > 0) {
        await store.releaseLease(checkId);
        return;
      }
      emit(await finishCheck(store, checkId, { now: now(), cancelled: true }));
      return;
    }
    const failure = results.find((r) => r.status === "rejected");
    if (failure) throw failure.reason;

    emit(await finishCheck(store, checkId, { now: now(), retryAfterSeconds }));
  } catch (error) {
    console.error(`[check] ${checkId} failed`, error);
    emit(await failCheck(store, checkId, now()));
  } finally {
    clearInterval(renewal);
    stops.forEach((removeListener) => removeListener());
  }
}

/**
 * Takes the score snapshot and ends a running check. When it had already
 * ended (cancelled elsewhere), reports how it ended instead.
 */
export async function finishCheck(
  store: CheckStore,
  checkId: string,
  options: SnapshotOptions,
): Promise<DoneEvent> {
  const snapshot = checkSnapshot(await store.listRows(checkId), options);
  if (await store.finish(checkId, snapshot)) return doneEvent(snapshot);
  return currentDoneEvent(store, checkId);
}

type SnapshotOptions = {
  now: Date;
  cancelled?: boolean;
  retryAfterSeconds?: number;
};

/** How a check with these rows ends; the demo seed stores the same snapshot. */
export function checkSnapshot(
  rows: readonly CheckPackageRow[],
  options: SnapshotOptions,
): CheckSnapshot {
  const findings = rows.map(rowToFindings);
  const outcome = options.cancelled
    ? { status: "cancelled" as const, failure: null }
    : checkOutcome(rows);
  const retryAt =
    outcome.failure === "registry-rate-limited"
      ? new Date(
          options.now.getTime() +
            (options.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS) * 1000,
        )
      : null;

  const counts = reportCounts(findings);
  return {
    status: outcome.status,
    failureReason: outcome.failure,
    retryAt,
    score: healthScore(findings).score,
    vulnerabilityCount: counts.vulnerabilities,
    severeVulnerableCount:
      counts.vulnerableBySeverity.critical + counts.vulnerableBySeverity.high,
    finishedAt: options.now,
  };
}

/** The `done` event for a check that is no longer running. */
export async function currentDoneEvent(
  store: CheckStore,
  checkId: string,
): Promise<DoneEvent> {
  const check = await store.getCheck(checkId);
  if (!check || check.status === "running") {
    throw new Error(`Check ${checkId} is not finished`);
  }
  return doneEvent({ ...check, status: check.status });
}

// Best effort: the error is often the database itself, then the lease just
// expires and the next stream picks the check up.
async function failCheck(
  store: CheckStore,
  checkId: string,
  now: Date,
): Promise<CheckEvent> {
  try {
    // No score: a corrupted row may be what failed the check.
    const snapshot: CheckSnapshot = {
      status: "failed",
      failureReason: "internal-error",
      retryAt: null,
      score: null,
      vulnerabilityCount: null,
      severeVulnerableCount: null,
      finishedAt: now,
    };
    if (await store.finish(checkId, snapshot)) return doneEvent(snapshot);
  } catch (error) {
    console.error(`[check] marking ${checkId} as failed failed`, error);
  }
  return { type: "error" };
}

function doneEvent(check: {
  status: DoneEvent["status"];
  failureReason: DoneEvent["failureReason"];
  retryAt: Date | null;
}): DoneEvent {
  return {
    type: "done",
    status: check.status,
    failureReason: check.failureReason,
    retryAt: check.retryAt?.toISOString() ?? null,
  };
}

function unchecked(reason: UncheckedReason): PackageAnalysis {
  return { checked: false, reason };
}

/** The name to look up in npm, or why the package is never looked up. */
function registryName(
  dependency: ManifestDependency,
): Result<string, UncheckedReason> {
  const spec = classifySpecifier(dependency.specifier);
  if (spec.kind === "non-registry") {
    return { ok: false, error: "not-from-registry" };
  }
  if (spec.kind === "invalid") return { ok: false, error: "invalid-specifier" };
  return {
    ok: true,
    value: spec.kind === "alias" ? spec.name : dependency.name,
  };
}

function npmFailureReason(error: SourceError): UncheckedReason {
  switch (error.code) {
    case "not-found":
      return "not-in-registry";
    case "rate-limited":
      return "registry-rate-limited";
    case "unavailable":
    case "invalid-response":
      return "registry-unavailable";
  }
}

type OsvResult = Result<OsvRecord[], SourceError>;

/**
 * Groups OSV queries into batches while npm lookups are still running. A
 * batch goes out when it is full, when no lookup can add to it any more, or
 * `maxWaitMs` after its first query.
 */
function createOsvBatcher(
  options: OsvClientOptions,
  { batchSize, maxWaitMs }: { batchSize: number; maxWaitMs: number },
  lookups: number,
  signal: AbortSignal,
) {
  let open = lookups;
  let waiting: {
    query: OsvQuery;
    resolve: (result: OsvResult) => void;
    reject: (reason: unknown) => void;
  }[] = [];

  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    const batch = waiting;
    waiting = [];
    if (batch.length === 0) return;
    fetchVulnerabilities(
      batch.map((entry) => entry.query),
      options,
    ).then(
      (results) =>
        batch.forEach((entry, i) =>
          entry.resolve(
            results[i] ?? { ok: false, error: { code: "invalid-response" } },
          ),
        ),
      (error: unknown) => batch.forEach((entry) => entry.reject(error)),
    );
  };
  const lookupDone = () => {
    open--;
    if (waiting.length >= batchSize || open === 0) flush();
    // One slow npm document (up to 30 s) must not hold back the others.
    else if (waiting.length > 0 && timer === undefined) {
      timer = setTimeout(flush, maxWaitMs);
    }
  };

  // Queued queries would otherwise wait forever for lookups that were aborted.
  signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
      const batch = waiting;
      waiting = [];
      batch.forEach((entry) => entry.reject(signal.reason));
    },
    { once: true },
  );

  return {
    /** Ends a lookup with a query; resolves when its batch returns. */
    query(query: OsvQuery): Promise<OsvResult> {
      const result = new Promise<OsvResult>((resolve, reject) => {
        waiting.push({ query, resolve, reject });
      });
      lookupDone();
      return result;
    },
    /** Ends a lookup that has nothing to query. */
    skip: lookupDone,
  };
}
