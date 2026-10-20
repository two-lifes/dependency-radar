// @vitest-environment node
import { http, HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLimiter } from "./limiter";
import { fetchVulnerabilities, OSV_API_URL } from "./osv";
import { createMemoryCache } from "./test/memory-cache";
import { setupMswServer } from "./test/msw-server";

const server = setupMswServer();

type BatchQuery = {
  package: { ecosystem: string; name: string };
  version: string;
  page_token?: string;
};

const record = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  modified: "2026-01-01T00:00:00Z",
  summary: `${id} summary`,
  affected: [
    {
      package: { ecosystem: "npm", name: "lodash" },
      ranges: [
        { type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] },
      ],
    },
  ],
  ...extra,
});

/**
 * Serves querybatch from `idsFor(query)` and records from `records`; counts
 * requests and keeps every batch body.
 */
function mockOsv(options: {
  idsFor: (query: BatchQuery) => { ids: string[]; next?: string };
  records?: Record<string, object>;
}) {
  const calls = { batches: [] as BatchQuery[][], vulns: [] as string[] };
  server.use(
    http.post(`${OSV_API_URL}/querybatch`, async ({ request }) => {
      const body = (await request.json()) as { queries: BatchQuery[] };
      calls.batches.push(body.queries);
      return HttpResponse.json({
        results: body.queries.map((query) => {
          const { ids, next } = options.idsFor(query);
          return ids.length === 0 && !next
            ? {}
            : {
                vulns: ids.map((id) => ({ id, modified: "2026-01-01" })),
                ...(next ? { next_page_token: next } : {}),
              };
        }),
      });
    }),
    http.get(`${OSV_API_URL}/vulns/:id`, ({ params }) => {
      const id = String(params.id);
      calls.vulns.push(id);
      const found = options.records?.[id];
      return found
        ? HttpResponse.json(found)
        : new HttpResponse(null, { status: 404 });
    }),
  );
  return calls;
}

function client() {
  const { cache, entries } = createMemoryCache();
  return {
    entries,
    options: { cache, limit: createLimiter(4), http: { baseDelayMs: 0 } },
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  return () => vi.restoreAllMocks();
});

describe("fetchVulnerabilities", () => {
  it("returns records per package in input order", async () => {
    const calls = mockOsv({
      idsFor: (q) => ({ ids: q.package.name === "lodash" ? ["GHSA-1"] : [] }),
      records: { "GHSA-1": record("GHSA-1", { aliases: ["CVE-1"] }) },
    });

    const result = await fetchVulnerabilities(
      [
        { name: "react", version: "18.0.0" },
        { name: "lodash", version: "4.17.20" },
      ],
      client().options,
    );

    expect(calls.batches).toEqual([
      [
        { package: { ecosystem: "npm", name: "react" }, version: "18.0.0" },
        { package: { ecosystem: "npm", name: "lodash" }, version: "4.17.20" },
      ],
    ]);
    expect(result).toEqual([
      { ok: true, value: [] },
      {
        ok: true,
        value: [
          {
            id: "GHSA-1",
            aliases: ["CVE-1"],
            summary: "GHSA-1 summary",
            affected: [
              {
                package: { ecosystem: "npm", name: "lodash" },
                ranges: [
                  {
                    type: "SEMVER",
                    events: [{ introduced: "0" }, { fixed: "4.17.21" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("loads a record shared by two packages once", async () => {
    const calls = mockOsv({
      idsFor: () => ({ ids: ["GHSA-1"] }),
      records: { "GHSA-1": record("GHSA-1") },
    });

    const result = await fetchVulnerabilities(
      [
        { name: "a", version: "1.0.0" },
        { name: "b", version: "1.0.0" },
      ],
      client().options,
    );

    expect(calls.vulns).toEqual(["GHSA-1"]);
    expect(result.map((r) => r.ok && r.value.map((v) => v.id))).toEqual([
      ["GHSA-1"],
      ["GHSA-1"],
    ]);
  });

  it("keeps a non-string database severity out of the record", async () => {
    mockOsv({
      idsFor: () => ({ ids: ["OSV-1"] }),
      records: {
        "OSV-1": record("OSV-1", { database_specific: { severity: 7 } }),
      },
    });

    const [result] = await fetchVulnerabilities(
      [{ name: "a", version: "1.0.0" }],
      client().options,
    );

    expect(result?.ok && result.value[0]?.database_specific).toEqual({});
  });

  it("queries only packages missing from the cache", async () => {
    mockOsv({
      idsFor: () => ({ ids: ["GHSA-1"] }),
      records: { "GHSA-1": record("GHSA-1") },
    });
    const { options, entries } = client();
    await fetchVulnerabilities([{ name: "a", version: "1.0.0" }], options);
    expect([...entries.keys()].sort()).toEqual([
      "osv:query:a@1.0.0",
      "osv:vuln:GHSA-1",
    ]);

    server.resetHandlers();
    const calls = mockOsv({ idsFor: () => ({ ids: [] }) });
    const result = await fetchVulnerabilities(
      [
        { name: "a", version: "1.0.0" },
        { name: "b", version: "2.0.0" },
      ],
      options,
    );

    expect(calls.batches).toEqual([
      [{ package: { ecosystem: "npm", name: "b" }, version: "2.0.0" }],
    ]);
    expect(calls.vulns).toEqual([]);
    expect(result.map((r) => r.ok && r.value.map((v) => v.id))).toEqual([
      ["GHSA-1"],
      [],
    ]);
  });

  it("follows next_page_token only for the queries that have one", async () => {
    const calls = mockOsv({
      idsFor: (q) => {
        if (q.package.name !== "big") return { ids: [] };
        return q.page_token === "p2"
          ? { ids: ["GHSA-2"] }
          : { ids: ["GHSA-1"], next: "p2" };
      },
      records: { "GHSA-1": record("GHSA-1"), "GHSA-2": record("GHSA-2") },
    });

    const result = await fetchVulnerabilities(
      [
        { name: "small", version: "1.0.0" },
        { name: "big", version: "1.0.0" },
      ],
      client().options,
    );

    expect(calls.batches[1]).toEqual([
      {
        package: { ecosystem: "npm", name: "big" },
        version: "1.0.0",
        page_token: "p2",
      },
    ]);
    expect(result.map((r) => r.ok && r.value.map((v) => v.id))).toEqual([
      [],
      ["GHSA-1", "GHSA-2"],
    ]);
  });

  it("gives up on a page token that never ends", async () => {
    const calls = mockOsv({ idsFor: () => ({ ids: [], next: "again" }) });

    const result = await fetchVulnerabilities(
      [{ name: "a", version: "1.0.0" }],
      client().options,
    );

    expect(calls.batches).toHaveLength(10);
    expect(result).toEqual([
      { ok: false, error: { code: "invalid-response" } },
    ]);
  });

  it("splits more than 1000 queries into batches", async () => {
    const calls = mockOsv({ idsFor: () => ({ ids: [] }) });
    const packages = Array.from({ length: 1001 }, (_, i) => ({
      name: `p${i}`,
      version: "1.0.0",
    }));

    const result = await fetchVulnerabilities(packages, client().options);

    expect(calls.batches.map((b) => b.length).sort((a, b) => a - b)).toEqual([
      1, 1000,
    ]);
    expect(result).toHaveLength(1001);
    expect(result.every((r) => r.ok)).toBe(true);
  });

  it("fails every package of a batch that failed and caches nothing", async () => {
    server.use(
      http.post(
        `${OSV_API_URL}/querybatch`,
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const { options, entries } = client();

    const result = await fetchVulnerabilities(
      [
        { name: "a", version: "1.0.0" },
        { name: "b", version: "1.0.0" },
      ],
      options,
    );

    expect(result).toEqual([
      { ok: false, error: { code: "unavailable" } },
      { ok: false, error: { code: "unavailable" } },
    ]);
    expect(entries.size).toBe(0);
  });

  it("fails only the packages whose record couldn't be loaded", async () => {
    mockOsv({
      idsFor: (q) => ({
        ids: q.package.name === "a" ? ["GHSA-gone", "GHSA-1"] : ["GHSA-1"],
      }),
      records: { "GHSA-1": record("GHSA-1") },
    });

    const result = await fetchVulnerabilities(
      [
        { name: "a", version: "1.0.0" },
        { name: "b", version: "1.0.0" },
      ],
      client().options,
    );

    expect(result[0]).toEqual({ ok: false, error: { code: "not-found" } });
    expect(result[1]?.ok).toBe(true);
  });

  it("reports a result count that doesn't match the queries as invalid", async () => {
    server.use(
      http.post(`${OSV_API_URL}/querybatch`, () =>
        HttpResponse.json({ results: [{}] }),
      ),
    );

    const result = await fetchVulnerabilities(
      [
        { name: "a", version: "1.0.0" },
        { name: "b", version: "1.0.0" },
      ],
      client().options,
    );

    expect(result).toEqual([
      { ok: false, error: { code: "invalid-response" } },
      { ok: false, error: { code: "invalid-response" } },
    ]);
  });

  it("sends no request for an empty list", async () => {
    expect(await fetchVulnerabilities([], client().options)).toEqual([]);
  });
});
