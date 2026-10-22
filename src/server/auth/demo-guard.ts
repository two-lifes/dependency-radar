/**
 * Better Auth endpoints the shared demo session may call (plan.md 26.1).
 * An allowlist, not a denylist: an endpoint added by a future plugin or
 * Better Auth version stays closed to the demo until it is listed here.
 */
const DEMO_ALLOWED_PATHS = new Set([
  "/get-session",
  "/sign-out",
  "/magic-link/verify",
  "/ok",
  "/error",
]);

// Signing in as someone else from a demo tab replaces the demo session.
const DEMO_ALLOWED_PREFIXES = ["/sign-in/", "/callback/"];

/**
 * `undefined` is a server-only endpoint (`signInDemo`): it has no path and
 * can't be reached over HTTP, only through `auth.api` from our own code.
 */
export function isDemoAuthPathAllowed(path: string | undefined): boolean {
  if (path === undefined) return true;
  return (
    DEMO_ALLOWED_PATHS.has(path) ||
    DEMO_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}
