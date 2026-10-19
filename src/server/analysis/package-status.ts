import type { RegistryPackage } from "./registry-package";

export type PackageStatus = "active" | "stale" | "deprecated";

export type PackageStatusResult = {
  status: PackageStatus;
  deprecationMessage?: string;
  /** Publish date of the most recent version of any kind, ISO string. */
  lastReleaseAt?: string;
};

const STALE_AFTER_MONTHS = 12;

/**
 * screens 5.5. Only a deprecated latest version marks the package: an old
 * deprecated version just means "upgrade", which the lag already shows.
 */
export function packageStatus(
  pkg: RegistryPackage,
  latest: string,
  now: Date,
): PackageStatusResult {
  const lastReleaseAt = findLastReleaseAt(pkg);
  const deprecationMessage = pkg.versions[latest]?.deprecated;

  const result = (status: PackageStatus): PackageStatusResult => ({
    status,
    ...(deprecationMessage !== undefined && { deprecationMessage }),
    ...(lastReleaseAt !== undefined && { lastReleaseAt }),
  });

  if (deprecationMessage !== undefined) return result("deprecated");

  const staleBefore = new Date(now);
  staleBefore.setUTCMonth(staleBefore.getUTCMonth() - STALE_AFTER_MONTHS);
  if (
    lastReleaseAt !== undefined &&
    Date.parse(lastReleaseAt) < staleBefore.getTime()
  ) {
    return result("stale");
  }
  return result("active");
}

// `time` also holds `created`, `modified` and dates of unpublished versions,
// so only versions still in `versions` count.
function findLastReleaseAt(pkg: RegistryPackage): string | undefined {
  let last: string | undefined;
  for (const version of Object.keys(pkg.versions)) {
    const date = pkg.time[version];
    if (date === undefined || Number.isNaN(Date.parse(date))) continue;
    if (last === undefined || Date.parse(date) > Date.parse(last)) last = date;
  }
  return last;
}
