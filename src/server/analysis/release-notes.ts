import semver from "semver";
import { isPossiblyBreaking } from "./breaking-changes";
import type { RegistryPackage } from "./registry-package";
import { versionsSince } from "./release-timeline";

/** A published release as the GitHub source returns it. */
export type PublishedRelease = {
  tag: string;
  name?: string;
  body?: string;
  publishedAt?: string;
  url: string;
  prerelease: boolean;
};

/** One collapsed entry in the card's "Release notes" tab (screens 5.9). */
export type ReleaseNote = {
  version: string;
  /** The release name, when it says more than the tag. */
  title: string | null;
  body: string | null;
  url: string;
  publishedAt: string | null;
  possiblyBreaking: boolean;
};

/**
 * The npm version a release tag stands for: `1.2.3`, `v1.2.3`,
 * `name@1.2.3`, `@scope/name@1.2.3` or `name-v1.2.3` (release-please). In a
 * monorepo another package's tag (`other@1.2.3`) is not ours.
 */
export function releaseVersion(
  tag: string,
  registryName: string,
): string | null {
  let rest = tag.trim();
  const at = rest.lastIndexOf("@");
  if (at > 0) {
    if (rest.slice(0, at) !== registryName) return null;
    rest = rest.slice(at + 1);
  } else {
    const base = registryName.slice(registryName.lastIndexOf("/") + 1);
    if (rest.startsWith(`${base}-`)) rest = rest.slice(base.length + 1);
  }
  rest = rest.replace(/^v/i, "");
  return semver.valid(rest) === rest ? rest : null;
}

/**
 * Notes of the stable versions after `current` up to `latest`, newest first.
 * Versions without a release are left out. Whether a release is possibly
 * breaking is judged against the version npm published before it, not the
 * previous release: a version without notes would hide a major bump.
 */
export function toReleaseNotes(
  registry: RegistryPackage,
  releases: readonly PublishedRelease[],
  target: { registryName: string; current: string; latest: string },
): ReleaseNote[] {
  const byVersion = new Map<string, PublishedRelease>();
  for (const release of releases) {
    if (release.prerelease) continue;
    const version = releaseVersion(release.tag, target.registryName);
    // GitHub lists newest first; a duplicate tag (`v1.0.0` and `1.0.0`)
    // keeps the newer release.
    if (version !== null && !byVersion.has(version)) {
      byVersion.set(version, release);
    }
  }

  const versions = versionsSince(registry, target.current, target.latest);
  const notes: ReleaseNote[] = [];
  versions.forEach((version, index) => {
    const release = byVersion.get(version);
    if (!release) return;
    const body = release.body?.trim();
    const name = release.name?.trim();
    notes.push({
      version,
      title:
        name &&
        name !== release.tag &&
        name !== version &&
        name !== `v${version}`
          ? name
          : null,
      body: body ? body : null,
      url: release.url,
      publishedAt: release.publishedAt ?? registry.time[version] ?? null,
      possiblyBreaking: isPossiblyBreaking({
        from: versions[index - 1] ?? target.current,
        to: version,
        notes: body,
      }),
    });
  });
  return notes.reverse();
}
