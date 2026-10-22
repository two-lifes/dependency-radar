import { parseGithubRepoUrl } from "@/server/analysis/github-repo";
import type { GithubUserRepo } from "@/server/sources/github";

/** screens 5.11.1: a repository row; `projectId` marks it "Added". */
export type RepoRow = GithubUserRepo & { projectId?: string };

export type GithubRepoList = { login: string; repos: RepoRow[] };

/**
 * Links each repository to the user's project that already checks it. GitHub
 * names are case-insensitive, and a stored URL may differ from `html_url` in
 * case, `www.` or a `.git` suffix, so both sides are compared parsed.
 */
export function markAdded(
  repos: GithubUserRepo[],
  projects: { projectId: string; repoUrl: string | null }[],
): RepoRow[] {
  const added = new Map<string, string>();
  for (const { projectId, repoUrl } of projects) {
    const key = repoUrl === null ? null : repoKey(repoUrl);
    if (key !== null && !added.has(key)) added.set(key, projectId);
  }
  return repos.map((repo) => {
    const key = repoKey(repo.url);
    const projectId = key === null ? undefined : added.get(key);
    return projectId ? { ...repo, projectId } : repo;
  });
}

/** screens 5.11.1: search by name in the browser, no request. */
export function filterRepos<T extends GithubUserRepo>(
  repos: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return repos;
  return repos.filter((repo) => repo.fullName.toLowerCase().includes(needle));
}

function repoKey(url: string): string | null {
  const repo = parseGithubRepoUrl(url);
  return repo ? `${repo.owner}/${repo.repo}`.toLowerCase() : null;
}
