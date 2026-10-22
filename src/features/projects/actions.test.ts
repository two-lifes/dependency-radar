// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_USER } from "@/server/demo/demo-user";
import { initialReplaceSourceState } from "../project-settings/replace-source-state";
import {
  createProject,
  queueCheck,
  removeProject,
  renameProject,
  replaceSource,
} from "./actions";
import { initialNewProjectState } from "./new-project-state";

const PROJECT_ID = "0b6f3a52-4a43-4c4f-9a43-1f1f3c1b2a10";

const state = vi.hoisted(() => ({
  count: 0,
  settings: undefined as
    | {
        id: string;
        name: string;
        reportId: string;
        source: "paste" | "upload" | "github";
        repoUrl: string | null;
        editable: boolean;
      }
    | undefined,
  project: undefined as
    | {
        reportId: string;
        source: "paste" | "upload" | "github";
        repoUrl: string | null;
        latest: { id: string; status: string } | null;
      }
    | undefined,
}));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }),
}));
const signedIn = vi.hoisted(() => ({ userId: "u1" }));
vi.mock("@/server/auth/session", () => ({
  requireSession: async () => ({ user: { id: signedIn.userId } }),
  getOptionalSession: async () => ({ user: { id: "u1" } }),
  // The real one only reads two fields; every mocked session is "s1".
  viewerOf: ({ user }: { user: { id: string } }) => ({
    userId: user.id,
    sessionId: "s1",
  }),
}));
vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/check-store", () => ({ createPgCheckStore: () => ({}) }));
vi.mock("@/server/db/rate-limits", () => ({
  hitRateLimit: async () => ++state.count,
}));
const db = vi.hoisted(() => ({
  createProjectWithCheck: vi.fn(async () => ({ projectId: "p-new" })),
  deleteProject: vi.fn(async () => true),
  getProjectCheckState: vi.fn(async () => state.project),
  getProjectSettings: vi.fn(async () => state.settings),
  renameProject: vi.fn(async () => true),
}));
vi.mock("@/server/db/projects", () => db);
const control = vi.hoisted(() => ({
  startCheck: vi.fn<
    (
      ...args: unknown[]
    ) => Promise<
      | { ok: true; value: { checkId: string } }
      | { ok: false; error: "already-running" | "report-not-found" }
    >
  >(async () => ({ ok: true, value: { checkId: "c-new" } })),
  resumeCheck: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock("@/server/check/check-control", () => control);
const github = vi.hoisted(() => ({ fetchRepoSource: vi.fn() }));
vi.mock("@/server/sources/github", () => github);

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const MANIFEST = '{"name":"shop","dependencies":{"react":"^19.0.0"}}';

function repoSource(packageJson: string) {
  return {
    ok: true,
    value: { packageJson, packageLock: undefined, files: [] },
  };
}

describe("createProject", () => {
  beforeEach(() => {
    state.count = 0;
    vi.clearAllMocks();
  });

  it("creates the project with its check and opens its report", async () => {
    await expect(
      createProject(
        initialNewProjectState,
        form({ source: "paste", name: " My shop ", packageJson: MANIFEST }),
      ),
    ).rejects.toThrow("redirect:/projects/p-new/dependencies");
    expect(db.createProjectWithCheck).toHaveBeenCalledWith(
      {},
      { userId: "u1", sessionId: "s1" },
      "My shop",
      expect.objectContaining({ source: "paste" }),
    );
    expect(state.count).toBe(1);
  });

  it("needs a name for pasted package.json, before counting the check", async () => {
    const result = await createProject(
      initialNewProjectState,
      form({ source: "paste", name: "  ", packageJson: MANIFEST }),
    );
    expect(result.error).toEqual({
      field: "name",
      message: "Enter a project name.",
    });
    expect(state.count).toBe(0);
  });

  it("rejects a name over 60 characters", async () => {
    const result = await createProject(
      initialNewProjectState,
      form({ source: "paste", name: "x".repeat(61), packageJson: MANIFEST }),
    );
    expect(result.error?.field).toBe("name");
  });

  it("names a repository project from its package.json when left empty", async () => {
    github.fetchRepoSource.mockResolvedValue(repoSource(MANIFEST));
    await expect(
      createProject(
        initialNewProjectState,
        form({ source: "github", name: "", url: "github.com/acme/web" }),
      ),
    ).rejects.toThrow("redirect:");
    expect(db.createProjectWithCheck).toHaveBeenCalledWith(
      {},
      { userId: "u1", sessionId: "s1" },
      "shop",
      expect.objectContaining({ repoUrl: "https://github.com/acme/web" }),
    );
  });

  it("falls back to the repository name without one in package.json", async () => {
    github.fetchRepoSource.mockResolvedValue(
      repoSource('{"dependencies":{"react":"^19.0.0"}}'),
    );
    await expect(
      createProject(
        initialNewProjectState,
        form({ source: "github", name: "", url: "github.com/acme/web" }),
      ),
    ).rejects.toThrow("redirect:");
    expect(db.createProjectWithCheck).toHaveBeenCalledWith(
      {},
      { userId: "u1", sessionId: "s1" },
      "web",
      expect.anything(),
    );
  });

  it("shows source errors under the source, as on the landing", async () => {
    const result = await createProject(
      initialNewProjectState,
      form({ source: "paste", name: "shop", packageJson: "{" }),
    );
    expect(result.error).toEqual({
      field: "paste",
      message: expect.stringContaining("valid JSON"),
    });
    expect(db.createProjectWithCheck).not.toHaveBeenCalled();
  });

  it("stops at the rate limit without creating anything", async () => {
    state.count = 30;
    const result = await createProject(
      initialNewProjectState,
      form({ source: "paste", name: "shop", packageJson: MANIFEST }),
    );
    expect(result.error).toEqual({
      field: "paste",
      message: expect.stringContaining("Too many checks"),
    });
    expect(db.createProjectWithCheck).not.toHaveBeenCalled();
  });
});

describe("queueCheck", () => {
  const withLatest = (latest: { id: string; status: string } | null) => {
    state.project = { reportId: "r1", source: "paste", repoUrl: null, latest };
  };

  beforeEach(() => {
    state.count = 0;
    withLatest(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    state.project = undefined;
  });

  it("follows a running check without counting it", async () => {
    withLatest({ id: "c1", status: "running" });
    expect(await queueCheck(PROJECT_ID, false)).toEqual({
      kind: "started",
      checkId: "c1",
    });
    expect(state.count).toBe(0);
  });

  it("resumes a first check that was cut short", async () => {
    withLatest({ id: "c1", status: "cancelled" });
    expect(await queueCheck(PROJECT_ID, false)).toEqual({
      kind: "started",
      checkId: "c1",
    });
    expect(control.resumeCheck).toHaveBeenCalledWith({}, "c1");
    expect(state.count).toBe(1);
  });

  it("starts the first check of a project without any", async () => {
    expect(await queueCheck(PROJECT_ID, false)).toEqual({
      kind: "started",
      checkId: "c-new",
    });
    expect(control.startCheck).toHaveBeenCalledWith({}, "r1", undefined);
  });

  it("skips a project that finished or failed meanwhile", async () => {
    withLatest({ id: "c1", status: "failed" });
    expect(await queueCheck(PROJECT_ID, false)).toEqual({ kind: "skipped" });
    expect(state.count).toBe(0);
  });

  it("starts a new check on Check now, re-reading the repository", async () => {
    state.project = {
      reportId: "r1",
      source: "github",
      repoUrl: "https://github.com/acme/web",
      latest: { id: "c1", status: "completed" },
    };
    github.fetchRepoSource.mockResolvedValue(repoSource(MANIFEST));
    expect(await queueCheck(PROJECT_ID, true)).toEqual({
      kind: "started",
      checkId: "c-new",
    });
    expect(control.startCheck).toHaveBeenCalledWith(
      {},
      "r1",
      expect.objectContaining({ name: "shop" }),
    );
  });

  it("reports the rate limit without starting", async () => {
    state.count = 30;
    const result = await queueCheck(PROJECT_ID, false);
    expect(result).toEqual({
      kind: "limited",
      retryAfterSeconds: expect.any(Number),
    });
    expect(control.startCheck).not.toHaveBeenCalled();
  });

  it("treats someone else's project as missing", async () => {
    state.project = undefined;
    expect(await queueCheck(PROJECT_ID, true)).toEqual({ kind: "skipped" });
    expect(state.count).toBe(0);
  });
});

describe("removeProject", () => {
  it("deletes only for the owner and ignores a malformed id", async () => {
    vi.clearAllMocks();
    expect(await removeProject("nope")).toEqual({ ok: false });
    expect(db.deleteProject).not.toHaveBeenCalled();

    expect(await removeProject(PROJECT_ID)).toEqual({ ok: true });
    expect(db.deleteProject).toHaveBeenCalledWith({}, PROJECT_ID, {
      userId: "u1",
      sessionId: "s1",
    });
  });

  // The SQL condition itself is tested in `server/db/project-access.test.ts`.
  it("leaves a demo session's delete to the database rule", async () => {
    vi.clearAllMocks();
    signedIn.userId = DEMO_USER.id;
    try {
      db.deleteProject.mockResolvedValueOnce(false);
      expect(await removeProject(PROJECT_ID)).toEqual({ ok: false });
      expect(db.deleteProject).toHaveBeenCalledWith({}, PROJECT_ID, {
        userId: DEMO_USER.id,
        sessionId: "s1",
      });
    } finally {
      signedIn.userId = "u1";
    }
  });
});

describe("renameProject", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves a trimmed name for the owner", async () => {
    expect(await renameProject(PROJECT_ID, "  New name ")).toEqual({});
    expect(db.renameProject).toHaveBeenCalledWith(
      {},
      PROJECT_ID,
      { userId: "u1", sessionId: "s1" },
      "New name",
    );
  });

  it("rejects an empty or too long name without saving", async () => {
    expect(await renameProject(PROJECT_ID, "   ")).toEqual({
      error: "Enter a project name.",
    });
    expect(await renameProject(PROJECT_ID, "x".repeat(61))).toEqual({
      error: "Use 60 characters or fewer.",
    });
    expect(db.renameProject).not.toHaveBeenCalled();
  });

  it("fails for someone else's project", async () => {
    db.renameProject.mockResolvedValueOnce(false);
    expect(await renameProject(PROJECT_ID, "Mine now")).toEqual({
      error: "Couldn't rename the project. Try again.",
    });
  });
});

describe("replaceSource", () => {
  beforeEach(() => {
    state.count = 0;
    state.settings = {
      id: PROJECT_ID,
      name: "shop",
      reportId: "r1",
      source: "github",
      repoUrl: "https://github.com/acme/shop",
      editable: true,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    state.settings = undefined;
  });

  const replace = (fields: Record<string, string>) =>
    replaceSource(PROJECT_ID, initialReplaceSourceState, form(fields));

  it("checks the pasted package.json as the new source and opens the report", async () => {
    await expect(
      replace({ source: "paste", packageJson: MANIFEST }),
    ).rejects.toThrow(`redirect:/projects/${PROJECT_ID}/dependencies`);
    expect(control.startCheck).toHaveBeenCalledWith(
      {},
      "r1",
      expect.objectContaining({ name: "shop" }),
      { source: "paste", repoUrl: null },
    );
    expect(state.count).toBe(1);
  });

  it("switches to a repository, keeping its normalized URL", async () => {
    github.fetchRepoSource.mockResolvedValue(repoSource(MANIFEST));
    await expect(
      replace({ source: "github", url: "https://github.com/acme/web" }),
    ).rejects.toThrow("redirect:");
    expect(control.startCheck).toHaveBeenCalledWith(
      {},
      "r1",
      expect.anything(),
      { source: "github", repoUrl: "https://github.com/acme/web" },
    );
  });

  it("shows a source error under the field and starts nothing", async () => {
    const result = await replace({ source: "paste", packageJson: "{" });
    expect(result).toEqual({
      attempt: 1,
      error: { field: "paste", message: expect.any(String) },
    });
    expect(control.startCheck).not.toHaveBeenCalled();
  });

  it("stops at the rate limit before reading the source", async () => {
    state.count = 30;
    const result = await replace({
      source: "github",
      url: "https://github.com/acme/web",
    });
    expect(result.error).toEqual({
      field: "github",
      message: expect.stringContaining("Too many checks"),
    });
    expect(github.fetchRepoSource).not.toHaveBeenCalled();
    expect(control.startCheck).not.toHaveBeenCalled();
  });

  it("asks to wait while a check of the project runs", async () => {
    control.startCheck.mockResolvedValueOnce({
      ok: false,
      error: "already-running",
    });
    const result = await replace({ source: "paste", packageJson: MANIFEST });
    expect(result.error).toEqual({
      field: "paste",
      message:
        "A check is running. Wait for it to finish, then replace the source.",
    });
  });

  it("treats someone else's project as missing, before counting a check", async () => {
    state.settings = undefined;
    const result = await replace({ source: "paste", packageJson: MANIFEST });
    expect(result.error?.message).toBe("Something went wrong. Try again.");
    expect(state.count).toBe(0);
    expect(control.startCheck).not.toHaveBeenCalled();
  });

  it("refuses a seeded demo project, before counting a check", async () => {
    if (state.settings) state.settings.editable = false;
    const result = await replace({ source: "paste", packageJson: MANIFEST });
    expect(result.error?.message).toBe("Something went wrong. Try again.");
    expect(state.count).toBe(0);
    expect(control.startCheck).not.toHaveBeenCalled();
  });
});
