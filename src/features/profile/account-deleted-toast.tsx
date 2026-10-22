"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { ACCOUNT_DELETED_PARAM } from "./account-deleted";
import { profileCopy } from "./copy";

/**
 * "Account deleted" on the landing after `deleteAccount` redirects there,
 * the same way as "Project saved" (decisions 45): shown once, then the param
 * is dropped without a history entry.
 */
export function AccountDeletedToast() {
  const [deleted, setDeleted] = useQueryState(
    ACCOUNT_DELETED_PARAM,
    parseAsString,
  );
  // Strict Mode runs the effect twice before the URL update lands.
  const shown = useRef(false);

  useEffect(() => {
    if (deleted !== "1" || shown.current) return;
    shown.current = true;
    toast({ title: profileCopy.danger.done });
    void setDeleted(null, { history: "replace" });
  }, [deleted, setDeleted]);

  return null;
}
