"use client";

import { useState, useTransition } from "react";
import { isOnline } from "@/lib/use-online-status";
import { networkCopy } from "../system/network-copy";
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
  error: string | undefined,
] {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string>();
  const quota = useGuestQuota();
  const run = (action: () => Promise<ReportActionResult>) => {
    if (!isOnline() || pending) return;
    setFailure(undefined);
    startTransition(async () => {
      try {
        const { error, code } = await action();
        if (code === "guest-quota-exhausted") quota.exhausted();
        else if (quota.state.kind !== "account") await quota.refresh();
        setFailure(error);
        if (error) toast({ title: error });
      } catch {
        setFailure(networkCopy.failed);
      }
    });
  };
  return [pending, run, failure];
}
