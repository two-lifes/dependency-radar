"use client";

import { Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { reportCopy } from "./copy";
import { copyUpdateCommand } from "./copy-command";
import { PackageManagerSwitch } from "./package-manager-switch";
import { useReport } from "./report-context";
import type { ReportRow } from "./report-rows";
import { selectionCommand, updateTargets } from "./selection";

const copy = reportCopy.selection;

/** screens 5.5: takes the toolbar's place while at least one row is selected. */
export function SelectionBar({
  rows,
  onClear,
}: {
  rows: readonly ReportRow[];
  onClear: () => void;
}) {
  const { packageManager } = useReport();
  // Can be below "N selected": up to date and unchecked rows are left out.
  const updatable = updateTargets(rows).length;

  const onCopy = async () => {
    const command = selectionCommand(rows, packageManager);
    if (command === null) {
      toast({ title: copy.nothingToUpdate });
      return;
    }
    await copyUpdateCommand(command);
  };

  return (
    <div
      role="group"
      aria-label={copy.label}
      className="flex min-h-9 flex-wrap items-center gap-2"
    >
      <p aria-live="polite" className="text-base font-medium tabular-nums">
        {copy.selected(rows.length)}
      </p>
      <Button
        variant="secondary"
        size="sm"
        aria-label={copy.copyCommandLabel(updatable)}
        onClick={onCopy}
      >
        <Copy aria-hidden />
        {copy.copyCommand(updatable)}
      </Button>
      <PackageManagerSwitch />
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X aria-hidden />
        {copy.clear}
      </Button>
    </div>
  );
}
