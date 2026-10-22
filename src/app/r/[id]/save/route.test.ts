// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const REPORT_ID = "0b6f3a52-4a43-4c4f-9a43-1f1f3c1b2a10";

const state = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
}));
vi.mock("@/server/auth/session", () => ({
  getOptionalSession: async () => state.session,
}));
vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
const projects = vi.hoisted(() => ({ saveGuestReport: vi.fn() }));
vi.mock("@/server/db/projects", () => projects);

function save(id: string) {
  return GET(new Request(`http://localhost:3000/r/${id}/save`), {
    params: Promise.resolve({ id }),
  });
}

function location(response: Response) {
  const url = new URL(response.headers.get("location") ?? "");
  return `${url.pathname}${url.search}`;
}

describe("GET /r/[id]/save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.session = { user: { id: "u1" } };
  });

  it("sends a guest to sign in with next back here", async () => {
    state.session = null;

    const response = await save(REPORT_ID);

    expect(response.status).toBe(303);
    expect(location(response)).toBe(
      `/login?next=${encodeURIComponent(`/r/${REPORT_ID}/save`)}`,
    );
    expect(projects.saveGuestReport).not.toHaveBeenCalled();
  });

  it("saves and opens the project with the toast", async () => {
    projects.saveGuestReport.mockResolvedValue({
      kind: "saved",
      projectId: "p1",
    });

    const response = await save(REPORT_ID);

    expect(response.status).toBe(303);
    expect(location(response)).toBe("/projects/p1/dependencies?saved=1");
    expect(projects.saveGuestReport).toHaveBeenCalledWith(
      expect.anything(),
      REPORT_ID,
      "u1",
    );
  });

  it.each(["expired", "not-found"] as const)(
    "goes back to the report, which shows %s",
    async (kind) => {
      projects.saveGuestReport.mockResolvedValue({ kind });

      const response = await save(REPORT_ID);

      expect(location(response)).toBe(`/r/${REPORT_ID}/dependencies`);
    },
  );

  it("doesn't save an invalid id", async () => {
    const response = await save("not-a-uuid");

    expect(location(response)).toBe("/r/not-a-uuid/dependencies");
    expect(projects.saveGuestReport).not.toHaveBeenCalled();
  });
});
