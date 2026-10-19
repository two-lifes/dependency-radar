import { classifySpecifier } from "./classify-specifier";
import { packageStatus, type PackageStatusResult } from "./package-status";
import type { LockedPackage } from "./parse-lockfile";
import type { ManifestDependency } from "./parse-manifest";
import type { RegistryPackage } from "./registry-package";
import {
  resolveCurrent,
  resolveLatest,
  type UncheckedReason,
} from "./resolve-versions";
import { computeLag, type Lag } from "./version-lag";

export type PackageAnalysis =
  | ({
      checked: true;
      /** Name looked up in the registry: the real name for `npm:` aliases. */
      registryName: string;
      current: string;
      latest: string;
      lag: Lag;
    } & PackageStatusResult)
  | { checked: false; reason: UncheckedReason };

export function analyzePackage(input: {
  dependency: ManifestDependency;
  /** Lockfile entry under the installed name (the alias name for `npm:`). */
  locked?: LockedPackage;
  registry: RegistryPackage;
  now: Date;
}): PackageAnalysis {
  const spec = classifySpecifier(input.dependency.specifier);
  if (spec.kind === "non-registry") {
    return { checked: false, reason: "not-from-registry" };
  }
  if (spec.kind === "invalid") {
    return { checked: false, reason: "invalid-specifier" };
  }

  const latest = resolveLatest(input.registry);
  if (latest === undefined) {
    return { checked: false, reason: "no-stable-version" };
  }

  const current = resolveCurrent(
    spec.kind === "alias" ? spec.inner : spec,
    input.locked,
    input.registry,
  );
  if (!current.ok) return { checked: false, reason: current.error };

  return {
    checked: true,
    registryName: spec.kind === "alias" ? spec.name : input.dependency.name,
    current: current.value,
    latest,
    lag: computeLag(current.value, latest),
    ...packageStatus(input.registry, latest, input.now),
  };
}
