import type { EmitEvent } from "./events";
import { followCheck } from "./follow-check";
import {
  type CheckEngineDeps,
  currentDoneEvent,
  DEFAULT_LEASE_MS,
  runCheck,
} from "./run-check";

/**
 * What one SSE connection does: runs the check if no one else does, follows
 * it if another stream runs it, or just reports how it ended. At `deadline`
 * it returns without `done` and the client's EventSource reconnects.
 */
export async function serveCheck(
  checkId: string,
  deps: CheckEngineDeps & { pollMs?: number },
  {
    signal,
    deadline,
    emit,
  }: { signal: AbortSignal; deadline: AbortSignal; emit: EmitEvent },
): Promise<void> {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  const leaseMs = deps.leaseMs ?? DEFAULT_LEASE_MS;

  const check = await store.getCheck(checkId);
  if (!check) throw new Error(`Check ${checkId} not found`);
  if (check.status !== "running") {
    emit(await currentDoneEvent(store, checkId));
    return;
  }

  const at = now();
  const claimed = await store.claimLease(
    checkId,
    at,
    new Date(at.getTime() + leaseMs),
  );
  if (!claimed) {
    const outcome = await followCheck(
      checkId,
      { store, leaseMs, now, pollMs: deps.pollMs },
      { signal: AbortSignal.any([signal, deadline]), emit },
    );
    if (outcome !== "takeover") return;
  }
  await runCheck(checkId, deps, { signal, deadline, emit });
}
