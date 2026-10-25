"use client";

import { useSyncExternalStore } from "react";

// Hydration is a one-way transition; there is no external event to subscribe to.
const subscribe = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function useHydrated() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
