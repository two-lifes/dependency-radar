"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { queueCheck } from "./actions";
import {
  initialQueue,
  itemsToStart,
  type QueueItem,
  type QueueState,
  reduceQueue,
} from "./check-queue";

/**
 * decisions 43: the dashboard checks projects without a finished check over
 * SSE, two at a time. Leaving the page closes the streams, which cancels the
 * checks they run, as closing a report does; the next visit resumes them.
 */
export function useCheckQueue(pendingProjectIds: string[]): {
  queue: QueueState;
  checkNow: (projectId: string) => void;
  forget: (projectId: string) => void;
} {
  const router = useRouter();
  const [queue, dispatch] = useReducer(reduceQueue, initialQueue);
  const sources = useRef(new Map<string, EventSource>());
  const inFlight = useRef(new Set<string>());
  const mounted = useRef(false);

  const pendingKey = pendingProjectIds.join(",");
  useEffect(() => {
    dispatch({
      type: "sync",
      projectIds: pendingKey ? pendingKey.split(",") : [],
    });
  }, [pendingKey]);

  const settle = useCallback(
    (projectId: string) => {
      sources.current.get(projectId)?.close();
      sources.current.delete(projectId);
      dispatch({ type: "settled", projectId });
      // The card's score and date come from the server.
      router.refresh();
    },
    [router],
  );

  const follow = useCallback(
    (projectId: string, checkId: string) => {
      const source = new EventSource(`/api/checks/${checkId}/events`);
      sources.current.set(projectId, source);
      source.addEventListener("progress", (message) => {
        const progress = parseProgress(message);
        if (progress) dispatch({ type: "progress", projectId, ...progress });
      });
      source.addEventListener("done", () => settle(projectId));
      // Our server's `error` event, or the connection closed for good; a
      // stream ending without `done` reconnects by itself (decisions 27).
      source.addEventListener("error", (event) => {
        if (
          event instanceof MessageEvent ||
          source.readyState === EventSource.CLOSED
        ) {
          settle(projectId);
        }
      });
    },
    [settle],
  );

  const start = useCallback(
    async (item: QueueItem) => {
      inFlight.current.add(item.projectId);
      dispatch({ type: "starting", projectId: item.projectId });
      try {
        const result = await queueCheck(item.projectId, item.fresh);
        if (!mounted.current) return;
        switch (result.kind) {
          case "started":
            dispatch({
              type: "started",
              projectId: item.projectId,
              checkId: result.checkId,
            });
            follow(item.projectId, result.checkId);
            return;
          case "limited":
            dispatch({
              type: "limited",
              projectId: item.projectId,
              until: Date.now() + result.retryAfterSeconds * 1000,
              retryAfterSeconds: result.retryAfterSeconds,
            });
            return;
          case "error":
            toast({ title: result.message });
            settle(item.projectId);
            return;
          case "skipped":
            settle(item.projectId);
            return;
        }
      } catch (error) {
        // A network or server failure: leave the card as the server shows it.
        console.error("[dashboard] couldn't start a check", error);
        if (mounted.current) settle(item.projectId);
      } finally {
        inFlight.current.delete(item.projectId);
      }
    },
    [follow, settle],
  );

  useEffect(() => {
    for (const item of itemsToStart(queue)) {
      // StrictMode runs effects twice before the "starting" render lands.
      if (!inFlight.current.has(item.projectId)) void start(item);
    }
  }, [queue, start]);

  const paused = queue.paused;
  useEffect(() => {
    if (!paused) return;
    const timer = setTimeout(
      () => dispatch({ type: "resume" }),
      Math.max(0, paused.until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [paused]);

  useEffect(() => {
    mounted.current = true;
    const open = sources.current;
    return () => {
      mounted.current = false;
      for (const source of open.values()) source.close();
      open.clear();
    };
  }, []);

  const checkNow = useCallback((projectId: string) => {
    dispatch({ type: "check-now", projectId });
  }, []);

  /** A deleted project: its stream closes and it leaves the queue. */
  const forget = useCallback((projectId: string) => {
    sources.current.get(projectId)?.close();
    sources.current.delete(projectId);
    dispatch({ type: "settled", projectId });
  }, []);

  return { queue, checkNow, forget };
}

// The payload comes from our own route handler; only its shape is guarded.
function parseProgress(
  message: Event,
): { checked: number; total: number } | undefined {
  if (!(message instanceof MessageEvent) || typeof message.data !== "string") {
    return undefined;
  }
  try {
    const data: unknown = JSON.parse(message.data);
    if (
      typeof data === "object" &&
      data !== null &&
      "checked" in data &&
      "total" in data &&
      typeof data.checked === "number" &&
      typeof data.total === "number"
    ) {
      return { checked: data.checked, total: data.total };
    }
  } catch {
    // A broken frame: the next one carries the same counters.
  }
  return undefined;
}
