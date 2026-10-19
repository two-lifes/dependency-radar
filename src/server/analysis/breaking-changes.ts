import { computeLag } from "./version-lag";

const SECTION_WORDS =
  /\b(breaking|remov(ed|als?)|deprecat(ed|ions?)|backwards?[- ]incompatib(le|ility))\b/i;

// Uppercase only: "breaking change" in prose ("fixes a breaking change") is
// not a marker, but the conventional-commit footer is.
const UPPERCASE_MARKER = /\bBREAKING(?:[ -]CHANGES?\b|:)/;

const HEADING = /^ {0,3}#{1,6}\s+(.+)$/gm;
const BOLD_LINE = /^\s*(\*\*|__)(.+?)\1:?\s*$/gm;
// `feat!:` / `fix(scope)!:`, optionally as a list item.
const CONVENTIONAL_BANG = /^\s*(?:[-*+]\s+)?[a-z]+(?:\([^)]*\))?!:/m;

/**
 * spec 7.2: section titles like "Breaking", "Removed", "Deprecated" or the
 * conventional-commit markers. A heuristic, shown as "Possibly breaking".
 */
export function hasBreakingSigns(notes: string): boolean {
  if (UPPERCASE_MARKER.test(notes) || CONVENTIONAL_BANG.test(notes)) {
    return true;
  }
  const titles = [
    ...[...notes.matchAll(HEADING)].map((match) => match[1] ?? ""),
    ...[...notes.matchAll(BOLD_LINE)].map((match) => match[2] ?? ""),
  ];
  return titles.some((title) => SECTION_WORDS.test(title));
}

/**
 * spec 7.2: a major release is always possibly breaking; a minor one only by
 * its notes. Patch releases are not checked.
 */
export function isPossiblyBreaking(release: {
  /** The version before this release. */
  from: string;
  to: string;
  notes?: string;
}): boolean {
  const lag = computeLag(release.from, release.to);
  if (lag.kind === "major") return true;
  if (lag.kind === "minor") return hasBreakingSigns(release.notes ?? "");
  return false;
}
