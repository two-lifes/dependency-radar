import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginPath, safeNext } from "@/lib/safe-next";
import type { Viewer } from "../analysis/project-access";
import { type Auth, getAuth } from "./auth";
import { REQUEST_PATH_HEADER } from "./session-header";
import { isDemoUser } from "../demo/demo-user";

export type Session = NonNullable<
  Awaited<ReturnType<Auth["api"]["getSession"]>>
>;

/** The session's own id, read from the cookie (plan.md 26.1). */
export function viewerOf(session: Session): Viewer {
  return { userId: session.user.id, sessionId: session.session.id };
}

export async function getSession(): Promise<Session | null> {
  // headers() first: at build time it stops prerendering before Better Auth
  // is created, so the build needs no auth env.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session && !isDemoUser(session.user.id) ? session : null;
}

/**
 * The real check for protected pages; `proxy.ts` only looks for the cookie,
 * so an expired or forged one gets here. Comes back to the same page after
 * signing in.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const path = (await headers()).get(REQUEST_PATH_HEADER);
    redirect(loginPath(safeNext(path)));
  }
  return session;
}

/**
 * For pages open to guests, where the session only changes the header: if
 * the session can't be read (database down), the page still renders as for
 * a guest instead of failing.
 */
export async function getOptionalSession(): Promise<Session | null> {
  // Outside try: during prerendering headers() throws on purpose to mark the
  // route dynamic, and that must reach Next.js.
  const requestHeaders = await headers();
  try {
    const session = await getAuth().api.getSession({ headers: requestHeaders });
    return session && !isDemoUser(session.user.id) ? session : null;
  } catch (error) {
    console.error("[auth] couldn't read the session", error);
    return null;
  }
}
