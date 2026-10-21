"use client";

import { parseAsString, useQueryState } from "nuqs";

/**
 * `?pkg=` (screens 5.9). Opening and closing add a history entry, so the
 * browser's Back closes the card; `j`/`k` replace it.
 */
export function useOpenPackage() {
  const [pkg, setPkg] = useQueryState("pkg", parseAsString);
  return {
    pkg,
    openPackage: (name: string) => void setPkg(name, { history: "push" }),
    switchPackage: (name: string) => void setPkg(name, { history: "replace" }),
    closePackage: () => void setPkg(null, { history: "push" }),
    /** A `pkg` that isn't in the report: drop it without a history entry. */
    dropPackage: () => void setPkg(null, { history: "replace" }),
  };
}

/** Whether a click or key landed on a control inside a clickable row. */
export function fromNestedControl(
  target: EventTarget,
  row: HTMLElement,
): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest("a, button, input, label, [role=checkbox]");
  return control !== null && control !== row && row.contains(control);
}
