import { PROJECT_NAME_MAX } from "./copy";

/**
 * `name` of a pasted or uploaded package.json, for "Project name" (screens
 * 5.11). Anything that isn't one yet (half-typed JSON) gives nothing.
 */
export function packageNameFrom(text: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || !("name" in parsed)) {
    return undefined;
  }
  const { name } = parsed;
  if (typeof name !== "string") return undefined;
  const trimmed = name.trim().slice(0, PROJECT_NAME_MAX);
  return trimmed === "" ? undefined : trimmed;
}
