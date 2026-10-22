// @vitest-environment node
import { http, HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManifestDependency } from "../analysis/parse-manifest";
import type { Cache } from "../sources/cache";
import { createLimiter } from "../sources/limiter";
import { NPM_REGISTRY_URL } from "../sources/npm";
import { OSV_API_URL } from "../sources/osv";
import { createMemoryCache } from "../sources/test/memory-cache";
import { setupMswServer } from "../sources/test/msw-server";
import { cancelCheck, resumeCheck, retryFailed } from "./check-control";
import type { CheckInput, CheckStore } from "./check-store";
import type { CheckEvent } from "./events";
import { buildPackageRow } from "./package-row";
import { type CheckEngineDeps, runCheck } from "./run-check";
import { createMemoryCheckStore } from "./test/memory-check-store";

const server = setupMswServer();

const NOW = new Date("2026-10-20T12:00:00.000Z");

const dep = (
  name: string,
  specifier: string,
  type: ManifestDependency["type"] = "prod",
): ManifestDependency => ({ name, specifier, type });

const packument = (versions: string[]) => ({
  "dist-tags": { latest: versions.at(-1) },
  versions: Object.fromEntries(versions.map((v) => [v, {}])),
  time: Object.fromEntries(
    versions.map((v) => [v, "2026-06-01T00:00:00.000Z"]),
  ),
});

type NpmResponse = object | (() => Response | Promise<Response>);

/** npm documents by name; a function answers instead. Counts requests. */
function mockNpm(docs: Record<string, NpmResponse>) {
  const requests: string[] = [];
  server.use(
    http.get(`${NPM_REGISTRY_URL}/:name`, ({ params }) => {
      const name = String(params.name);
      requests.push(name);
      const doc = docs[name];
      if (doc === undefined) return new HttpResponse(null, { status: 404 });
      return typeof doc === "function" ? doc() : HttpResponse.json(doc);
    }),
  );
  return requests;
}

type BatchQuery = { package: { name: string }; version: string };

/** OSV with vulnerability IDs by package name and records by ID. */
function mockOsv(
  ids: Record<string, string[]> = {},
  records: Record<string, object> = {},
) {
  const batches: BatchQuery[][] = [];
  server.use(
    http.post(`${OSV_API_URL}/querybatch`, async ({ request }) => {
      const body = (await request.json()) as { queries: BatchQuery[] };
      batches.push(body.queries);
      return HttpResponse.json({
        results: body.queries.map((q) => ({
          vulns: (ids[q.package.name] ?? []).map((id) => ({ id })),
        })),
      });
    }),
    http.get(`${OSV_API_URL}/vulns/:id`, ({ params }) => {
      const record = records[String(params.id)];
      return record
        ? HttpResponse.json(record)
        : new HttpResponse(null, { status: 404 });
    }),
  );
  return batches;
}

const reactAdvisory = {
  id: "GHSA-react",
  aliases: ["CVE-2026-0001"],
  summary: "XSS",
  database_specific: { severity: "HIGH" },
  affected: [
    {
      package: { ecosystem: "npm", name: "react" },
      ranges: [
        { type: "SEMVER", events: [{ introduced: "0" }, { fixed: "18.3.0" }] },
      ],
    },
  ],
};

function setup(
  dependencies: ManifestDependency[],
  lockedVersions: CheckInput["lockedVersions"] = null,
) {
  const memory = createMemoryCheckStore();
  memory.addReport("r1", { dependencies, lockedVersions });
  const deps: CheckEngineDeps = {
    store: memory.store,
    cache: createMemoryCache().cache,
    limit: createLimiter(4),
    http: { baseDelayMs: 0, retries: 0 },
    now: () => NOW,
  };
  const start = async () => {
    const created = await memory.store.createCheck("r1");
    if (!created.ok) throw new Error(created.error);
    return created.value.checkId;
  };
  return { memory, deps, start };
}

async function run(
  checkId: string,
  deps: CheckEngineDeps,
  options: { signal?: AbortSignal; onEvent?: (event: CheckEvent) => void } = {},
) {
  const events: CheckEvent[] = [];
  await runCheck(checkId, deps, {
    signal: options.signal ?? new AbortController().signal,
    emit: (event) => {
      events.push(event);
      options.onEvent?.(event);
    },
  });
  return events;
}

const doneOf = (events: CheckEvent[]) => events.at(-1);
const packageNames = (events: CheckEvent[]) =>
  events.flatMap((e) => (e.type === "package" ? [e.package.name] : []));

/**
 * A cache whose lookup of `key` waits until `release()`. Tests that abort a
 * check hold a package here, not in an HTTP handler: under msw, two aborted
 * in-flight requests broke undici's pool and leaked the next request.
 */
function holdInCache(cache: Cache, key: string) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held: Cache = {
    async get(k) {
      if (k === key) await gate;
      return cache.get(k);
    },
    set: (k, value, ttlMs) => cache.set(k, value, ttlMs),
  };
  return { cache: held, release };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  return () => vi.restoreAllMocks();
});

describe("runCheck", () => {
  it("checks every package, streams rows and stores a snapshot", async () => {
    const requests = mockNpm({
      react: packument(["18.2.0", "18.3.0", "19.0.0"]),
      lodash: packument(["4.17.21"]),
    });
    mockOsv({ react: ["GHSA-react"] }, { "GHSA-react": reactAdvisory });
    const { memory, deps, start } = setup(
      [
        dep("react", "^18.0.0"),
        dep("lodash", "^4.17.0", "dev"),
        dep("my-lib", "github:me/my-lib"),
      ],
      { react: { version: "18.2.0" } },
    );
    const checkId = await start();

    const events = await run(checkId, deps);

    expect(events[0]).toEqual({ type: "progress", checked: 0, total: 3 });
    expect(packageNames(events).sort()).toEqual(["lodash", "my-lib", "react"]);
    expect(events.filter((e) => e.type === "progress").at(-1)).toEqual({
      type: "progress",
      checked: 3,
      total: 3,
    });
    expect(doneOf(events)).toEqual({
      type: "done",
      status: "completed",
      failureReason: null,
      retryAt: null,
    });
    // The git dependency never reaches npm.
    expect(requests.sort()).toEqual(["lodash", "react"]);

    const rows = memory.rows.get(checkId) ?? [];
    const react = rows.find((r) => r.name === "react");
    expect(react).toMatchObject({
      checked: true,
      current: "18.2.0",
      latest: "19.0.0",
      lagKind: "major",
      lagMajors: 1,
    });
    expect(react?.vulnerabilities).toMatchObject([
      { primaryId: "GHSA-react", severity: "high", fixedIn: "18.3.0" },
    ]);
    expect(rows.find((r) => r.name === "my-lib")).toMatchObject({
      checked: false,
      reason: "not-from-registry",
    });
    // 100 − 6 (one major) − 10 (one high vulnerability).
    expect(memory.checks.get(checkId)?.snapshot).toMatchObject({
      status: "completed",
      score: 84,
      vulnerabilityCount: 1,
      severeVulnerableCount: 1,
      finishedAt: NOW,
    });
  });

  it("looks up an npm: alias under its real name", async () => {
    const requests = mockNpm({ react: packument(["18.3.1"]) });
    mockOsv();
    const { memory, deps, start } = setup([
      dep("my-react", "npm:react@^18.0.0"),
    ]);
    const checkId = await start();

    await run(checkId, deps);

    expect(requests).toEqual(["react"]);
    expect(memory.rows.get(checkId)?.[0]).toMatchObject({
      name: "my-react",
      registryName: "react",
      current: "18.3.1",
    });
  });

  it("marks a package missing from npm without making the check partial", async () => {
    mockNpm({ react: packument(["18.3.1"]) });
    mockOsv();
    const { memory, deps, start } = setup([
      dep("react", "^18.0.0"),
      dep("no-such-pkg", "^1.0.0"),
    ]);
    const checkId = await start();

    const events = await run(checkId, deps);

    expect(
      memory.rows.get(checkId)?.find((r) => r.name === "no-such-pkg"),
    ).toMatchObject({ checked: false, reason: "not-in-registry" });
    expect(doneOf(events)).toMatchObject({ status: "completed" });
  });

  it("is partial when npm fails for one package", async () => {
    mockNpm({
      react: packument(["18.3.1"]),
      lodash: () => new HttpResponse(null, { status: 503 }),
    });
    mockOsv();
    const { memory, deps, start } = setup([
      dep("react", "^18.0.0"),
      dep("lodash", "^4.0.0"),
    ]);
    const checkId = await start();

    const events = await run(checkId, deps);

    expect(
      memory.rows.get(checkId)?.find((r) => r.name === "lodash"),
    ).toMatchObject({ checked: false, reason: "registry-unavailable" });
    expect(doneOf(events)).toMatchObject({ status: "partial" });
  });

  it("fails with a retry time when npm rate-limits every package", async () => {
    const limited = () =>
      new HttpResponse(null, {
        status: 429,
        headers: { "Retry-After": "120" },
      });
    mockNpm({ react: limited, lodash: limited });
    mockOsv();
    const { deps, start } = setup([
      dep("react", "^18.0.0"),
      dep("lodash", "^4.0.0"),
      dep("local", "file:../local"),
    ]);
    const checkId = await start();

    const events = await run(checkId, deps);

    expect(doneOf(events)).toEqual({
      type: "done",
      status: "failed",
      failureReason: "registry-rate-limited",
      retryAt: "2026-10-20T12:02:00.000Z",
    });
  });

  it("marks packages unchecked when their OSV batch fails", async () => {
    mockNpm({ react: packument(["18.3.1"]) });
    server.use(
      http.post(
        `${OSV_API_URL}/querybatch`,
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const { memory, deps, start } = setup([dep("react", "^18.0.0")]);
    const checkId = await start();

    const events = await run(checkId, deps);

    expect(memory.rows.get(checkId)?.[0]).toMatchObject({
      checked: false,
      reason: "vulnerabilities-unavailable",
      vulnerabilities: [],
    });
    expect(doneOf(events)).toMatchObject({
      status: "failed",
      failureReason: "vulnerabilities-unavailable",
    });
  });

  it("sends OSV queries in batches", async () => {
    const names = ["a", "b", "c", "d", "e"];
    mockNpm(Object.fromEntries(names.map((n) => [n, packument(["1.0.0"])])));
    const batches = mockOsv();
    const { deps, start } = setup(names.map((n) => dep(n, "^1.0.0")));
    const checkId = await start();

    await run(checkId, { ...deps, osvBatchSize: 2 });

    expect(
      batches
        .flat()
        .map((q) => q.package.name)
        .sort(),
    ).toEqual(names);
    expect(batches.length).toBeGreaterThanOrEqual(3);
    expect(batches.every((batch) => batch.length <= 2)).toBe(true);
    expect(batches.flat().every((q) => q.version === "1.0.0")).toBe(true);
  });

  it("stops on abort, keeps finished rows and ends cancelled", async () => {
    mockNpm({ fast: packument(["1.0.0"]), slow: packument(["1.0.0"]) });
    mockOsv();
    const { memory, deps, start } = setup([
      dep("fast", "^1.0.0"),
      dep("slow", "^1.0.0"),
    ]);
    const { cache, release } = holdInCache(deps.cache, "npm:slow");
    const checkId = await start();
    const controller = new AbortController();

    const events = await run(
      checkId,
      { ...deps, cache },
      {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type !== "package") return;
          controller.abort();
          release();
        },
      },
    );

    expect(packageNames(events)).toEqual(["fast"]);
    expect(memory.rows.get(checkId)?.map((r) => r.name)).toEqual(["fast"]);
    expect(doneOf(events)).toMatchObject({ status: "cancelled" });
    expect(memory.checks.get(checkId)).toMatchObject({
      status: "cancelled",
      leaseUntil: null,
    });
  });

  it("at the deadline frees the lease and leaves the check running", async () => {
    mockNpm({ fast: packument(["1.0.0"]), slow: packument(["1.0.0"]) });
    mockOsv();
    const { memory, deps, start } = setup([
      dep("fast", "^1.0.0"),
      dep("slow", "^1.0.0"),
    ]);
    const { cache, release } = holdInCache(deps.cache, "npm:slow");
    const checkId = await start();
    await memory.store.claimLease(checkId, NOW, new Date(NOW.getTime() + 1));
    const deadline = new AbortController();

    const events: CheckEvent[] = [];
    await runCheck(
      checkId,
      { ...deps, cache },
      {
        signal: new AbortController().signal,
        deadline: deadline.signal,
        emit: (event) => {
          events.push(event);
          if (event.type !== "package") return;
          deadline.abort();
          release();
        },
      },
    );

    expect(events.some((e) => e.type === "done")).toBe(false);
    expect(memory.checks.get(checkId)).toMatchObject({
      status: "running",
      leaseUntil: null,
    });
    expect(memory.rows.get(checkId)?.map((r) => r.name)).toEqual(["fast"]);

    // The reconnected stream picks up where the first one stopped.
    const next = await run(checkId, deps);
    expect(packageNames(next)).toEqual(["slow"]);
    expect(doneOf(next)).toMatchObject({ status: "completed" });
  });

  it("ends as cancelled at the deadline when nothing was checked", async () => {
    mockNpm({ slow: packument(["1.0.0"]) });
    mockOsv();
    const { deps, start } = setup([dep("slow", "^1.0.0")]);
    const checkId = await start();

    const events: CheckEvent[] = [];
    await runCheck(checkId, deps, {
      signal: new AbortController().signal,
      deadline: AbortSignal.abort(),
      emit: (event) => events.push(event),
    });

    expect(doneOf(events)).toMatchObject({ status: "cancelled" });
  });

  it("stops when the check is cancelled from elsewhere", async () => {
    const requests = mockNpm({ slow: packument(["1.0.0"]) });
    mockOsv();
    const { memory, deps, start } = setup([dep("slow", "^1.0.0")]);
    const { cache, release } = holdInCache(deps.cache, "npm:slow");
    const store: CheckStore = {
      ...memory.store,
      async renewLease(checkId, until) {
        const held = await memory.store.renewLease(checkId, until);
        // The runner has seen the cancel; let the held lookup go on.
        if (!held) release();
        return held;
      },
    };
    const checkId = await start();

    const running = run(checkId, { ...deps, cache, store, leaseRenewMs: 5 });
    await cancelCheck(memory.store, checkId, NOW);
    const events = await running;

    expect(doneOf(events)).toMatchObject({ status: "cancelled" });
    expect(requests).toEqual([]);
    expect(memory.rows.get(checkId) ?? []).toEqual([]);
  });

  it("resumes only packages without a result", async () => {
    const requests = mockNpm({
      a: packument(["1.0.0"]),
      b: packument(["1.0.0"]),
    });
    mockOsv();
    const { memory, deps, start } = setup([
      dep("a", "^1.0.0"),
      dep("b", "^1.0.0"),
    ]);
    const checkId = await start();
    await memory.store.finish(checkId, {
      status: "cancelled",
      failureReason: null,
      retryAt: null,
      score: null,
      vulnerabilityCount: null,
      severeVulnerableCount: null,
      finishedAt: NOW,
    });
    await memory.store.insertRow(
      buildPackageRow({
        checkId,
        dependency: dep("a", "^1.0.0"),
        analysis: { checked: false, reason: "registry-unavailable" },
        vulnerabilities: [],
        checkedAt: NOW,
      }),
    );

    expect((await resumeCheck(memory.store, checkId)).ok).toBe(true);
    const events = await run(checkId, deps);

    expect(requests).toEqual(["b"]);
    expect(events[0]).toEqual({ type: "progress", checked: 1, total: 2 });
    // "a" still failed, so Resume alone leaves the check partial.
    expect(doneOf(events)).toMatchObject({ status: "partial" });
  });

  it("retries only packages a source failed for", async () => {
    let npmDown = true;
    const requests = mockNpm({
      a: packument(["1.0.0"]),
      b: () =>
        npmDown
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json(packument(["1.0.0"])),
    });
    mockOsv();
    const { memory, deps, start } = setup([
      dep("a", "^1.0.0"),
      dep("b", "^1.0.0"),
    ]);
    const checkId = await start();
    const first = await run(checkId, deps);
    expect(doneOf(first)).toMatchObject({
      status: "partial",
    });

    npmDown = false;
    requests.length = 0;
    expect((await retryFailed(memory.store, checkId)).ok).toBe(true);
    const events = await run(checkId, deps);

    expect(requests).toEqual(["b"]);
    expect(doneOf(events)).toMatchObject({ status: "completed" });
    expect(memory.rows.get(checkId)?.every((r) => r.checked)).toBe(true);
  });

  it("fails the check as an internal error when the store breaks", async () => {
    mockNpm({ a: packument(["1.0.0"]) });
    mockOsv();
    const { memory, deps, start } = setup([dep("a", "^1.0.0")]);
    const checkId = await start();
    const store = {
      ...memory.store,
      insertRow: () => Promise.reject(new Error("connection lost")),
    };

    const events = await run(checkId, { ...deps, store });

    expect(doneOf(events)).toEqual({
      type: "done",
      status: "failed",
      failureReason: "internal-error",
      retryAt: null,
    });
  });

  it("emits error when even marking the check as failed is impossible", async () => {
    const { memory, deps, start } = setup([dep("a", "^1.0.0")]);
    const checkId = await start();
    const broken = () => Promise.reject(new Error("database is down"));
    const store = { ...memory.store, getInput: broken, finish: broken };

    const events = await run(checkId, { ...deps, store });

    expect(events).toEqual([{ type: "error" }]);
  });

  it("finishes at once when every package already has a result", async () => {
    const { memory, deps, start } = setup([dep("local", "file:../x")]);
    const checkId = await start();
    await memory.store.insertRow(
      buildPackageRow({
        checkId,
        dependency: dep("local", "file:../x"),
        analysis: { checked: false, reason: "not-from-registry" },
        vulnerabilities: [],
        checkedAt: NOW,
      }),
    );

    const events = await run(checkId, deps);

    expect(events).toEqual([
      { type: "progress", checked: 1, total: 1 },
      { type: "done", status: "completed", failureReason: null, retryAt: null },
    ]);
  });
});
