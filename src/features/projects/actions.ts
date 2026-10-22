"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ReportInput } from "@/server/analysis/report-input";
import { requireSession } from "@/server/auth/session";
import { resumeCheck, startCheck } from "@/server/check/check-control";
import { createPgCheckStore } from "@/server/db/check-store";
import { getDb } from "@/server/db/client";
import {
  createProjectWithCheck,
  deleteProject,
  getProjectCheckState,
} from "@/server/db/projects";
import { consumeCheck } from "@/server/rate-limit";
import { tooManyChecks } from "../check/copy";
import { prepareReport } from "../check/prepare-input";
import { readRepoInput } from "../check/read-repo";
import { landingCopy } from "../landing/copy";
import { newProjectCopy, PROJECT_NAME_MAX } from "./copy";
import type { NewProjectState } from "./new-project-state";

const idSchema = z.uuid();

const nameSchema = z
  .string()
  .trim()
  .max(PROJECT_NAME_MAX, newProjectCopy.errors.nameTooLong);

const formSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("paste"),
    name: nameSchema.min(1, newProjectCopy.errors.nameRequired),
    packageJson: z.string(),
  }),
  z.object({
    source: z.literal("upload"),
    name: nameSchema.min(1, newProjectCopy.errors.nameRequired),
    packageJson: z.string(),
    lockfile: z.instanceof(Blob).optional(),
  }),
  // Empty takes the name from package.json, then the repository's.
  z.object({ source: z.literal("github"), name: nameSchema, url: z.string() }),
]);

/** screens 5.11 "Create & check": the project with its first check running. */
export async function createProject(
  state: NewProjectState,
  formData: FormData,
): Promise<NewProjectState> {
  const attempt = state.attempt + 1;
  const { user } = await requireSession();
  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.find((i) => i.path[0] === "name");
    // The form validates the name too; anything else is a tampered request.
    return nameIssue
      ? { attempt, error: { field: "name", message: nameIssue.message } }
      : {
          attempt,
          error: { field: "paste", message: landingCopy.errors.generic },
        };
  }
  const form = parsed.data;

  const allowed = await consumeCheck();
  if (!allowed.ok) {
    return {
      attempt,
      error: {
        field: form.source,
        message: tooManyChecks(allowed.error.retryAfterSeconds),
      },
    };
  }

  const outcome = await prepareReport(form);
  if (!outcome.ok) {
    return { attempt, error: { field: form.source, message: outcome.message } };
  }
  const { report } = outcome;
  const name =
    form.name ||
    (report.input.name ?? repoName(report.repoUrl)).slice(0, PROJECT_NAME_MAX);

  let projectId: string;
  try {
    ({ projectId } = await createProjectWithCheck(
      getDb(),
      user.id,
      name,
      report,
    ));
  } catch (error) {
    console.error("[projects] couldn't create a project", error);
    return {
      attempt,
      error: { field: form.source, message: landingCopy.errors.generic },
    };
  }
  // Outside try: redirect() throws to hand control back to Next.js.
  redirect(`/projects/${projectId}/dependencies`);
}

function repoName(repoUrl: string | undefined): string {
  return repoUrl?.split("/").pop() ?? "";
}

export type QueueCheckResult =
  | { kind: "started"; checkId: string }
  /** Nothing to check: finished meanwhile, deleted, or not this user's. */
  | { kind: "skipped" }
  | { kind: "limited"; retryAfterSeconds: number }
  | { kind: "error"; message: string };

/**
 * The dashboard queue (decisions 43) gets a check to stream for a project. A
 * running check is followed and doesn't count against the limit; a first
 * check cut short is resumed; `fresh` ("Check now") starts a new one,
 * re-reading the repository like "Check again" (decisions 42).
 */
export async function queueCheck(
  projectId: string,
  fresh: boolean,
): Promise<QueueCheckResult> {
  if (!idSchema.safeParse(projectId).success) return { kind: "skipped" };
  const { user } = await requireSession();
  const db = getDb();
  const project = await getProjectCheckState(db, projectId, user.id);
  if (!project) return { kind: "skipped" };
  const { latest } = project;
  if (latest?.status === "running") {
    return { kind: "started", checkId: latest.id };
  }
  const resumable = !fresh && latest?.status === "cancelled";
  if (!fresh && latest !== null && !resumable) return { kind: "skipped" };

  const allowed = await consumeCheck();
  if (!allowed.ok) {
    return {
      kind: "limited",
      retryAfterSeconds: allowed.error.retryAfterSeconds,
    };
  }
  const store = createPgCheckStore(db);
  if (resumable) {
    const resumed = await resumeCheck(store, latest.id);
    return resumed.ok
      ? { kind: "started", checkId: latest.id }
      : { kind: "skipped" };
  }

  let input: ReportInput | undefined;
  if (fresh && project.source === "github" && project.repoUrl) {
    const read = await readRepoInput(project.repoUrl);
    if (!read.ok) return { kind: "error", message: read.error };
    input = read.value.input;
  }
  const started = await startCheck(store, project.reportId, input);
  return started.ok
    ? { kind: "started", checkId: started.value.checkId }
    : { kind: "skipped" };
}

/** "Delete" from the card menu, after the name is typed in (screens 6). */
export async function removeProject(
  projectId: string,
): Promise<{ ok: boolean }> {
  if (!idSchema.safeParse(projectId).success) return { ok: false };
  const { user } = await requireSession();
  const ok = await deleteProject(getDb(), projectId, user.id);
  refresh();
  return { ok };
}
