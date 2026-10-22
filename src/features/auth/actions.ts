"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { getAuth, MAGIC_LINK_RATE_LIMITED } from "@/server/auth/auth";
import { authCopy } from "./copy";
import { checkEmailPath, loginErrorPath } from "./login-paths";
import type { SignInLinkState } from "./sign-in-state";

const formSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  next: z.string().optional(),
  /** "resend" stays on the check-email page instead of redirecting to it. */
  intent: z.enum(["send", "resend"]).default("send"),
});

/** screens 5.2 "Send sign-in link" and 5.3 "Resend link". */
export async function sendSignInLink(
  state: SignInLinkState,
  formData: FormData,
): Promise<SignInLinkState> {
  const attempt = state.attempt + 1;
  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { attempt, error: authCopy.errors.invalidEmail };
  }
  const { email, intent } = parsed.data;
  const next = safeNext(parsed.data.next);

  try {
    await getAuth().api.signInMagicLink({
      body: {
        email,
        callbackURL: next,
        // Better Auth reports an expired, used and unknown token the same way.
        errorCallbackURL: loginErrorPath("link-expired", next),
      },
      headers: await headers(),
    });
  } catch (error) {
    if (
      isAPIError(error) &&
      error.body?.code === MAGIC_LINK_RATE_LIMITED &&
      error.body.message
    ) {
      return { attempt, error: error.body.message };
    }
    console.error("[auth] couldn't send a sign-in link", error);
    return { attempt, error: authCopy.errors.sendFailed };
  }

  if (intent === "resend") return { attempt, sent: true };
  // Outside try: redirect() throws to hand control back to Next.js.
  redirect(checkEmailPath(email, next));
}
