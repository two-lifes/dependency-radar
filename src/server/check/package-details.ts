import { npmPageUrl, repositoryPageUrl } from "../analysis/package-links";
import {
  releaseTimeline,
  type TimelineRelease,
} from "../analysis/release-timeline";
import type { NpmPackageInfo } from "../sources/npm";

/** What the package card adds to the report row (screens 5.9). */
export type PackageDetails = {
  description: string | null;
  license: string | null;
  npmUrl: string;
  repositoryUrl: string | null;
  releases: TimelineRelease[];
};

export function toPackageDetails(
  info: NpmPackageInfo,
  target: { registryName: string; current: string; latest: string },
): PackageDetails {
  const description = info.description?.trim();
  return {
    description: description ? description : null,
    license: info.license ?? null,
    npmUrl: npmPageUrl(target.registryName),
    repositoryUrl: info.repositoryUrl
      ? repositoryPageUrl(info.repositoryUrl)
      : null,
    releases: releaseTimeline(info.registry, target.current, target.latest),
  };
}
