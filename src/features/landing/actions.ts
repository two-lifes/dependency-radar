"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  buildReportInput,
  type ReportInput,
} from "@/server/analysis/report-input";
import { getDb } from "@/server/db/client";
import { createGuestReport, type NewGuestReport } from "@/server/db/reports";
import { readUploadedLockfile } from "@/server/lockfile-upload";
import { consumeCheck } from "@/server/rate-limit";
import { tooManyChecks } from "../check/copy";
import { manifestMessage, readRepoInput } from "../check/read-repo";
import type { CheckFormState, CheckSource } from "./check-form-state";
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

type Outcome =
  { ok: true; report: NewGuestReport } | { ok: false; message: string };

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

async function prepareReport(
  form: z.infer<typeof formSchema>,
): Promise<Outcome> {
  if (form.source !== "github") {
    if (form.packageJson.trim() === "") {
      return {
        ok: false,
        message:
          form.source === "paste"
            ? landingCopy.errors.emptyPaste
            : landingCopy.errors.noManifestFile,
      };
    }
    const lockfile =
      form.source === "upload" && form.lockfile
        ? await readUploadedLockfile(form.lockfile)
        : undefined;
    return toOutcome(
      buildReportInput({ packageJson: form.packageJson, lockfile }),
      form.source,
    );
  }

  const read = await readRepoInput(form.url);
  if (!read.ok) return { ok: false, message: read.error };
  const { input, repoUrl } = read.value;
  return { ok: true, report: { source: "github", repoUrl, input } };
}

function toOutcome(
  result: ReturnType<typeof buildReportInput>,
  source: CheckSource,
): Outcome {
  if (!result.ok) return { ok: false, message: manifestMessage(result.error) };
  const input: ReportInput = result.value;
  return { ok: true, report: { source, input } };
}
