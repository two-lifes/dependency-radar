"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { reportCopy } from "./copy";
import { SAVED_PARAM } from "./saved-report";

/**
 * screens 5.4: "Project saved" after `/r/[id]/save`, which can only pass it
 * in the URL. The param is dropped without a history entry, so a reload or
 * a copied link doesn't show the toast again.
 */
export function ProjectSavedToast() {
  const [saved, setSaved] = useQueryState(SAVED_PARAM, parseAsString);
  // Strict Mode runs the effect twice before the URL update lands.
  const shown = useRef(false);

  useEffect(() => {
    if (saved !== "1" || shown.current) return;
    shown.current = true;
    toast({ title: reportCopy.actions.projectSaved });
    void setSaved(null, { history: "replace" });
  }, [saved, setSaved]);

  return null;
}
