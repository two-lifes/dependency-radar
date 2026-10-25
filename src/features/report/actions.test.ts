vi.mock("@/server/db/check-cooldown", () => ({
  checkLaunchBlock: vi.fn(async () => null),
}));
// Quota accounting has its own PostgreSQL and action tests; these exercise hourly limits.
vi.mock("@/server/guest-quota", () => ({
  prepareGuestLaunch: async () => undefined,
}));
// @vitest-environment node
import { http, HttpResponse } from "msw/http";
import { refresh } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GITHUB_API_URL } from "@/server/sources/github";
import { setupMswServer } from "@/server/sources/test/msw-server";
import { cancel, checkAgain, resume, retry, saveReport } from "./actions";

const REPORT_ID = "0b6f3a52-4a43-4c4f-9a43-1f1f3c1b2a10";
const CHECK_ID = "6c1e6a0e-2a55-4d0f-8a5c-3e1a8f4b9c21";

const state = vi.hoisted(() => ({
  counts: new Map<string, number>(),
  session: null as { user: { id: string } } | null,
  ip: "203.0.113.7",
  report: {
    expiresAt: null,
    projectId: null as string | null,
    ownerId: null as string | null,
    demoSessionId: null as string | null,
    source: "paste",
    repoUrl: null as string | null,
  },
}));

const guestPasteReport = {
  expiresAt: null,
  projectId: null,
  ownerId: null,
  demoSessionId: null,
  source: "paste",
  repoUrl: null,
};

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));
const projects = vi.hoisted(() => ({
  saveGuestReport: vi.fn(),
}));
vi.mock("@/server/db/projects", () => projects);
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": state.ip }),
}));
vi.mock("@/server/auth/session", () => ({
  getOptionalSession: async () => state.session,
  // The real one only reads two fields; every mocked session is "s1".
  viewerOf: ({ user }: { user: { id: string } }) => ({
    userId: user.id,
    sessionId: "s1",
  }),
}));
vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/check-store", () => ({ createPgCheckStore: () => ({}) }));
vi.mock("@/server/db/report-page", () => ({
  getReportMeta: async () => state.report,
  getCheckReportMeta: async () => state.report,
}));
vi.mock("@/server/db/rate-limits", () => ({
  hitRateLimit: async (_db: unknown, subject: string, windowStart: Date) => {
    const key = `${subject}@${windowStart.toISOString()}`;
    const count = (state.counts.get(key) ?? 0) + 1;
    state.counts.set(key, count);
    return count;
  },
}));
const control = vi.hoisted(() => ({
  startCheck: vi.fn(async () => ({ ok: true, value: { checkId: "c" } })),
  resumeCheck: vi.fn(async () => ({ ok: true, value: undefined })),
  retryFailed: vi.fn(async () => ({ ok: true, value: undefined })),
  cancelCheck: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock("@/server/check/check-control", () => control);

describe("report actions under the rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T14:20:00.000Z"));
    state.counts.clear();
    state.session = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops a guest's 11th check in the hour without starting it", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await checkAgain(REPORT_ID)).toEqual({});
    }
    expect(control.startCheck).toHaveBeenCalledTimes(10);

    expect(await checkAgain(REPORT_ID)).toEqual({
      error: "Too many checks. Try again in 40 minutes.",
    });
    expect(control.startCheck).toHaveBeenCalledTimes(10);
  });

  it("counts Resume and Retry failed with Check again", async () => {
    for (let i = 0; i < 5; i++) await resume(CHECK_ID);
    for (let i = 0; i < 5; i++) await retry(CHECK_ID);

    expect(await checkAgain(REPORT_ID)).toHaveProperty("error");
    expect(await resume(CHECK_ID)).toHaveProperty("error");
    expect(await retry(CHECK_ID)).toHaveProperty("error");
    expect(control.resumeCheck).toHaveBeenCalledTimes(5);
    expect(control.retryFailed).toHaveBeenCalledTimes(5);
  });

  it("counts guests per IP", async () => {
    for (let i = 0; i < 10; i++) await checkAgain(REPORT_ID);
    state.ip = "198.51.100.1";

    expect(await checkAgain(REPORT_ID)).toEqual({});
    state.ip = "203.0.113.7";
  });

  it("gives a signed-in user 30 checks", async () => {
    state.session = { user: { id: "u1" } };
    for (let i = 0; i < 30; i++) {
      expect(await checkAgain(REPORT_ID)).toEqual({});
    }
    expect(await checkAgain(REPORT_ID)).toHaveProperty("error");
  });

  it("starts counting again in the next hour", async () => {
    for (let i = 0; i < 11; i++) await checkAgain(REPORT_ID);
    vi.setSystemTime(new Date("2026-10-22T15:00:00.000Z"));

    expect(await checkAgain(REPORT_ID)).toEqual({});
  });

  it("doesn't count an invalid id", async () => {
    for (let i = 0; i < 20; i++) await checkAgain("not-a-uuid");

    expect(await checkAgain(REPORT_ID)).toEqual({});
  });
});

const server = setupMswServer();
const base = `${GITHUB_API_URL}/repos/acme/shop`;

/** A public repo with the given root files; every request is recorded. */
function mockRepo(
  files: Record<string, string | (() => Response)>,
  meta: () => Response = () =>
    HttpResponse.json({ private: false, default_branch: "main" }),
) {
  server.use(
    http.get(base, meta),
    http.get(`${base}/contents/`, () =>
      HttpResponse.json(
        Object.keys(files).map((name) => ({ name, type: "file" })),
      ),
    ),
    http.get(`${base}/contents/:file`, ({ params }) => {
      const file = files[String(params.file)];
      if (file === undefined) return new HttpResponse(null, { status: 404 });
      return typeof file === "string" ? new HttpResponse(file) : file();
    }),
  );
}

function countGithubRequests() {
  const requests: string[] = [];
  server.events.on("request:start", ({ request }) => {
    requests.push(request.url);
  });
  return requests;
}

describe("Check again on a GitHub report (decisions 42)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T14:20:00.000Z"));
    state.counts.clear();
    state.session = null;
    state.report = {
      ...guestPasteReport,
      source: "github",
      repoUrl: "https://github.com/acme/shop",
    };
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    server.events.removeAllListeners();
    state.report = { ...guestPasteReport };
  });

  it("starts the check with the package.json the repository has now", async () => {
    // The report was created with `left-pad`; it is gone, `zod` is new.
    mockRepo({
      "package.json": JSON.stringify({
        name: "shop",
        dependencies: { react: "^19.0.0", zod: "^4.0.0" },
      }),
      "pnpm-lock.yaml": "lockfileVersion: 9",
    });

    expect(await checkAgain(REPORT_ID)).toEqual({});

    expect(control.startCheck).toHaveBeenCalledTimes(1);
    const [, reportId, input] = control.startCheck.mock.calls[0] as unknown as [
      unknown,
      string,
      {
        name?: string;
        dependencies: { name: string }[];
        packageManager: string;
      },
    ];
    expect(reportId).toBe(REPORT_ID);
    expect(input.name).toBe("shop");
    expect(input.dependencies.map(({ name }) => name)).toEqual([
      "react",
      "zod",
    ]);
    expect(input.packageManager).toBe("pnpm");
    expect(refresh).toHaveBeenCalled();
  });

  it.each([
    [
      "the repository is gone",
      () => mockRepo({}, () => new HttpResponse(null, { status: 404 })),
      "Repository not found or private.",
    ],
    [
      "the repository turned private",
      () =>
        mockRepo({ "package.json": "{}" }, () =>
          HttpResponse.json({ private: true, default_branch: "main" }),
        ),
      "Repository not found or private.",
    ],
    [
      "package.json was removed",
      () => mockRepo({ "README.md": "# shop" }),
      "No package.json in the repository root.",
    ],
    [
      "GitHub rate-limits us",
      () =>
        mockRepo(
          {},
          () =>
            new HttpResponse(null, {
              status: 403,
              headers: {
                "x-ratelimit-remaining": "0",
                // 14:45:00Z, 25 minutes after the faked now.
                "x-ratelimit-reset": String(
                  Date.parse("2026-10-22T14:45:00.000Z") / 1000,
                ),
              },
            }),
        ),
      "GitHub is rate-limiting us. Try again in 25 minutes.",
    ],
    [
      "package.json is broken",
      () => mockRepo({ "package.json": '{ "dependencies": ' }),
      "This doesn't look like valid JSON.",
    ],
    [
      "GitHub is down",
      () => mockRepo({}, () => new HttpResponse(null, { status: 503 })),
      "Couldn't reach GitHub. Try again in a moment.",
    ],
  ])(
    "starts nothing and keeps the report when %s",
    async (_, setup, message) => {
      setup();

      expect(await checkAgain(REPORT_ID)).toEqual({ error: message });

      expect(control.startCheck).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    },
  );

  it("doesn't read GitHub for a pasted report", async () => {
    state.report = { ...guestPasteReport };
    const requests = countGithubRequests();

    expect(await checkAgain(REPORT_ID)).toEqual({});

    expect(requests).toEqual([]);
    expect(control.startCheck).toHaveBeenCalledWith(
      expect.anything(),
      REPORT_ID,
      undefined,
    );
  });

  it("doesn't re-read the repository on Resume or Retry failed", async () => {
    const requests = countGithubRequests();

    expect(await resume(CHECK_ID)).toEqual({});
    expect(await retry(CHECK_ID)).toEqual({});

    expect(requests).toEqual([]);
    expect(control.resumeCheck).toHaveBeenCalledTimes(1);
    expect(control.retryFailed).toHaveBeenCalledTimes(1);
  });
});

describe("a project's report (decisions 45)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T14:20:00.000Z"));
    state.counts.clear();
    state.report = { ...guestPasteReport, projectId: "p1", ownerId: "u1" };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    state.session = null;
    state.report = { ...guestPasteReport };
  });

  it("lets its owner check it", async () => {
    state.session = { user: { id: "u1" } };

    expect(await checkAgain(REPORT_ID)).toEqual({});
    expect(await retry(CHECK_ID)).toEqual({});

    expect(control.startCheck).toHaveBeenCalledTimes(1);
    expect(control.retryFailed).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["another user", { user: { id: "u2" } }],
    ["a guest", null],
  ])("starts nothing for %s and doesn't count it", async (_, session) => {
    state.session = session;

    expect(await checkAgain(REPORT_ID)).toEqual({});
    expect(await resume(CHECK_ID)).toEqual({});
    expect(await retry(CHECK_ID)).toEqual({});
    expect(await cancel(CHECK_ID)).toEqual({});

    expect(control.startCheck).not.toHaveBeenCalled();
    expect(control.resumeCheck).not.toHaveBeenCalled();
    expect(control.retryFailed).not.toHaveBeenCalled();
    expect(control.cancelCheck).not.toHaveBeenCalled();
    expect(state.counts.size).toBe(0);
  });
});

describe("saveReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.session = { user: { id: "u1" } };
  });

  afterEach(() => {
    state.session = null;
  });

  it("sends a guest to sign in and back to /r/[id]/save", async () => {
    state.session = null;

    await expect(saveReport(REPORT_ID)).rejects.toThrow(
      `NEXT_REDIRECT /login?next=${encodeURIComponent(`/r/${REPORT_ID}/save`)}`,
    );
    expect(projects.saveGuestReport).not.toHaveBeenCalled();
  });

  it("opens the project with the saved toast", async () => {
    projects.saveGuestReport.mockResolvedValue({
      kind: "saved",
      projectId: "p1",
    });

    await expect(saveReport(REPORT_ID)).rejects.toThrow(
      "NEXT_REDIRECT /projects/p1/dependencies?saved=1",
    );
    expect(projects.saveGuestReport).toHaveBeenCalledWith(
      expect.anything(),
      REPORT_ID,
      { userId: "u1", sessionId: "s1" },
    );
  });

  it.each(["expired", "not-found"] as const)(
    "goes back to the report when it is %s",
    async (kind) => {
      projects.saveGuestReport.mockResolvedValue({ kind });

      await expect(saveReport(REPORT_ID)).rejects.toThrow(
        `NEXT_REDIRECT /r/${REPORT_ID}/dependencies`,
      );
    },
  );

  it("ignores an invalid id", async () => {
    await saveReport("not-a-uuid");

    expect(projects.saveGuestReport).not.toHaveBeenCalled();
  });
});
