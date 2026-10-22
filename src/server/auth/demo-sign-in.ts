import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { DEMO_USER } from "../demo/demo-user";

/**
 * Signs the visitor in as the shared demo user without credentials (spec:
 * "one click"). Server-only: reachable through `auth.api.signInDemo` from the
 * `/demo` route, not through `/api/auth/*`. Same steps as Better Auth's
 * anonymous plugin, minus creating a user.
 */
export function demoSignIn() {
  return {
    id: "demo-sign-in",
    endpoints: {
      signInDemo: createAuthEndpoint.serverOnly(
        { method: "POST" },
        async (ctx) => {
          const user = await ctx.context.internalAdapter.findUserById(
            DEMO_USER.id,
          );
          if (!user) {
            throw new APIError("NOT_FOUND", {
              message: "Demo user is not seeded",
            });
          }
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
          );
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ ok: true });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
