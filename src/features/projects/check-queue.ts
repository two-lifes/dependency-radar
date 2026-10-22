import {
  type CardStatus,
  checkPercent,
} from "@/server/analysis/dashboard-card";

/** decisions 43: at most this many dashboard checks stream at once. */
export const QUEUE_SLOTS = 2;

export type QueueItem =
  | { projectId: string; fresh: boolean; phase: "waiting" | "starting" }
  | {
      projectId: string;
      fresh: boolean;
      phase: "running";
      checkId: string;
      checked: number;
      total: number;
    };

export type QueueState = {
  /** In the order they start: added order, "Check now" first. */
  items: QueueItem[];
  /** The rate limit stopped the queue until `until` (ms since epoch). */
  paused: { until: number; retryAfterSeconds: number } | null;
  /** Done in this visit: not queued again until "Check now". */
  settled: string[];
};

export type QueueAction =
  /** Projects without a finished check, as the page loaded them. */
  | { type: "sync"; projectIds: string[] }
  | { type: "check-now"; projectId: string }
  | { type: "starting"; projectId: string }
  | { type: "started"; projectId: string; checkId: string }
  | { type: "progress"; projectId: string; checked: number; total: number }
  | {
      type: "limited";
      projectId: string;
      until: number;
      retryAfterSeconds: number;
    }
  | { type: "resume" }
  /** The check ended, was skipped, failed to start or the project is gone. */
  | { type: "settled"; projectId: string };

export const initialQueue: QueueState = {
  items: [],
  paused: null,
  settled: [],
};

export function reduceQueue(
  state: QueueState,
  action: QueueAction,
): QueueState {
  switch (action.type) {
    case "sync": {
      const known = new Set([
        ...state.items.map((item) => item.projectId),
        ...state.settled,
      ]);
      const added = action.projectIds
        .filter((id) => !known.has(id))
        .map((projectId) => waiting(projectId, false));
      return added.length === 0
        ? state
        : { ...state, items: [...state.items, ...added] };
    }
    case "check-now": {
      const current = find(state, action.projectId);
      if (current && current.phase !== "waiting") return state;
      return {
        ...state,
        items: [
          waiting(action.projectId, true),
          ...state.items.filter((item) => item.projectId !== action.projectId),
        ],
        settled: state.settled.filter((id) => id !== action.projectId),
      };
    }
    case "starting":
      return update(state, action.projectId, (item) =>
        item.phase === "waiting" ? { ...item, phase: "starting" } : item,
      );
    case "started":
      return update(state, action.projectId, (item) => ({
        projectId: item.projectId,
        fresh: item.fresh,
        phase: "running",
        checkId: action.checkId,
        checked: 0,
        total: 0,
      }));
    case "progress":
      return update(state, action.projectId, (item) =>
        item.phase === "running"
          ? { ...item, checked: action.checked, total: action.total }
          : item,
      );
    case "limited":
      // Back to waiting in its place: it goes first once the limit resets.
      return {
        ...update(state, action.projectId, (item) =>
          waiting(item.projectId, item.fresh),
        ),
        paused: {
          until: action.until,
          retryAfterSeconds: action.retryAfterSeconds,
        },
      };
    case "resume":
      return state.paused ? { ...state, paused: null } : state;
    case "settled":
      return {
        ...state,
        items: state.items.filter(
          (item) => item.projectId !== action.projectId,
        ),
        settled: state.settled.includes(action.projectId)
          ? state.settled
          : [...state.settled, action.projectId],
      };
  }
}

/** Waiting projects to start now, filling the free slots in order. */
export function itemsToStart(state: QueueState): QueueItem[] {
  if (state.paused) return [];
  const active = state.items.filter((item) => item.phase !== "waiting").length;
  const free = Math.max(0, QUEUE_SLOTS - active);
  return state.items.filter((item) => item.phase === "waiting").slice(0, free);
}

function waiting(projectId: string, fresh: boolean): QueueItem {
  return { projectId, fresh, phase: "waiting" };
}

function find(state: QueueState, projectId: string): QueueItem | undefined {
  return state.items.find((item) => item.projectId === projectId);
}

function update(
  state: QueueState,
  projectId: string,
  change: (item: QueueItem) => QueueItem,
): QueueState {
  if (!find(state, projectId)) return state;
  return {
    ...state,
    items: state.items.map((item) =>
      item.projectId === projectId ? change(item) : item,
    ),
  };
}

export type DisplayStatus =
  CardStatus | { kind: "limited"; retryAfterSeconds: number };

/**
 * What a card shows: the queue's live state while the project is in it,
 * otherwise what the page loaded. Waiting projects show the rate limit
 * while it holds the queue (screens 5.10).
 */
export function displayStatus(
  loaded: CardStatus,
  item: QueueItem | undefined,
  paused: QueueState["paused"],
): DisplayStatus {
  if (!item) return loaded;
  if (item.phase === "running") {
    return {
      kind: "checking",
      percent: checkPercent(item.checked, item.total),
    };
  }
  if (item.phase === "waiting" && paused) {
    return { kind: "limited", retryAfterSeconds: paused.retryAfterSeconds };
  }
  return { kind: "queued" };
}
