import { headers } from "next/headers";
import { getAuth } from "@/server/auth/auth";
import { getDb } from "@/server/db/client";
import { isDemoSeeded, seedDemo } from "@/server/db/demo";

export const dynamic = "force-dynamic";

/**
 * screens 2: `/demo` has no UI — it signs the visitor in as the demo user
 * and opens `/projects`. A route handler for the same reason as
 * `/r/[id]/save` (decisions 45). A database the daily reset hasn't reached
 * yet gets seeded here, so the demo works right after deploy.
 */
export async function GET(request: Request) {
  const db = getDb();
  if (!(await isDemoSeeded(db))) await seedDemo(db);

  // `nextCookies()` writes the session cookie into this response.
  await getAuth().api.signInDemo({ headers: await headers() });
  return Response.redirect(new URL("/projects", request.url), 303);
}
