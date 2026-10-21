import { parseRepositoryField } from "./github-repo";

/** The package page on npmjs.com; scoped names keep their slash there. */
export function npmPageUrl(registryName: string): string {
  return `https://www.npmjs.com/package/${registryName}`;
}

/**
 * A browsable page for npm's `repository` field. GitHub forms (`github:o/r`,
 * `git@github.com:o/r.git`, …) map to the repository root; other hosts only
 * when the field is already an http(s) URL. Anything else gets no link.
 */
export function repositoryPageUrl(value: string): string | null {
  const github = parseRepositoryField(value);
  if (github) return `https://github.com/${github.owner}/${github.repo}`;

  let url: URL;
  try {
    url = new URL(value.trim().replace(/^git\+/, ""));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.pathname = url.pathname.replace(/\.git$/, "");
  url.hash = "";
  return url.toString();
}
