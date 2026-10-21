import type { CheckEvent } from "@/server/check/events";
import type { PackageRowJson } from "@/server/check/package-row";
import type { ManifestDependency } from "@/server/analysis/parse-manifest";

/** One table row: a dependency of the report and its latest known result. */
export type ReportRow = {
  name: string;
  type: ManifestDependency["type"];
  /** null while the package waits for its first result (skeleton row). */
  result: PackageRowJson | null;
  /** When the result arrived over SSE; the row is highlighted for a moment. */
  updatedAt?: number;
};

export type StreamedRow = { row: PackageRowJson; at: number };

/**
 * Rows in package.json order. Later sources win: the previous check (shown
 * during "Check again", screens 5.4), then the current check as loaded, then
 * what arrived over SSE.
 */
export function buildRows(
  dependencies: readonly ManifestDependency[],
  sources: {
    previous: readonly PackageRowJson[];
    current: readonly PackageRowJson[];
    streamed: Readonly<Record<string, StreamedRow>>;
  },
): ReportRow[] {
  const byName = new Map<string, Omit<ReportRow, "name" | "type">>();
  for (const row of sources.previous) byName.set(row.name, { result: row });
  for (const row of sources.current) byName.set(row.name, { result: row });
  for (const { row, at } of Object.values(sources.streamed)) {
    byName.set(row.name, { result: row, updatedAt: at });
  }
  return dependencies.map(({ name, type }) => ({
    name,
    type,
    ...(byName.get(name) ?? { result: null }),
  }));
}

export type StreamState = {
  checked: number;
  total: number;
  streamed: Readonly<Record<string, StreamedRow>>;
  /** `lost`: the stream broke and won't come back by itself (Retry). */
  connection: "live" | "lost" | "done";
};

export type StreamAction =
  | { type: "event"; event: CheckEvent; at: number }
  | { type: "lost" }
  | { type: "reconnect" };

export function reduceStream(
  state: StreamState,
  action: StreamAction,
): StreamState {
  switch (action.type) {
    case "lost":
      return state.connection === "done"
        ? state
        : { ...state, connection: "lost" };
    case "reconnect":
      return { ...state, connection: "live" };
    case "event":
      break;
  }
  const { event, at } = action;
  switch (event.type) {
    case "progress":
      return { ...state, checked: event.checked, total: event.total };
    case "package":
      return {
        ...state,
        streamed: {
          ...state.streamed,
          [event.package.name]: { row: event.package, at },
        },
      };
    case "done":
      return { ...state, connection: "done" };
    case "error":
      return { ...state, connection: "lost" };
  }
}
