"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, use, useMemo } from "react";
import type { ManifestDependency } from "@/server/analysis/parse-manifest";
import type { PackageManager } from "@/server/analysis/update-command";
import type { PackageRowJson } from "@/server/check/package-row";
import { buildRows, type ReportRow, type StreamState } from "./report-rows";
import { useCheckStream } from "./use-check-stream";

type ReportContextValue = {
  checkId: string | undefined;
  running: boolean;
  packageManager: PackageManager;
  rows: ReportRow[];
  stream: StreamState;
  retryStream: () => void;
  closeStream: () => void;
};

const ReportContext = createContext<ReportContextValue | null>(null);

/**
 * Live state of the report page: rows from the server plus what the check
 * stream adds. The layout remounts it (key) when the check or its status
 * changes, so the stream always starts from what the server just loaded.
 */
export function ReportProvider({
  checkId,
  running,
  packageManager,
  totalPackages,
  dependencies,
  previousRows,
  currentRows,
  children,
}: {
  checkId: string | undefined;
  running: boolean;
  packageManager: PackageManager;
  totalPackages: number;
  dependencies: ManifestDependency[];
  previousRows: PackageRowJson[];
  currentRows: PackageRowJson[];
  children: ReactNode;
}) {
  const router = useRouter();
  const { state, retry, close } = useCheckStream({
    checkId: checkId ?? "",
    running: running && checkId !== undefined,
    initial: {
      checked: currentRows.length,
      total: totalPackages,
      streamed: {},
      connection: running ? "live" : "done",
    },
    // decisions 27: rows before the stream opened come from the page, and
    // the finished check's summary too, so `done` just reloads the data.
    onDone: () => router.refresh(),
  });

  const rows = useMemo(
    () =>
      buildRows(dependencies, {
        previous: previousRows,
        current: currentRows,
        streamed: state.streamed,
      }),
    [dependencies, previousRows, currentRows, state.streamed],
  );

  return (
    <ReportContext
      value={{
        checkId,
        running,
        packageManager,
        rows,
        stream: state,
        retryStream: retry,
        closeStream: close,
      }}
    >
      {children}
    </ReportContext>
  );
}

export function useReport(): ReportContextValue {
  const value = use(ReportContext);
  if (!value) throw new Error("useReport must be used inside ReportProvider");
  return value;
}
