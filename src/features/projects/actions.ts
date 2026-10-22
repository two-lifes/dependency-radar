"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ReportInput } from "@/server/analysis/report-input";
import type { Result } from "@/server/analysis/result";
import { requireSession, viewerOf } from "@/server/auth/session";
import { resumeCheck, startCheck } from "@/server/check/check-control";
import { getGithubAccountId } from "@/server/db/accounts";
import { createPgCheckStore } from "@/server/db/check-store";
import { getDb } from "@/server/db/client";
import {
  createProjectWithCheck,
  deleteProject,
  getProjectCheckState,
  getProjectSettings,
  listProjectRepos,
  renameProject as renameProjectInDb,
} from "@/server/db/projects";
import { consumeCheck } from "@/server/rate-limit";
import { createPgCache } from "@/server/sources/cache";
import {
  fetchGithubLogin,
  fetchGithubUserRepos,
} from "@/server/sources/github";
import type { SourceError } from "@/server/sources/http";
import { tooManyChecks } from "../check/copy";
import { prepareReport } from "../check/prepare-input";
import { readRepoInput } from "../check/read-repo";
import { landingCopy } from "../landing/copy";
import { newProjectCopy, PROJECT_NAME_MAX } from "./copy";
import { type GithubRepoList, markAdded } from "./github-repos";
import type { NewProjectState } from "./new-project-state";
import { projectSettingsCopy } from "../project-settings/copy";
import type { ReplaceSourceState } from "../project-settings/replace-source-state";

const idSchema = z.uuid();

const nameSchema = z
  .string()
  .trim()
  .max(PROJECT_NAME_MAX, newProjectCopy.errors.nameTooLong);

const pasteSchema = z.object({
  source: z.literal("paste"),
  packageJson: z.string(),
});
const uploadSchema = z.object({
  source: z.literal("upload"),
  packageJson: z.string(),
  lockfile: z.instanceof(Blob).optional(),
});
const githubSchema = z.object({ source: z.literal("github"), url: z.string() });

const requiredName = {
  name: nameSchema.min(1, newProjectCopy.errors.nameRequired),
};

const formSchema = z.discriminatedUnion("source", [
  pasteSchema.extend(requiredName),
  uploadSchema.extend(requiredName),
  // Empty takes the name from package.json, then the repository's.
  githubSchema.extend({ name: nameSchema }),
]);

const sourceSchema = z.discriminatedUnion("source", [
  pasteSchema,
  uploadSchema,
  githubSchema,
]);

/** screens 5.11 "Create & check": the project with its first check running. */
export async function createProject(
  state: NewProjectState,
  formData: FormData,
): Promise<NewProjectState> {
  const attempt = state.attempt + 1;
  const session = await requireSession();
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
      viewerOf(session),
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

/**
 * screens 5.11.1: the user's public repositories for the "GitHub URL" tab,
 * loaded after the page so a slow or failing GitHub never holds the form up.
 */
export async function loadGithubRepos(): Promise<
  Result<GithubRepoList, SourceError>
> {
  const session = await requireSession();
  const db = getDb();
  const accountId = await getGithubAccountId(db, session.user.id);
  // Disconnected in another tab since the page was rendered.
  if (!accountId) return { ok: false, error: { code: "unavailable" } };

  const client = { cache: createPgCache(db), token: process.env.GITHUB_TOKEN };
  const login = await fetchGithubLogin(accountId, client);
  if (!login.ok) return login;
  const [repos, projects] = await Promise.all([
    fetchGithubUserRepos(login.value, client),
    listProjectRepos(db, viewerOf(session)),
  ]);
  if (!repos.ok) return repos;
  return {
    ok: true,
    value: { login: login.value, repos: markAdded(repos.value, projects) },
  };
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
  const session = await requireSession();
  const db = getDb();
  const project = await getProjectCheckState(db, projectId, viewerOf(session));
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

/**
 * "Delete" from the card menu, after the name is typed in (screens 6). A
 * demo session deletes only its own projects: `deleteProject` decides in SQL.
 */
export async function removeProject(
  projectId: string,
): Promise<{ ok: boolean }> {
  if (!idSchema.safeParse(projectId).success) return { ok: false };
  const session = await requireSession();
  const ok = await deleteProject(getDb(), projectId, viewerOf(session));
  refresh();
  return { ok };
}

/** screens 5.12 "General": `{ error }` is a message for the name field. */
export async function renameProject(
  projectId: string,
  name: string,
): Promise<{ error?: string }> {
  const parsed = nameSchema
    .min(1, newProjectCopy.errors.nameRequired)
    .safeParse(name);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }
  if (!idSchema.safeParse(projectId).success) {
    return { error: projectSettingsCopy.general.failed };
  }
  const session = await requireSession();
  const renamed = await renameProjectInDb(
    getDb(),
    projectId,
    viewerOf(session),
    parsed.data,
  );
  if (!renamed) return { error: projectSettingsCopy.general.failed };
  refresh();
  return {};
}

/**
 * screens 5.12 "Replace source", after "This will run a new check": the new
 * input, its source and the check start in one transaction (createCheck), so
 * a check that can't start leaves the project as it was. Checks so far stay
 * in the history of the same report.
 */
export async function replaceSource(
  projectId: string,
  state: ReplaceSourceState,
  formData: FormData,
): Promise<ReplaceSourceState> {
  const attempt = state.attempt + 1;
  const session = await requireSession();
  const parsed = sourceSchema.safeParse(Object.fromEntries(formData));
  const db = getDb();
  const project = idSchema.safeParse(projectId).success
    ? await getProjectSettings(db, projectId, viewerOf(session))
    : undefined;
  if (!parsed.success || !project?.editable) {
    // The form only sends valid fields for its own project, and a seeded
    // demo project has no form (plan.md 26.1).
    return {
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
  const { source, repoUrl, input } = outcome.report;
  const started = await startCheck(
    createPgCheckStore(db),
    project.reportId,
    input,
    { source, repoUrl: repoUrl ?? null },
  );
  if (!started.ok) {
    return {
      attempt,
      error: {
        field: form.source,
        message:
          started.error === "already-running"
            ? projectSettingsCopy.source.alreadyRunning
            : landingCopy.errors.generic,
      },
    };
  }
  redirect(`/projects/${projectId}/dependencies`);
}
