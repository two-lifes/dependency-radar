"use client";

import { debounce, useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import { clearedFilters, filterParsers } from "./filters";

/** screens 5.5: the search filters as you type, 200 ms after the last key. */
export const SEARCH_DELAY_MS = 200;

/**
 * Toolbar and table state in the URL. `filters.q` follows the input at once
 * (nuqs keeps local state ahead of the URL); `appliedQuery` is the value the
 * rows are filtered by.
 */
export function useReportFilters() {
  const [filters, setFilters] = useQueryStates(filterParsers);
  const debounced = useDebouncedValue(filters.q, SEARCH_DELAY_MS);
  // Clearing the field shows every row right away.
  const appliedQuery = filters.q === "" ? "" : debounced;

  return {
    filters,
    appliedQuery,
    setFilters,
    setQuery: (q: string) =>
      setFilters(
        { q },
        { limitUrlUpdates: q === "" ? undefined : debounce(SEARCH_DELAY_MS) },
      ),
    clear: () => setFilters(clearedFilters),
  };
}

export type ReportFilters = ReturnType<typeof useReportFilters>;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
