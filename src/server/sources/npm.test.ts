// @vitest-environment node
import { delay } from "msw";
import { http, HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLimiter } from "./limiter";
import { fetchNpmPackage, npmPackageUrl } from "./npm";
import { createMemoryCache } from "./test/memory-cache";
import { setupMswServer } from "./test/msw-server";

const server = setupMswServer();

const packument = {
  name: "left-pad",
  description: "String left pad",
  "dist-tags": { latest: "1.3.0" },
  versions: {
    "1.0.0": { name: "left-pad", version: "1.0.0", deprecated: false },
    "1.2.0": { name: "left-pad", version: "1.2.0", deprecated: "" },
    "1.3.0": {
      name: "left-pad",
      version: "1.3.0",
      deprecated: "use String.prototype.padStart()",
    },
  },
  time: {
    created: "2014-03-14T00:00:00.000Z",
    modified: "2018-04-01T00:00:00.000Z",
    "1.0.0": "2014-03-14T00:00:00.000Z",
    "1.2.0": "2017-12-01T00:00:00.000Z",
    "1.3.0": "2018-04-01T00:00:00.000Z",
  },
  license: { type: "WTFPL" },
  homepage: "https://github.com/stevemao/left-pad#readme",
  repository: {
    type: "git",
    url: "git+https://github.com/stevemao/left-pad.git",
  },
};

const url = npmPackageUrl("left-pad");

function client() {
  const { cache, entries } = createMemoryCache();
  return {
    entries,
    options: { cache, limit: createLimiter(4), http: { baseDelayMs: 0 } },
  };
}

/** Responds with each response in turn, repeating the last one. */
function respondInTurn(...responses: [() => Response, ...(() => Response)[]]) {
  const last = responses[responses.length - 1] ?? responses[0];
  const calls = { count: 0 };
  server.use(
    http.get(url, () => {
      const respond = responses[calls.count] ?? last;
      calls.count += 1;
      return respond();
    }),
  );
  return calls;
}

const status = (code: number, headers?: Record<string, string>) => () =>
  new HttpResponse(null, { status: code, headers });

beforeEach(() => {
  // Failures are logged by design; keep the test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
  return () => vi.restoreAllMocks();
});

describe("fetchNpmPackage", () => {
  it("maps the packument to registry data and card metadata", async () => {
    respondInTurn(() => HttpResponse.json(packument));

    const result = await fetchNpmPackage("left-pad", client().options);

    expect(result).toEqual({
      ok: true,
      value: {
        registry: {
          versions: {
            "1.0.0": {},
            "1.2.0": {},
            "1.3.0": { deprecated: "use String.prototype.padStart()" },
          },
          distTags: { latest: "1.3.0" },
          time: packument.time,
        },
        description: "String left pad",
        license: "WTFPL",
        homepage: "https://github.com/stevemao/left-pad#readme",
        repositoryUrl: "git+https://github.com/stevemao/left-pad.git",
      },
    });
  });

  it("encodes the slash of a scoped name", async () => {
    let requested = "";
    server.use(
      http.get("https://registry.npmjs.org/:name", ({ request }) => {
        requested = request.url;
        return HttpResponse.json({ "dist-tags": {}, versions: {} });
      }),
    );

    const result = await fetchNpmPackage("@types/node", client().options);

    expect(result.ok).toBe(true);
    expect(requested).toBe("https://registry.npmjs.org/@types%2fnode");
  });

  it("drops non-string time entries of an unpublished package", async () => {
    respondInTurn(() =>
      HttpResponse.json({
        time: {
          created: "2020-01-01T00:00:00.000Z",
          unpublished: {
            time: "2020-02-01T00:00:00.000Z",
            versions: ["1.0.0"],
          },
        },
      }),
    );

    const result = await fetchNpmPackage("left-pad", client().options);

    expect(result).toMatchObject({
      ok: true,
      value: {
        registry: {
          versions: {},
          distTags: {},
          time: { created: "2020-01-01T00:00:00.000Z" },
        },
      },
    });
  });

  it("reports a missing package without retrying", async () => {
    const calls = respondInTurn(status(404));

    const result = await fetchNpmPackage("left-pad", client().options);

    expect(result).toEqual({ ok: false, error: { code: "not-found" } });
    expect(calls.count).toBe(1);
  });

  it("retries after 429 and succeeds", async () => {
    const calls = respondInTurn(status(429, { "Retry-After": "0" }), () =>
      HttpResponse.json(packument),
    );

    const result = await fetchNpmPackage("left-pad", client().options);

    expect(result.ok).toBe(true);
    expect(calls.count).toBe(2);
  });

  it("reports the rate limit with Retry-After once retries run out", async () => {
    const calls = respondInTurn(status(429, { "Retry-After": "0" }));

    const result = await fetchNpmPackage("left-pad", client().options);

    expect(result).toEqual({
      ok: false,
      error: { code: "rate-limited", retryAfterSeconds: 0 },
    });
    expect(calls.count).toBe(3);
  });

  it("gives up at once when Retry-After is too long to wait", async () => {
    const calls = respondInTurn(status(429, { "Retry-After": "120" }));

    const result = await fetchNpmPackage("left-pad", client().options);

    expect(result).toEqual({
      ok: false,
      error: { code: "rate-limited", retryAfterSeconds: 120 },
    });
    expect(calls.count).toBe(1);
  });

  it("reports 5xx as unavailable after all retries", async () => {
    const calls = respondInTurn(status(503));

    const result = await fetchNpmPackage("left-pad", client().options);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(calls.count).toBe(3);
  });

  it("reports a network error as unavailable after all retries", async () => {
    const calls = respondInTurn(() => HttpResponse.error());

    const result = await fetchNpmPackage("left-pad", client().options);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(calls.count).toBe(3);
  });

  it("reports a timeout as unavailable without retrying", async () => {
    let calls = 0;
    server.use(
      http.get(url, async () => {
        calls += 1;
        await delay(500);
        return HttpResponse.json(packument);
      }),
    );
    const { options } = client();

    const result = await fetchNpmPackage("left-pad", {
      ...options,
      http: { baseDelayMs: 0, timeoutMs: 50 },
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(calls).toBe(1);
  });

  it.each([
    ["malformed JSON", () => new HttpResponse("{", { status: 200 })],
    ["an unexpected shape", () => HttpResponse.json({ versions: [] })],
  ])(
    "reports %s as an invalid response without retrying",
    async (_, respond) => {
      const calls = respondInTurn(respond);

      const result = await fetchNpmPackage("left-pad", client().options);

      expect(result).toEqual({
        ok: false,
        error: { code: "invalid-response" },
      });
      expect(calls.count).toBe(1);
    },
  );

  it("serves a repeated request from the cache", async () => {
    const calls = respondInTurn(() => HttpResponse.json(packument));
    const { options, entries } = client();

    const first = await fetchNpmPackage("left-pad", options);
    const second = await fetchNpmPackage("left-pad", options);

    expect(second).toEqual(first);
    expect(calls.count).toBe(1);
    expect(entries.has("npm:left-pad")).toBe(true);
  });

  it("does not cache a failure", async () => {
    const calls = respondInTurn(status(404), () =>
      HttpResponse.json(packument),
    );
    const { options } = client();

    await fetchNpmPackage("left-pad", options);
    const second = await fetchNpmPackage("left-pad", options);

    expect(second.ok).toBe(true);
    expect(calls.count).toBe(2);
  });

  it("throws when the check is cancelled during a retry wait", async () => {
    respondInTurn(status(503));
    const controller = new AbortController();
    const { options } = client();

    const pending = fetchNpmPackage("left-pad", {
      ...options,
      http: { baseDelayMs: 1000, signal: controller.signal },
    });
    setTimeout(() => controller.abort(new Error("cancelled")), 50);

    await expect(pending).rejects.toThrow("cancelled");
  });
});
