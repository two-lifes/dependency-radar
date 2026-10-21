import type { LockfileError } from "@/server/analysis/parse-lockfile";
import type {
  ManifestError,
  ManifestWarning,
} from "@/server/analysis/parse-manifest";
import type { GithubSourceError } from "@/server/sources/github";

/** A GitHub URL the landing couldn't parse, or a failed repository read. */
export type GithubInputError = GithubSourceError | { code: "invalid-url" };

const megabytes = (bytes: number) => bytes / (1024 * 1024);

// screens 5.1; keyed by error code so a new code fails typecheck until it has text.
export const manifestErrorCopy: {
  [K in ManifestError["code"]]: (
    error: Extract<ManifestError, { code: K }>,
  ) => string;
} = {
  "too-large": ({ maxBytes }) =>
    `File is too large (max ${megabytes(maxBytes)} MB).`,
  "invalid-json": ({ line }) =>
    line === undefined
      ? "This doesn't look like valid JSON."
      : `This doesn't look like valid JSON (line ${line}).`,
  // Only package-lock.json is accepted in Upload, so only it gets that hint.
  lockfile: ({ format }) =>
    format === "npm"
      ? "This is a lockfile. Paste package.json instead (you can add the lockfile in Upload)."
      : "This is a lockfile. Paste package.json instead.",
  "invalid-package-json": () => "This doesn't look like a valid package.json.",
  "no-dependencies": () => "No dependencies found in this file.",
  "too-many-dependencies": ({ max }) => `Too many dependencies (max ${max}).`,
};

export const manifestWarningCopy: Record<ManifestWarning, string> = {
  workspaces:
    "Workspaces aren't supported yet — checking root package.json only.",
};

// A broken lockfile never blocks the check; it is ignored with a warning.
export const lockfileWarningCopy: {
  [K in LockfileError["code"]]: (
    error: Extract<LockfileError, { code: K }>,
  ) => string;
} = {
  "too-large": ({ maxBytes }) =>
    `Lockfile is too large (max ${megabytes(maxBytes)} MB) — using version ranges instead.`,
  unsupported: () =>
    "Couldn't read package-lock.json (only v2/v3 supported) — using version ranges instead.",
};

const GITHUB_UNAVAILABLE = "Couldn't reach GitHub. Try again in a moment.";

/** Without a hint GitHub asks to wait at least a minute (secondary limit). */
export function minutesUntilRetry(retryAfterSeconds = 60): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

// screens 5.1, "GitHub URL" source.
export const githubErrorCopy: {
  [K in GithubInputError["code"]]: (
    error: Extract<GithubInputError, { code: K }>,
  ) => string;
} = {
  "invalid-url": () =>
    "Enter a repository URL like https://github.com/owner/repo.",
  "not-found": () => "Repository not found or private.",
  "no-package-json": () => "No package.json in the repository root.",
  "rate-limited": ({ retryAfterSeconds }) =>
    `GitHub is rate-limiting us. Try again in ${minutesUntilRetry(retryAfterSeconds)}.`,
  unavailable: () => GITHUB_UNAVAILABLE,
  "invalid-response": () => GITHUB_UNAVAILABLE,
};
