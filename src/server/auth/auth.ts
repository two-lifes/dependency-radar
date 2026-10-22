import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { getDb } from "../db/client";
import { account, session, user, verification } from "../db/schema";
import { sendMagicLinkEmail } from "./magic-link-email";

/** screens 5.3: "It expires in 15 minutes." */
const MAGIC_LINK_TTL_SECONDS = 15 * 60;

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
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_TTL_SECONDS,
        sendMagicLink: ({ email, url }) => sendMagicLinkEmail({ email, url }),
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
