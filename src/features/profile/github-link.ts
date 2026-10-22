/**
 * Where Better Auth returns after a failed "Connect GitHub". Not `?error=`:
 * Better Auth adds its own `error` code to this URL (decisions 41).
 */
export const GITHUB_LINK_REASON = "github-link";
export const GITHUB_LINK_ERROR_PATH = `/settings/profile?reason=${GITHUB_LINK_REASON}`;
