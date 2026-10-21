"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PackageManager } from "@/server/analysis/update-command";

export const PACKAGE_MANAGERS: readonly PackageManager[] = [
  "npm",
  "pnpm",
  "yarn",
];

/** decisions 36: per report, so a choice never hides another repo's detected manager. */
export const packageManagerStorageKey = (reportId: string) =>
  `package-manager:${reportId}`;

// Choices that storage refused (blocked site data) still apply until reload.
const unsaved = new Map<string, PackageManager>();
const listeners = new Set<() => void>();

const isManager = (value: unknown): value is PackageManager =>
  PACKAGE_MANAGERS.includes(value as PackageManager);

function read(key: string): PackageManager | null {
  const kept = unsaved.get(key);
  if (kept) return kept;
  try {
    const value = window.localStorage.getItem(key);
    return isManager(value) ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, manager: PackageManager) {
  try {
    window.localStorage.setItem(key, manager);
    unsaved.delete(key);
  } catch {
    unsaved.set(key, manager);
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  // Another tab changed storage: its value wins over an unsaved one here.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null) unsaved.delete(event.key);
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * spec 7.5: the report's detected manager until the user picks another one,
 * then that pick, remembered in this browser for this report.
 */
export function usePackageManager(
  reportId: string,
  detected: PackageManager,
): [PackageManager, (manager: PackageManager) => void] {
  const key = packageManagerStorageKey(reportId);
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key),
    // The server can't see storage, so hydration starts from the detected one.
    () => null,
  );
  const set = useCallback(
    (manager: PackageManager) => write(key, manager),
    [key],
  );
  return [stored ?? detected, set];
}
