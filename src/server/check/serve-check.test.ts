// @vitest-environment node
import { http, HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManifestDependency } from "../analysis/parse-manifest";
import { createLimiter } from "../sources/limiter";
import { NPM_REGISTRY_URL } from "../sources/npm";
import { OSV_API_URL } from "../sources/osv";
import { createMemoryCache } from "../sources/test/memory-cache";
import { setupMswServer } from "../sources/test/msw-server";
import { startCheck } from "./check-control";
import type { CheckEvent } from "./events";
import { buildPackageRow } from "./package-row";
import { serveCheck } from "./serve-check";
import { createMemoryCheckStore } from "./test/memory-check-store";

const server = setupMswServer();

const NOW = new Date("2026-10-20T12:00:00.000Z");
const LEASE_MS = 30_000;

const depA: ManifestDependency = {
  name: "a",
  specifier: "^1.0.0",
  type: "prod",
};
const dependencies: ManifestDependency[] = [
  depA,
  { name: "b", specifier: "^1.0.0", type: "prod" },
];

const unavailableRow = (checkId: string, dependency: ManifestDependency) =>
  buildPackageRow({
    checkId,
    dependency,
    analysis: { checked: false, reason: "registry-unavailable" },
    vulnerabilities: [],
    checkedAt: NOW,
  });

async function setup() {
  const memory = createMemoryCheckStore();
  memory.addReport("r1", { dependencies, lockedVersions: null });
  const created = await startCheck(memory.store, "r1");
  if (!created.ok) throw new Error(created.error);
  let now = NOW;
  const deps = {
    store: memory.store,
    cache: createMemoryCache().cache,
    limit: createLimiter(4),
    http: { baseDelayMs: 0, retries: 0 },
    now: () => now,
    leaseMs: LEASE_MS,
    pollMs: 5,
  };
  return {
    memory,
    deps,
    checkId: created.value.checkId,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

function serve(
  checkId: string,
  deps: Parameters<typeof serveCheck>[1],
  signal = new AbortController().signal,
  deadline = new AbortController().signal,
) {
  const events: CheckEvent[] = [];
  const done = serveCheck(checkId, deps, {
    signal,
    deadline,
    emit: (event) => events.push(event),
  });
  return { events, done };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  server.use(
    http.get(`${NPM_REGISTRY_URL}/:name`, () =>
      HttpResponse.json({
        "dist-tags": { latest: "1.0.0" },
        versions: { "1.0.0": {} },
        time: { "1.0.0": "2026-06-01T00:00:00.000Z" },
      }),
    ),
    http.post(`${OSV_API_URL}/querybatch`, async ({ request }) => {
      const body = (await request.json()) as { queries: unknown[] };
      return HttpResponse.json({ results: body.queries.map(() => ({})) });
    }),
  );
  return () => vi.restoreAllMocks();
});

describe("serveCheck", () => {
  it("runs a running check nobody holds", async () => {
    const { deps, checkId, memory } = await setup();

    const { events, done } = serve(checkId, deps);
    await done;

    expect(events.at(-1)).toMatchObject({ type: "done", status: "completed" });
    expect(memory.rows.get(checkId)).toHaveLength(2);
  });

  it("only reports how a finished check ended", async () => {
    const { deps, checkId, memory } = await setup();
    await serve(checkId, deps).done;

    const { events, done } = serve(checkId, deps);
    await done;

    expect(events).toEqual([
      { type: "done", status: "completed", failureReason: null, retryAt: null },
    ]);
    expect(memory.rows.get(checkId)).toHaveLength(2);
  });

  it("follows a check another stream runs, from the store", async () => {
    const { deps, checkId, memory } = await setup();
    // Another stream holds the lease.
    await memory.store.claimLease(
      checkId,
      NOW,
      new Date(NOW.getTime() + LEASE_MS),
    );

    const { events, done } = serve(checkId, deps);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toEqual({ type: "progress", checked: 0, total: 2 });

    await memory.store.insertRow(unavailableRow(checkId, depA));
    await vi.waitFor(() =>
      expect(events.some((e) => e.type === "package")).toBe(true),
    );
    await memory.store.finish(checkId, {
      status: "cancelled",
      failureReason: null,
      retryAt: null,
      score: null,
      vulnerabilityCount: null,
      finishedAt: NOW,
    });
    await done;

    expect(events.slice(1)).toEqual([
      { type: "package", package: expect.objectContaining({ name: "a" }) },
      { type: "progress", checked: 1, total: 2 },
      { type: "done", status: "cancelled", failureReason: null, retryAt: null },
    ]);
  });

  it("takes over once the runner's lease expires", async () => {
    const { deps, checkId, memory, advance } = await setup();
    await memory.store.claimLease(
      checkId,
      NOW,
      new Date(NOW.getTime() + LEASE_MS),
    );

    const { events, done } = serve(checkId, deps);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    advance(LEASE_MS + 1);
    await done;

    expect(events.at(-1)).toMatchObject({ type: "done", status: "completed" });
    expect(memory.rows.get(checkId)).toHaveLength(2);
  });

  it("stops following on abort", async () => {
    const { deps, checkId, memory } = await setup();
    await memory.store.claimLease(
      checkId,
      NOW,
      new Date(NOW.getTime() + LEASE_MS),
    );
    const controller = new AbortController();

    const { events, done } = serve(checkId, deps, controller.signal);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    controller.abort();
    await done;

    expect(events).toHaveLength(1);
    expect(memory.checks.get(checkId)?.status).toBe("running");
  });
});

describe("serveCheck at the deadline", () => {
  it("stops following without done, so the client reconnects", async () => {
    const { deps, checkId, memory } = await setup();
    await memory.store.claimLease(
      checkId,
      NOW,
      new Date(NOW.getTime() + LEASE_MS),
    );
    const deadline = new AbortController();

    const { events, done } = serve(
      checkId,
      deps,
      new AbortController().signal,
      deadline.signal,
    );
    await vi.waitFor(() => expect(events).toHaveLength(1));
    deadline.abort();
    await done;

    expect(events.map((e) => e.type)).toEqual(["progress"]);
    expect(memory.checks.get(checkId)?.status).toBe("running");
  });
});

describe("startCheck", () => {
  it("refuses a second running check of the same report", async () => {
    const { memory } = await setup();
    expect(await startCheck(memory.store, "r1")).toEqual({
      ok: false,
      error: "already-running",
    });
  });

  it("refuses an unknown report", async () => {
    const { memory } = await setup();
    expect(await startCheck(memory.store, "nope")).toEqual({
      ok: false,
      error: "report-not-found",
    });
  });
});
