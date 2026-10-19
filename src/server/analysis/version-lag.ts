import semver from "semver";

export type Lag =
  | { kind: "current" }
  | { kind: "patch" }
  | { kind: "minor" }
  | { kind: "major"; majors: number };

/**
 * spec 7.3. Plain semver components, so 0.2 → 0.3 is minor. Not
 * `semver.diff`: it reports 1.0.0-rc → 1.0.0 as "major".
 */
export function computeLag(current: string, latest: string): Lag {
  if (semver.gte(current, latest)) return { kind: "current" };

  const from = semver.parse(current);
  const to = semver.parse(latest);
  // Unreachable: semver.gte above throws on invalid versions.
  if (!from || !to) return { kind: "current" };

  if (to.major > from.major) {
    return { kind: "major", majors: to.major - from.major };
  }
  if (to.minor > from.minor) return { kind: "minor" };
  // Also covers a prerelease of the latest version (1.0.0-rc → 1.0.0).
  return { kind: "patch" };
}
