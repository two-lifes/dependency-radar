"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { parseGithubRepoUrl } from "@/server/analysis/github-repo";
import type { ManifestError } from "@/server/analysis/parse-manifest";
import {
  buildReportInput,
  type ReportInput,
} from "@/server/analysis/report-input";
import { getDb } from "@/server/db/client";
import { createGuestReport, type NewGuestReport } from "@/server/db/reports";
import {
  lockedVersionsFromText,
  readUploadedLockfile,
} from "@/server/lockfile-upload";
import { consumeCheck } from "@/server/rate-limit";
import { fetchRepoSource } from "@/server/sources/github";
import {
  githubErrorCopy,
  manifestErrorCopy,
  tooManyChecks,
} from "../check/copy";
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

  const repo = parseGithubRepoUrl(form.url);
  if (!repo) {
    return {
      ok: false,
      message: githubErrorCopy["invalid-url"]({ code: "invalid-url" }),
    };
  }
  const source = await fetchRepoSource(repo, {
    token: process.env.GITHUB_TOKEN,
  });
  if (!source.ok) {
    const { error } = source;
    switch (error.code) {
      case "not-found":
        return { ok: false, message: githubErrorCopy[error.code](error) };
      case "no-package-json":
        return { ok: false, message: githubErrorCopy[error.code](error) };
      case "unavailable":
        return { ok: false, message: githubErrorCopy[error.code](error) };
      case "invalid-response":
        return { ok: false, message: githubErrorCopy[error.code](error) };
      case "rate-limited":
        return { ok: false, message: githubErrorCopy[error.code](error) };
    }
  }

  const { packageJson, packageLock, files } = source.value;
  const lockfile =
    packageLock === undefined ? undefined : lockedVersionsFromText(packageLock);
  return toOutcome(
    buildReportInput({ packageJson, lockfile, repoFiles: files }),
    "github",
    `https://github.com/${repo.owner}/${repo.repo}`,
  );
}

function toOutcome(
  result: ReturnType<typeof buildReportInput>,
  source: CheckSource,
  repoUrl?: string,
): Outcome {
  if (!result.ok) return { ok: false, message: manifestMessage(result.error) };
  const input: ReportInput = result.value;
  return { ok: true, report: { source, repoUrl, input } };
}

function manifestMessage(error: ManifestError): string {
  switch (error.code) {
    case "too-large":
      return manifestErrorCopy["too-large"](error);
    case "invalid-json":
      return manifestErrorCopy["invalid-json"](error);
    case "lockfile":
      return manifestErrorCopy.lockfile(error);
    case "invalid-package-json":
      return manifestErrorCopy["invalid-package-json"](error);
    case "no-dependencies":
      return manifestErrorCopy["no-dependencies"](error);
    case "too-many-dependencies":
      return manifestErrorCopy["too-many-dependencies"](error);
  }
}
