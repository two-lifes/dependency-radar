"use client";

import { useTransition } from "react";
import { toast } from "@/components/ui/toast";
import type { ReportActionResult } from "./actions";
import { useGuestQuota } from "../guest-quota/guest-quota";

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
  const quota = useGuestQuota();
  const run = (action: () => Promise<ReportActionResult>) =>
    startTransition(async () => {
      const { error, code } = await action();
      if (code === "guest-quota-exhausted") quota.exhausted();
      else if (quota.state.kind !== "account") await quota.refresh();
      if (error) toast({ title: error });
    });
  return [pending, run];
}
