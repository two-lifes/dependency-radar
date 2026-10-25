"use client";

import { useSyncExternalStore } from "react";

function subscribe(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

// The server and hydration must agree before reading the browser's status.
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
