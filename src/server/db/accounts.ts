import { and, eq } from "drizzle-orm";
import type { Db } from "./client";
import { account } from "./schema";

/** The GitHub user id Better Auth stored when GitHub was connected. */
export async function getGithubAccountId(
  db: Db,
  userId: string,
): Promise<string | undefined> {
  const [found] = await db
    .select({ accountId: account.accountId })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "github")))
    .limit(1);
  return found?.accountId;
}
