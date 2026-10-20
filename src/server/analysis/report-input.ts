import { detectPackageManager } from "./detect-package-manager";
import type { LockedPackage, LockfileError } from "./parse-lockfile";
import {
  type ManifestDependency,
  type ManifestError,
  type ManifestWarning,
  parseManifest,
} from "./parse-manifest";
import type { Result } from "./result";
import type { PackageManager } from "./update-command";

/** Stored with the report and shown on it; a broken lockfile never blocks a check. */
export type ReportWarning =
  ManifestWarning | "lockfile-too-large" | "lockfile-unsupported";

/** What a new report stores, whatever the source (paste, upload, GitHub). */
export type ReportInput = {
  name?: string;
  dependencies: ManifestDependency[];
  /** Lockfile entries of direct dependencies; null when no usable lockfile. */
  lockedVersions: Record<string, LockedPackage> | null;
  warnings: ReportWarning[];
  packageManager: PackageManager;
};

export type LockedVersionsResult = Result<
  Record<string, LockedPackage>,
  LockfileError
>;

const LOCKFILE_WARNING: Record<LockfileError["code"], ReportWarning> = {
  "too-large": "lockfile-too-large",
  unsupported: "lockfile-unsupported",
};

export function buildReportInput(input: {
  packageJson: string;
  lockfile?: LockedVersionsResult;
  /** Root file names of a GitHub repository, for `detectPackageManager`. */
  repoFiles?: readonly string[];
}): Result<ReportInput, ManifestError> {
  const manifest = parseManifest(input.packageJson);
  if (!manifest.ok) return manifest;
  const { name, packageManager, dependencies, warnings } = manifest.value;

  const reportWarnings: ReportWarning[] = [...warnings];
  let lockedVersions: Record<string, LockedPackage> | null = null;
  if (input.lockfile?.ok) {
    lockedVersions = pickLockedVersions(
      new Map(Object.entries(input.lockfile.value)),
      dependencies.map((dep) => dep.name),
    );
  } else if (input.lockfile) {
    reportWarnings.push(LOCKFILE_WARNING[input.lockfile.error.code]);
  }

  return {
    ok: true,
    value: {
      ...(name !== undefined && { name }),
      dependencies,
      lockedVersions,
      warnings: reportWarnings,
      packageManager: detectPackageManager({
        packageManager,
        files: input.repoFiles,
      }),
    },
  };
}

/**
 * Hoisted transitive packages are top-level in package-lock.json too, so a
 * lockfile has hundreds of entries where a report needs only the direct ones.
 */
export function pickLockedVersions(
  locked: ReadonlyMap<string, LockedPackage>,
  names: readonly string[],
): Record<string, LockedPackage> {
  const picked: Record<string, LockedPackage> = {};
  for (const name of names) {
    const entry = locked.get(name);
    if (entry) picked[name] = entry;
  }
  return picked;
}
