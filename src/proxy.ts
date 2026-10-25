import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { loginPath } from "@/lib/safe-next";
import {
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  validGuestId,
} from "@/lib/guest-cookie";
import { REQUEST_PATH_HEADER } from "@/server/auth/session-header";

/**
 * Optimistic: only checks that a session cookie exists, so a guest is sent to
 * sign-in before the page renders. Pages still validate the session with
 * `requireSession()` (Better Auth docs: the cookie alone is not secure).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const path = `${pathname}${search}`;
  const protectedPage =
    pathname.startsWith("/projects") || pathname.startsWith("/settings");
  if (protectedPage && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL(loginPath(path), request.url));
  }
  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, path);
  // Only navigation establishes identity; actions must arrive with a cookie.
  let guestId: string | undefined;
  if (!protectedPage && request.method === "GET") {
    const existing = request.cookies.get(GUEST_COOKIE)?.value;
    guestId = validGuestId(existing) ? existing : crypto.randomUUID();
    request.cookies.set(GUEST_COOKIE, guestId);
    headers.set("cookie", request.cookies.toString());
  }
  const response = NextResponse.next({ request: { headers } });
  if (guestId)
    response.cookies.set(GUEST_COOKIE, guestId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
  return response;
}

export const config = {
  matcher: ["/", "/r/:path*", "/projects/:path*", "/settings/:path*"],
};
