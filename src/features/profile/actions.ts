"use server";

import { isAPIError } from "better-auth/api";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "@/server/auth/auth";
import { requireSession } from "@/server/auth/session";
import { ACCOUNT_DELETED_PARAM } from "./account-deleted";
import { PROFILE_NAME_MAX, profileCopy } from "./copy";

const nameSchema = z
  .string()
  .trim()
  .max(PROFILE_NAME_MAX, profileCopy.account.nameTooLong);

/**
 * screens 5.13 "Name". Empty is allowed: the header then shows the email,
 * as for a magic-link user who never set a name.
 */
export async function updateName(name: string): Promise<{ error?: string }> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await requireSession();
  try {
    await getAuth().api.updateUser({
      body: { name: parsed.data },
      headers: await headers(),
    });
  } catch (error) {
    console.error("[profile] couldn't update the name", error);
    return { error: profileCopy.account.failed };
  }
  refresh();
  return {};
}

export type DeleteAccountResult = {
  error?: "mismatch" | "reauth" | "failed";
};

/**
 * screens 5.13 "Delete account", after the email is typed in. Better Auth
 * deletes the user only from a session younger than a day (decisions 47);
 * projects, sessions and accounts go with it (cascade).
 */
export async function deleteAccount(
  email: string,
): Promise<DeleteAccountResult> {
  const { user } = await requireSession();
  if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { error: "mismatch" };
  }
  try {
    await getAuth().api.deleteUser({ body: {}, headers: await headers() });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "SESSION_EXPIRED") {
      return { error: "reauth" };
    }
    console.error("[profile] couldn't delete the account", error);
    return { error: "failed" };
  }
  // Outside try: redirect() throws to hand control back to Next.js.
  redirect(`/?${ACCOUNT_DELETED_PARAM}=1`);
}
