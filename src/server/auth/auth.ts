import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { authCopy } from "@/features/auth/copy";
import { clientIp } from "../analysis/rate-limit";
import { getDb } from "../db/client";
import { account, session, user, verification } from "../db/schema";
import { isDemoUser } from "../demo/demo-user";
import { isDemoAuthPathAllowed } from "./demo-guard";
import { consumeMagicLink } from "./magic-link-limit";
import { sendMagicLinkEmail } from "./magic-link-email";

/** screens 5.3: "It expires in 15 minutes." */
const MAGIC_LINK_TTL_SECONDS = 15 * 60;

/** `sendSignInLink` tells this refusal apart from a failed send. */
export const MAGIC_LINK_RATE_LIMITED = "MAGIC_LINK_RATE_LIMITED";

// BETTER_AUTH_SECRET is read by Better Auth itself.
function createAuth() {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_URL, NODE_ENV } =
    process.env;
  return betterAuth({
    // Server Actions call Better Auth without a request URL, so links in
    // emails need the origin up front. Locally (dev, e2e) it is the dev server.
    baseURL:
      BETTER_AUTH_URL ??
      (NODE_ENV === "production" ? undefined : "http://localhost:3000"),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    // Without the OAuth app (local dev, e2e) only the email link works.
    socialProviders:
      GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: GITHUB_CLIENT_ID,
              clientSecret: GITHUB_CLIENT_SECRET,
            },
          }
        : {},
    // "Connect GitHub" in the profile (decisions 47): a magic-link user's
    // GitHub email often differs. Only explicit linking is affected.
    account: { accountLinking: { allowDifferentEmails: true } },
    // "Delete account" requires a session younger than a day (freshAge).
    user: { deleteUser: { enabled: true } },
    hooks: {
      // Every demo visitor shares one user, so `/update-user`, `/delete-user`,
      // `/list-sessions` and `/revoke-*` would act on all of them (plan.md
      // 26.1). Allowed paths return before reading the session.
      before: createAuthMiddleware(async (ctx) => {
        if (isDemoAuthPathAllowed(ctx.path)) return;
        const session = await getSessionFromCtx(ctx);
        if (session && isDemoUser(session.user.id)) {
          throw new APIError("FORBIDDEN", {
            message: "Not available in the demo.",
          });
        }
      }),
    },
    databaseHooks: {
      // A second layer under the hook above, for any path it misses.
      user: {
        update: {
          // The update gets only the changed fields, without the user's id,
          // so the demo is recognised by the session of the request.
          before: async (_data, ctx) =>
            ctx?.context.session && isDemoUser(ctx.context.session.user.id)
              ? false
              : undefined,
        },
        delete: {
          before: async (row) => (isDemoUser(row.id) ? false : undefined),
        },
      },
      account: {
        create: {
          // A GitHub account linked to the shared demo user would follow
          // every visitor (plan.md 25). `false` makes linking fail.
          before: async (row) => (isDemoUser(row.userId) ? false : undefined),
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_TTL_SECONDS,
        // Here and not in `sendSignInLink`, so a direct POST to
        // `/api/auth/sign-in/magic-link` is limited too.
        sendMagicLink: async ({ email, url }, ctx) => {
          const allowed = await consumeMagicLink(
            getDb(),
            email,
            ctx?.headers ? clientIp(ctx.headers) : null,
          );
          if (!allowed.ok) {
            throw new APIError("TOO_MANY_REQUESTS", {
              code: MAGIC_LINK_RATE_LIMITED,
              message: authCopy.errors.tooManyRequests(
                allowed.error.retryAfterSeconds,
              ),
            });
          }
          await sendMagicLinkEmail({ email, url });
        },
      }),
      // Sets cookies from Server Actions; Better Auth requires it last.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let auth: Auth | undefined;

/** Lazy like `getDb()`: importing this module never needs env or a database. */
export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}
