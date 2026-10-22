import { parseGithubRepoUrl } from "@/server/analysis/github-repo";
import type { ManifestError } from "@/server/analysis/parse-manifest";
import {
  buildReportInput,
  type ReportInput,
} from "@/server/analysis/report-input";
import type { Result } from "@/server/analysis/result";
import { lockedVersionsFromText } from "@/server/lockfile-upload";
import { fetchRepoSource } from "@/server/sources/github";
import {
  type GithubInputError,
  githubErrorCopy,
  manifestErrorCopy,
} from "./copy";

/**
 * The report input of a public GitHub repository, read the same way for a new
 * report (landing) and for "Check again" (decisions 42). Errors come back as
 * screens 5.1 messages.
 */
export async function readRepoInput(
  url: string,
): Promise<Result<{ input: ReportInput; repoUrl: string }, string>> {
  const repo = parseGithubRepoUrl(url);
  if (!repo) {
    return { ok: false, error: githubMessage({ code: "invalid-url" }) };
  }
  const source = await fetchRepoSource(repo, {
    token: process.env.GITHUB_TOKEN,
  });
  if (!source.ok) return { ok: false, error: githubMessage(source.error) };

  const { packageJson, packageLock, files } = source.value;
  const lockfile =
    packageLock === undefined ? undefined : lockedVersionsFromText(packageLock);
  const result = buildReportInput({ packageJson, lockfile, repoFiles: files });
  if (!result.ok) return { ok: false, error: manifestMessage(result.error) };
  return {
    ok: true,
    value: {
      input: result.value,
      repoUrl: `https://github.com/${repo.owner}/${repo.repo}`,
    },
  };
}

function githubMessage(error: GithubInputError): string {
  switch (error.code) {
    case "invalid-url":
      return githubErrorCopy[error.code](error);
    case "not-found":
      return githubErrorCopy[error.code](error);
    case "no-package-json":
      return githubErrorCopy[error.code](error);
    case "unavailable":
      return githubErrorCopy[error.code](error);
    case "invalid-response":
      return githubErrorCopy[error.code](error);
    case "rate-limited":
      return githubErrorCopy[error.code](error);
  }
}

export function manifestMessage(error: ManifestError): string {
  switch (error.code) {
    case "too-large":
      return manifestErrorCopy["too-large"](error);
    case "invalid-json":
      return manifestErrorCopy["invalid-json"](error);
    case "lockfile":
      return manifestErrorCopy.lockfile(error);
    case "invalid-package-json":
      return manifestErrorCopy["invalid-package-json"](error);
    case "no-dependencies":
      return manifestErrorCopy["no-dependencies"](error);
    case "too-many-dependencies":
      return manifestErrorCopy["too-many-dependencies"](error);
  }
}
