"use client";

import { useEffect, useRef, useState } from "react";
import { checkAgain } from "./actions";
import { CheckFailed } from "./check-status";
import { checkFailureCopy } from "./copy";
import { ReportSummarySkeleton } from "./report-summary";

/**
 * decisions 43: a project opened without any check (imported, not yet reached
 * by the dashboard queue) starts its first one. Success refreshes the page,
 * which then streams the check; the rate limit or a failed repository read
 * stays here with "Try again".
 */
export function FirstCheckStarter({ reportId }: { reportId: string }) {
  const [error, setError] = useState<string>();
  // StrictMode runs the effect twice; a second call would count twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    checkAgain(reportId).then(
      (result) => setError(result.error),
      (failure: unknown) => {
        console.error("[report] couldn't start the first check", failure);
        setError(checkFailureCopy["internal-error"](null, new Date()));
      },
    );
  }, [reportId]);

  if (error === undefined) return <ReportSummarySkeleton />;
  return (
    <CheckFailed
      reason={error}
      onTryAgain={async () => {
        const result = await checkAgain(reportId);
        setError(result.error);
        return result;
      }}
    />
  );
}
