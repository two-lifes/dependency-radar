"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * screens 5.11 "Discard changes?" while `dirty`. In-app links are caught in
 * the capture phase, before Next.js `<Link>` navigates; closing or reloading
 * the tab gets the browser's own prompt. The browser's Back button can't be
 * intercepted in the App Router and leaves without asking.
 */
export function useDiscardGuard(dirty: boolean): {
  /** Where the user tried to go; non-null while the dialog is open. */
  pendingHref: string | null;
  discard: () => void;
  keep: () => void;
} {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }
      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  const discard = useCallback(() => {
    if (pendingHref) router.push(pendingHref);
    setPendingHref(null);
  }, [pendingHref, router]);
  const keep = useCallback(() => setPendingHref(null), []);

  return { pendingHref, discard, keep };
}
