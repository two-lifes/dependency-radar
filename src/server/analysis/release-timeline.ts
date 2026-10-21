import semver from "semver";
import type { RegistryPackage } from "./registry-package";

/** One dot on the package card's release scale (screens 5.9). */
export type TimelineRelease = {
  version: string;
  publishedAt: string | null;
  /** 0..1 from the current release to the latest one. */
  position: number;
  /**
   * The major version changes here: always possibly breaking (spec 7.2).
   * Minor releases flagged by their release notes come with task 19.
   */
  major: boolean;
};

/** Stable releases after `current` up to `latest`, oldest first. */
export function releaseTimeline(
  registry: RegistryPackage,
  current: string,
  latest: string,
): TimelineRelease[] {
  if (semver.valid(current) === null || semver.valid(latest) === null) {
    return [];
  }
  const versions = Object.keys(registry.versions)
    .filter(
      (version) =>
        semver.valid(version) !== null &&
        semver.prerelease(version) === null &&
        semver.gt(version, current) &&
        semver.lte(version, latest),
    )
    .sort(semver.compare);

  const dates = versions.map((version) => publishedMs(registry, version));
  const start = publishedMs(registry, current);
  const end = dates.at(-1);
  // By date when every point has one; otherwise evenly, so a missing date
  // can't pile the dots up at one end.
  const byDate =
    start !== undefined &&
    end !== undefined &&
    end > start &&
    dates.every((date) => date !== undefined);

  return versions.map((version, index) => {
    const date = dates[index];
    const position =
      byDate && date !== undefined
        ? clamp((date - start) / (end - start))
        : (index + 1) / versions.length;
    const previous = index === 0 ? current : versions[index - 1];
    return {
      version,
      publishedAt: registry.time[version] ?? null,
      position,
      major:
        previous !== undefined &&
        semver.major(version) > semver.major(previous),
    };
  });
}

function publishedMs(
  registry: RegistryPackage,
  version: string,
): number | undefined {
  const iso = registry.time[version];
  if (iso === undefined) return undefined;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
