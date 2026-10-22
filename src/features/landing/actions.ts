"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { createGuestReport } from "@/server/db/reports";
import { consumeCheck } from "@/server/rate-limit";
import { tooManyChecks } from "../check/copy";
import { prepareReport } from "../check/prepare-input";
import type { CheckFormState } from "./check-form-state";
import { landingCopy } from "./copy";

const formSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("paste"), packageJson: z.string() }),
  z.object({
    source: z.literal("upload"),
    packageJson: z.string(),
    /** gzip of package-lock.json, see `readUploadedLockfile`. */
    lockfile: z.instanceof(Blob).optional(),
  }),
  z.object({ source: z.literal("github"), url: z.string() }),
]);

/** Landing "Check dependencies": a guest report, then its page. */
export async function startGuestCheck(
  state: CheckFormState,
  formData: FormData,
): Promise<CheckFormState> {
  const attempt = state.attempt + 1;
  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    // Only a tampered request gets here; the form always sends these fields.
    return {
      attempt,
      error: { source: "paste", message: landingCopy.errors.generic },
    };
  }
  const form = parsed.data;

  // Before reading GitHub: an over-limit request shouldn't spend its quota.
  let allowed: Awaited<ReturnType<typeof consumeCheck>>;
  try {
    allowed = await consumeCheck();
  } catch (error) {
    console.error("[landing] couldn't count the check", error);
    return {
      attempt,
      error: { source: form.source, message: landingCopy.errors.generic },
    };
  }
  if (!allowed.ok) {
    return {
      attempt,
      error: {
        source: form.source,
        message: tooManyChecks(allowed.error.retryAfterSeconds),
      },
    };
  }

  const outcome = await prepareReport(form);
  if (!outcome.ok) {
    return {
      attempt,
      error: { source: form.source, message: outcome.message },
    };
  }

  let reportId: string;
  try {
    ({ reportId } = await createGuestReport(getDb(), outcome.report));
  } catch (error) {
    console.error("[landing] couldn't create a guest report", error);
    return {
      attempt,
      error: { source: form.source, message: landingCopy.errors.generic },
    };
  }
  // Outside try: redirect() throws to hand control back to Next.js.
  redirect(`/r/${reportId}/dependencies`);
}
