import semver from "semver";
import type { RegistrySpecifier } from "./classify-specifier";
import type { LockedPackage } from "./parse-lockfile";
import type { RegistryPackage } from "./registry-package";
import type { Result } from "./result";

export type UncheckedReason =
  | "not-from-registry"
  | "invalid-specifier"
  | "no-matching-version"
  | "unknown-tag"
  | "no-stable-version"
  // Set by the check engine when a source fails for this package.
  | "not-in-registry"
  | "registry-rate-limited"
  | "registry-unavailable"
  | "vulnerabilities-unavailable";

/** spec 7.3: the `latest` tag, never a prerelease. */
export function resolveLatest(pkg: RegistryPackage): string | undefined {
  const tagged = pkg.distTags.latest;
  if (
    tagged !== undefined &&
    tagged in pkg.versions &&
    semver.valid(tagged) !== null &&
    semver.prerelease(tagged) === null
  ) {
    return tagged;
  }
  // Authors sometimes point `latest` at a beta; the highest stable version is
  // then what "last stable version" (spec 3) means.
  return semver.maxSatisfying(Object.keys(pkg.versions), "*") ?? undefined;
}

/** spec 3: the installed version from the lockfile, else the highest match. */
export function resolveCurrent(
  specifier: RegistrySpecifier,
  locked: LockedPackage | undefined,
  pkg: RegistryPackage,
): Result<string, UncheckedReason> {
  if (locked && semver.valid(locked.version) !== null) {
    return { ok: true, value: locked.version };
  }

  if (specifier.kind === "tag") {
    const version = pkg.distTags[specifier.tag];
    return version === undefined
      ? { ok: false, error: "unknown-tag" }
      : { ok: true, value: version };
  }

  const version = semver.maxSatisfying(
    Object.keys(pkg.versions),
    specifier.range,
  );
  return version === null
    ? { ok: false, error: "no-matching-version" }
    : { ok: true, value: version };
}
