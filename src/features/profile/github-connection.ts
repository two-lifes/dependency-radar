import { getDb } from "@/server/db/client";
import { getGithubAccountId } from "@/server/db/accounts";
import { createPgCache } from "@/server/sources/cache";
import { fetchGithubLogin } from "@/server/sources/github";
import type { GithubConnection } from "./github-section";

/**
 * The user's GitHub account with its current login (decisions 47). GitHub
 * being down or rate-limited still shows the account as connected.
 */
export async function getGithubConnection(
  userId: string,
): Promise<GithubConnection> {
  const db = getDb();
  const accountId = await getGithubAccountId(db, userId);
  if (!accountId) return { connected: false };
  const login = await fetchGithubLogin(accountId, {
    cache: createPgCache(db),
    token: process.env.GITHUB_TOKEN,
  });
  if (!login.ok) {
    console.error("[profile] couldn't read the GitHub login", login.error);
    return { connected: true };
  }
  return { connected: true, login: login.value };
}
