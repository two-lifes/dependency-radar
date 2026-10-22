export const DEFAULT_NEXT = "/projects";

/**
 * `next` comes from the URL, so it may point anywhere. Only a path on this
 * site is kept; `//host` and `/\host` are protocol-relative to browsers.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return DEFAULT_NEXT;
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_NEXT;
  // Control characters (tabs, newlines) are stripped by browsers in URLs,
  // which can turn "/\t/host" into "//host".
  if (/[\u0000-\u001f\u007f]/.test(next)) return DEFAULT_NEXT;
  return next;
}

/** `/login?next=…` that brings the user back to `path` after sign-in. */
export function loginPath(path: string): string {
  return path === DEFAULT_NEXT
    ? "/login"
    : `/login?next=${encodeURIComponent(path)}`;
}
