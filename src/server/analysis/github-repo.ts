export type GithubRepo = { owner: string; repo: string };

// GitHub's naming rules; anything else can't be a repository.
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]+$/;

/**
 * The landing's "GitHub URL" input: `https://github.com/owner/repo`, with or
 * without the scheme, `www.`, `.git` or a trailing slash. Deeper paths
 * (`/tree/branch/dir`) are rejected: only the root package.json is checked.
 */
export function parseGithubRepoUrl(input: string): GithubRepo | null {
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    return null;
  }

  const [owner, repo, ...rest] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo || rest.length > 0) return null;
  return toRepo(owner, repo);
}

/**
 * The npm `repository` URL as published: `git+https://github.com/o/r.git`,
 * `git://…`, `git+ssh://git@github.com/o/r.git`, `git@github.com:o/r.git`,
 * `github:o/r` or the bare `o/r` shorthand. Monorepo URLs often point into a
 * subdirectory, so extra path segments are ignored here.
 */
export function parseRepositoryField(value: string): GithubRepo | null {
  const trimmed = value.trim();

  const shorthand = /^(?:github:)?([^/:\s]+)\/([^/:#\s]+?)(?:#.*)?$/.exec(
    trimmed,
  );
  if (shorthand?.[1] && shorthand[2]) return toRepo(shorthand[1], shorthand[2]);

  const scp = /^git@github\.com:([^/]+)\/([^/#]+?)(?:#.*)?$/.exec(trimmed);
  if (scp?.[1] && scp[2]) return toRepo(scp[1], scp[2]);

  let url: URL;
  try {
    url = new URL(trimmed.replace(/^git\+/, ""));
  } catch {
    return null;
  }
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    return null;
  }
  const [owner, repo] = url.pathname.split("/").filter(Boolean);
  return owner && repo ? toRepo(owner, repo) : null;
}

function toRepo(owner: string, rawRepo: string): GithubRepo | null {
  const repo = rawRepo.replace(/\.git$/, "");
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === "." || repo === "..") {
    return null;
  }
  return { owner, repo };
}
