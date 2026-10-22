import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { loginPath } from "@/lib/safe-next";
import { REQUEST_PATH_HEADER } from "@/server/auth/session-header";

/**
 * Optimistic: only checks that a session cookie exists, so a guest is sent to
 * sign-in before the page renders. Pages still validate the session with
 * `requireSession()` (Better Auth docs: the cookie alone is not secure).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const path = `${pathname}${search}`;
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL(loginPath(path), request.url));
  }
  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, path);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/projects/:path*", "/settings/:path*"],
};
