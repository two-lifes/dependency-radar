"use client";

import { useState } from "react";
import { isOnline } from "@/lib/use-online-status";
import { networkCopy } from "./network-copy";

/** A rejected Server Action must not replace the form with an error boundary. */
export function useNetworkAction<State>(
  action: (previous: State, data: FormData) => Promise<State>,
) {
  const [error, setError] = useState<string>();
  const run = async (previous: State, data: FormData): Promise<State> => {
    if (!isOnline()) return previous;
    setError(undefined);
    try {
      return await action(previous, data);
    } catch {
      setError(networkCopy.failed);
      return previous;
    }
  };
  return { action: run, error };
}
