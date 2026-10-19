import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge only knows the default theme. Without this, `text-hero` is read as a
 * text color (so `text-sm text-hero` keeps both sizes) and `shadow-overlay` as a
 * shadow color. Keep in sync with the custom `--text-*` and `--shadow-*` in globals.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["2xs", "md", "hero"],
      shadow: ["overlay"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
