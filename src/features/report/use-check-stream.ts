"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { CheckEvent } from "@/server/check/events";
import { reduceStream, type StreamState } from "./report-rows";

const EVENT_TYPES = ["progress", "package", "done", "error"] as const;

/**
 * Follows a running check over SSE (decisions 27). The stream ending without
 * `done` is the server handing the check over: EventSource reconnects by
 * itself and that is not an error. Unmounting closes the stream, which
 * cancels the check if this stream runs it.
 */
export function useCheckStream({
  checkId,
  running,
  initial,
  onDone,
}: {
  checkId: string;
  running: boolean;
  initial: StreamState;
  onDone: () => void;
}) {
  const [state, dispatch] = useReducer(reduceStream, initial);
  const [attempt, setAttempt] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!running) return;
    let source: EventSource | undefined;
    // Opening on the next tick: StrictMode mounts effects twice, and closing
    // the first stream right away would cancel the check it just started.
    const timer = setTimeout(() => {
      source = new EventSource(`/api/checks/${checkId}/events`);
      sourceRef.current = source;
      const opened = source;

      for (const type of EVENT_TYPES) {
        opened.addEventListener(type, (message) => {
          // EventSource fires a plain Event named "error" on connection
          // problems; only a MessageEvent is our server's `error` event.
          if (!(message instanceof MessageEvent)) {
            if (opened.readyState === EventSource.CLOSED) {
              dispatch({ type: "lost" });
            }
            return;
          }
          const event = parseEvent(type, message.data);
          if (!event) {
            opened.close();
            dispatch({ type: "lost" });
            return;
          }
          dispatch({ type: "event", event, at: Date.now() });
          if (event.type === "done") {
            opened.close();
            onDoneRef.current();
          } else if (event.type === "error") {
            opened.close();
          }
        });
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      source?.close();
      sourceRef.current = null;
    };
  }, [checkId, running, attempt]);

  const retry = useCallback(() => {
    dispatch({ type: "reconnect" });
    setAttempt((n) => n + 1);
  }, []);

  /** Closes the stream; with Cancel this stops the check if it runs here. */
  const close = useCallback(() => {
    sourceRef.current?.close();
  }, []);

  return { state, retry, close };
}

// The payload comes from our own route handler (`encodeSseEvent`), so only
// its shape is guarded against a broken frame, not validated field by field.
function parseEvent(
  type: (typeof EVENT_TYPES)[number],
  data: unknown,
): CheckEvent | undefined {
  if (typeof data !== "string") return undefined;
  try {
    const payload: unknown = JSON.parse(data);
    if (typeof payload !== "object" || payload === null) return undefined;
    return { ...payload, type } as CheckEvent;
  } catch {
    return undefined;
  }
}
