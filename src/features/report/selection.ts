import {
  updateCommands,
  type PackageManager,
  type UpdateTarget,
} from "@/server/analysis/update-command";
import type { ReportRow } from "./report-rows";

export type HeaderCheckState = boolean | "indeterminate";

/**
 * Rows hidden by a filter or the search leave the selection, so the count and
 * the copied command always match what is on screen.
 */
export function pruneSelection(
  selected: ReadonlySet<string>,
  visible: readonly string[],
): ReadonlySet<string> {
  const kept = visible.filter((name) => selected.has(name));
  return kept.length === selected.size ? selected : new Set(kept);
}

/** The header checkbox speaks for the filtered rows only (screens 5.5). */
export function headerState(
  selected: ReadonlySet<string>,
  visible: readonly string[],
): HeaderCheckState {
  const count = visible.filter((name) => selected.has(name)).length;
  if (count === 0) return false;
  return count === visible.length ? true : "indeterminate";
}

/**
 * What a copied command updates: checked rows behind the latest version.
 * Rows that are up to date, pending or not checked have nothing to update.
 */
export function updateTargets(rows: readonly ReportRow[]): UpdateTarget[] {
  return rows.flatMap((row): UpdateTarget[] => {
    const result = row.result;
    if (
      !result?.checked ||
      result.registryName === null ||
      result.latest === null ||
      result.lagKind === null ||
      result.lagKind === "current"
    ) {
      return [];
    }
    return [
      {
        name: row.name,
        registryName: result.registryName,
        version: result.latest,
        type: row.type,
      },
    ];
  });
}

/**
 * spec 7.5 for the selection bar and the toolbar: one line, prod and dev
 * commands joined with `&&` so a single paste runs both; null when no row
 * has anything to update.
 */
export function selectionCommand(
  rows: readonly ReportRow[],
  manager: PackageManager,
): string | null {
  const commands = updateCommands(manager, updateTargets(rows));
  return commands.length > 0 ? commands.join(" && ") : null;
}
