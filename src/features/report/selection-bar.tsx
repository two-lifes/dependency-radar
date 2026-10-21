"use client";

import { Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { reportCopy } from "./copy";
import { PackageManagerSwitch } from "./package-manager-switch";
import { useReport } from "./report-context";
import type { ReportRow } from "./report-rows";
import { selectionCommand } from "./selection";

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

  const onCopy = async () => {
    const command = selectionCommand(rows, packageManager);
    if (command === null) {
      toast({ title: copy.nothingToUpdate });
      return;
    }
    try {
      await navigator.clipboard.writeText(command);
      toast({ title: copy.commandCopied, description: command });
    } catch {
      toast({ title: copy.copyFailed, description: command });
    }
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
      <Button variant="secondary" size="sm" onClick={onCopy}>
        <Copy aria-hidden />
        {copy.copyCommand}
      </Button>
      <PackageManagerSwitch />
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X aria-hidden />
        {copy.clear}
      </Button>
    </div>
  );
}
