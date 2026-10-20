import { z } from "zod";
import type { GithubRepo } from "../analysis/github-repo";
import type { Result } from "../analysis/result";
import { type Cache, withCache } from "./cache";
import {
  fetchJson,
  type FetchJsonOptions,
  fetchText,
  type SourceError,
} from "./http";
import type { Limiter } from "./limiter";

export const GITHUB_API_URL = "https://api.github.com";
const API_VERSION = "2026-03-10";
// Releases for the package card (task 19): the first page is enough.
const RELEASES_PER_PAGE = 100;

export type GithubClientOptions = {
  /** `GITHUB_TOKEN`; without it GitHub allows 60 requests per hour. */
  token?: string;
  http?: FetchJsonOptions;
};

export type GithubReleasesOptions = GithubClientOptions & {
  cache: Cache;
  limit: Limiter;
};

export type GithubSourceError = SourceError | { code: "no-package-json" };

/** What a check needs from a repository, read from its default branch. */
export type RepoSource = {
  packageJson: string;
  packageLock?: string;
  /** Names in the repository root, for `detectPackageManager`. */
  files: string[];
};

export type GithubRelease = {
  tag: string;
  name?: string;
  body?: string;
  publishedAt?: string;
  url: string;
  prerelease: boolean;
};

const repoSchema = z.object({ private: z.boolean() });

const listingSchema = z.array(z.object({ name: z.string() }));

const releasesResponseSchema = z.array(
  z.object({
    tag_name: z.string(),
    name: z.string().nullish(),
    body: z.string().nullish(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    published_at: z.string().nullish(),
    html_url: z.string(),
  }),
);

const releasesSchema: z.ZodType<GithubRelease[]> = z.array(
  z.object({
    tag: z.string(),
    name: z.string().optional(),
    body: z.string().optional(),
    publishedAt: z.string().optional(),
    url: z.string(),
    prerelease: z.boolean(),
  }),
);

/**
 * package.json, package-lock.json (if any) and the root file names of a public
 * repository. Not cached: it is the report's input, read once and stored.
 */
export async function fetchRepoSource(
  { owner, repo }: GithubRepo,
  options: GithubClientOptions = {},
): Promise<Result<RepoSource, GithubSourceError>> {
  const base = repoUrl({ owner, repo });

  const meta = await fetchJson(base, repoSchema, request(options));
  if (!meta.ok) return meta;
  // spec 9: only public data. The server token may see its owner's private
  // repositories; they get the same answer as for a stranger.
  if (meta.value.private) return { ok: false, error: { code: "not-found" } };

  const listing = await fetchJson(
    `${base}/contents/`,
    listingSchema,
    request(options),
  );
  if (!listing.ok) {
    // An empty repository has no contents at all.
    return listing.error.code === "not-found"
      ? { ok: false, error: { code: "no-package-json" } }
      : listing;
  }
  const files = listing.value.map((entry) => entry.name);
  if (!files.includes("package.json")) {
    return { ok: false, error: { code: "no-package-json" } };
  }

  const [packageJson, packageLock] = await Promise.all([
    fetchText(`${base}/contents/package.json`, request(options, RAW)),
    files.includes("package-lock.json")
      ? fetchText(`${base}/contents/package-lock.json`, request(options, RAW))
      : undefined,
  ]);
  if (!packageJson.ok) {
    return packageJson.error.code === "not-found"
      ? { ok: false, error: { code: "no-package-json" } }
      : packageJson;
  }
  // The lockfile only refines versions; without it the check still runs.
  if (packageLock && !packageLock.ok) {
    console.error(
      `[sources] ${owner}/${repo} package-lock.json skipped`,
      packageLock.error,
    );
  }

  return {
    ok: true,
    value: {
      packageJson: packageJson.value,
      packageLock: packageLock?.ok ? packageLock.value : undefined,
      files,
    },
  };
}

/** Published releases, newest first as GitHub returns them. */
export function fetchReleases(
  { owner, repo }: GithubRepo,
  options: GithubReleasesOptions,
): Promise<Result<GithubRelease[], SourceError>> {
  // Owner and repository names are case-insensitive on GitHub.
  const key = `github:releases:${owner}/${repo}`.toLowerCase();
  return withCache(options.cache, key, releasesSchema, () =>
    options.limit(async () => {
      const result = await fetchJson(
        `${repoUrl({ owner, repo })}/releases?per_page=${RELEASES_PER_PAGE}`,
        releasesResponseSchema,
        request(options),
      );
      if (!result.ok) return result;
      return {
        ok: true,
        value: result.value
          // Drafts are visible only with push access; never show them.
          .filter((release) => !release.draft)
          .map((release) => ({
            tag: release.tag_name,
            name: release.name ?? undefined,
            body: release.body ?? undefined,
            publishedAt: release.published_at ?? undefined,
            url: release.html_url,
            prerelease: release.prerelease,
          })),
      };
    }),
  );
}

const JSON_MEDIA = "application/vnd.github+json";
const RAW = "application/vnd.github.raw+json";

function repoUrl({ owner, repo }: GithubRepo): string {
  return `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function request(
  options: GithubClientOptions,
  accept: string = JSON_MEDIA,
): FetchJsonOptions {
  return {
    ...options.http,
    headers: {
      accept,
      "x-github-api-version": API_VERSION,
      // GitHub rejects requests without a User-Agent.
      "user-agent": "dependency-radar",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.http?.headers,
    },
  };
}
