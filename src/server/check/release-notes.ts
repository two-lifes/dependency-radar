import { parseRepositoryField, type GithubRepo } from "../analysis/github-repo";
import { repositoryPageUrl } from "../analysis/package-links";
import {
  type PublishedRelease,
  type ReleaseNote,
  toReleaseNotes,
} from "../analysis/release-notes";
import type { NpmPackageInfo } from "../sources/npm";

/** The card's "Release notes" tab (screens 5.9). */
export type ReleaseNotesView = {
  notes: ReleaseNote[];
  /** For "No release notes published. [Open repository]". */
  repositoryUrl: string | null;
};

/** Where to read releases from; only GitHub publishes them. */
export function releasesRepo(info: NpmPackageInfo): GithubRepo | null {
  return info.repositoryUrl ? parseRepositoryField(info.repositoryUrl) : null;
}

export function toReleaseNotesView(
  info: NpmPackageInfo,
  releases: readonly PublishedRelease[],
  target: { registryName: string; current: string; latest: string },
): ReleaseNotesView {
  return {
    notes: toReleaseNotes(info.registry, releases, target),
    repositoryUrl: info.repositoryUrl
      ? repositoryPageUrl(info.repositoryUrl)
      : null,
  };
}
