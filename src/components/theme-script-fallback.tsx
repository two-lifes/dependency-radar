"use client";

import { useLayoutEffect } from "react";
import { themeScript } from "@/lib/theme";

/**
 * `notFound()` with a real 404 status makes Next send an error shell and
 * render the root layout on the client, where the inline <head> script never
 * runs. The script always sets `color-scheme` on <html>, so an empty one means
 * it didn't run; an inserted <script> element does run, with the same code.
 */
export function ThemeScriptFallback() {
  useLayoutEffect(() => {
    if (document.documentElement.style.colorScheme) return;
    const script = document.createElement("script");
    script.textContent = themeScript;
    document.head.append(script);
  }, []);
  return null;
}
