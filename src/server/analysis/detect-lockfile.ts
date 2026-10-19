export type LockfileFormat = "npm" | "pnpm" | "yarn";

/**
 * Recognizes a lockfile pasted or uploaded in place of package.json.
 * Only the format is detected; the content is not parsed.
 */
export function detectLockfile(text: string): LockfileFormat | undefined {
  if (text.includes("# yarn lockfile v1")) return "yarn";

  const firstLine = firstMeaningfulLine(text);
  if (firstLine === undefined) return undefined;
  if (firstLine.startsWith("lockfileVersion:")) return "pnpm";
  if (firstLine.startsWith("__metadata:")) return "yarn";
  if (firstLine.startsWith("{")) return isPackageLock(text) ? "npm" : undefined;
  return undefined;
}

function isPackageLock(text: string): boolean {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // Broken JSON is reported by the caller as invalid JSON, not as a lockfile.
    return false;
  }
  return (
    typeof raw === "object" &&
    raw !== null &&
    !Array.isArray(raw) &&
    "lockfileVersion" in raw
  );
}

// YAML lockfiles may open with a BOM, blank lines, `#` comments (yarn berry)
// and the `---` document marker (pnpm lockfile v9) before the first key.
function firstMeaningfulLine(text: string): string | undefined {
  for (const line of text.replace(/^﻿/, "").split("\n")) {
    const trimmed = line.trim();
    if (trimmed !== "" && trimmed !== "---" && !trimmed.startsWith("#")) {
      return trimmed;
    }
  }
  return undefined;
}
