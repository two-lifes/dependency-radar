"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { reportCopy } from "./copy";
import { PACKAGE_MANAGERS } from "./package-manager-preference";
import { useReport } from "./report-context";

/** spec 7.5: sits next to every "Copy update command" button. */
export function PackageManagerSwitch() {
  const { packageManager, setPackageManager } = useReport();
  return (
    <SegmentedControl
      label={reportCopy.packageManager}
      options={PACKAGE_MANAGERS}
      value={packageManager}
      onValueChange={setPackageManager}
    />
  );
}
