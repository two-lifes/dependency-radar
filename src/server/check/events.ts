import type { CheckFailureCode } from "../analysis/check-outcome";
import type { PackageRowJson } from "./package-row";

export type FinishedCheckStatus =
  "completed" | "partial" | "cancelled" | "failed";

/** What the report page receives over SSE; `type` is the SSE event name. */
export type CheckEvent =
  | { type: "progress"; checked: number; total: number }
  | { type: "package"; package: PackageRowJson }
  | {
      type: "done";
      status: FinishedCheckStatus;
      failureReason: CheckFailureCode | null;
      /** ISO time when a rate-limited check can be retried. */
      retryAt: string | null;
    }
  /** The stream broke on our side; the client reconnects or shows Retry. */
  | { type: "error" };

export type EmitEvent = (event: CheckEvent) => void;

/** One SSE frame. JSON never contains a raw newline, so one `data:` line. */
export function encodeSseEvent(event: CheckEvent): string {
  const { type, ...data } = event;
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** A comment frame: keeps proxies from closing an idle stream. */
export const SSE_PING = ": ping\n\n";
