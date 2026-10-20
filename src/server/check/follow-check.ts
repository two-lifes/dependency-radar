import type { CheckStore } from "./check-store";
import type { EmitEvent } from "./events";
import { toPackageRowJson } from "./package-row";
import { currentDoneEvent } from "./run-check";

export type FollowOutcome = "finished" | "takeover" | "aborted";

const DEFAULT_POLL_MS = 1_000;

/**
 * Streams the progress of a check another stream is running, from the
 * database. Returns "takeover" once it got the lease of a runner that died
 * (Vercel timeout), so the caller runs the rest itself.
 */
export async function followCheck(
  checkId: string,
  deps: {
    store: CheckStore;
    leaseMs: number;
    now?: () => Date;
    pollMs?: number;
  },
  { signal, emit }: { signal: AbortSignal; emit: EmitEvent },
): Promise<FollowOutcome> {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());

  const seen = new Set((await store.listRows(checkId)).map((row) => row.name));
  let total = (await store.getCheck(checkId))?.totalPackages ?? 0;
  emit({ type: "progress", checked: seen.size, total });

  for (;;) {
    if (!(await sleep(deps.pollMs ?? DEFAULT_POLL_MS, signal)))
      return "aborted";

    // Status before rows: rows are written before the check is finished, so
    // a finished status means the rows read next are complete.
    const check = await store.getCheck(checkId);
    if (!check) throw new Error(`Check ${checkId} disappeared`);
    total = check.totalPackages;

    const fresh = (await store.listRows(checkId)).filter(
      (row) => !seen.has(row.name),
    );
    for (const row of fresh) {
      seen.add(row.name);
      emit({ type: "package", package: toPackageRowJson(row) });
    }
    if (fresh.length > 0) {
      emit({ type: "progress", checked: seen.size, total });
    }

    if (check.status !== "running") {
      emit(await currentDoneEvent(store, checkId));
      return "finished";
    }
    const at = now();
    if (
      await store.claimLease(checkId, at, new Date(at.getTime() + deps.leaseMs))
    ) {
      return "takeover";
    }
  }
}

/** `false` when aborted before the time is up. */
function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
