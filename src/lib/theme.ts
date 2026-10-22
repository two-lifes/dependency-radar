export const THEME_STORAGE_KEY = "theme";

export type ThemePreference = "light" | "dark" | "system";

/*
 * Inlined into <head> so the theme class is set before the first paint (no flash).
 * It runs outside the bundle, so it must be plain ES5 with no imports.
 * Anything other than "light" / "dark" in storage, or storage being unavailable
 * (private mode, blocked cookies), means "system".
 */
export const themeScript = `(function () {
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function preference() {
    try {
      var value = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
      return value === "light" || value === "dark" ? value : "system";
    } catch (error) {
      return "system";
    }
  }
  function apply() {
    var value = preference();
    var dark = value === "dark" || (value === "system" && media.matches);
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  }
  apply();
  media.addEventListener("change", function () {
    if (preference() === "system") apply();
  });
})();`;

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/** The same rule as the script: anything unknown or unreadable is "system". */
export function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

/**
 * Applies the theme right away. The choice still applies when storage is
 * unavailable, it just isn't remembered. The head script's system listener
 * reads storage, so "system" keeps following the OS after this.
 */
export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Not remembered (private mode, blocked storage); applied below anyway.
  }
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}
