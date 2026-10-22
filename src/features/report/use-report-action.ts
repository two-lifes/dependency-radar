"use client";

import { useTransition } from "react";
import { toast } from "@/components/ui/toast";
import type { ReportActionResult } from "./actions";

/**
 * Runs a report action that starts a check in a transition; its message (the
 * rate limit, a failed repository read) becomes a toast, since the page itself
 * doesn't change.
 */
export function useReportAction(): [
  pending: boolean,
  run: (action: () => Promise<ReportActionResult>) => void,
] {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ReportActionResult>) =>
    startTransition(async () => {
      const { error } = await action();
      if (error) toast({ title: error });
    });
  return [pending, run];
}
