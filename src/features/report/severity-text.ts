import type { Severity } from "@/server/analysis/severity";

/** The highest severity colours the vulnerability count (table and cards). */
export const severityText: Record<Severity, string> = {
  critical: "text-critical",
  high: "text-danger",
  moderate: "text-moderate",
  low: "text-muted-foreground",
};
