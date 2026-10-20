// @vitest-environment node
import { http, HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchReleases, fetchRepoSource, GITHUB_API_URL } from "./github";
import { createLimiter } from "./limiter";
import { createMemoryCache } from "./test/memory-cache";
import { setupMswServer } from "./test/msw-server";

const server = setupMswServer();

const repo = { owner: "acme", repo: "shop" };
const base = `${GITHUB_API_URL}/repos/acme/shop`;
const packageJson = '{\n  "dependencies": { "react": "^18.0.0" }\n}\n';
const packageLock = '{ "lockfileVersion": 3 }';
const http0 = { baseDelayMs: 0 };

const listing = (...names: string[]) =>
  HttpResponse.json(names.map((name) => ({ name, type: "file" })));

const raw = (text: string) => new HttpResponse(text);

/** A public repo with the given root files, served from `files`. */
function mockRepo(files: Record<string, string | (() => Response)>) {
  const requests: Request[] = [];
  server.use(
    http.get(base, ({ request }) => {
      requests.push(request);
      return HttpResponse.json({ private: false, default_branch: "main" });
    }),
    http.get(`${base}/contents/`, () => listing(...Object.keys(files))),
    http.get(`${base}/contents/:file`, ({ params, request }) => {
      requests.push(request);
      const file = files[String(params.file)];
      if (file === undefined) return new HttpResponse(null, { status: 404 });
      return typeof file === "string" ? raw(file) : file();
    }),
  );
  return requests;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  return () => vi.restoreAllMocks();
});

describe("fetchRepoSource", () => {
  it("reads package.json, the lockfile and the root file names", async () => {
    const requests = mockRepo({
      "package.json": packageJson,
      "package-lock.json": packageLock,
      "pnpm-lock.yaml": "lockfileVersion: 9",
    });

    const result = await fetchRepoSource(repo, { http: http0 });

    expect(result).toEqual({
      ok: true,
      value: {
        packageJson,
        packageLock,
        files: ["package.json", "package-lock.json", "pnpm-lock.yaml"],
      },
    });
    const fileRequest = requests.find((r) => r.url.endsWith("package.json"));
    expect(fileRequest?.headers.get("accept")).toBe(
      "application/vnd.github.raw+json",
    );
    expect(fileRequest?.headers.get("x-github-api-version")).toBe("2026-03-10");
  });

  it("works without a lockfile", async () => {
    mockRepo({ "package.json": packageJson, "README.md": "# shop" });

    const result = await fetchRepoSource(repo, { http: http0 });

    expect(result).toEqual({
      ok: true,
      value: { packageJson, files: ["package.json", "README.md"] },
    });
  });

  it("goes on without a lockfile that failed to load", async () => {
    mockRepo({
      "package.json": packageJson,
      "package-lock.json": () => new HttpResponse(null, { status: 500 }),
    });

    const result = await fetchRepoSource(repo, { http: http0 });

    expect(result.ok && result.value.packageLock).toBeUndefined();
    expect(result.ok && result.value.packageJson).toBe(packageJson);
  });

  it("sends the token only when given", async () => {
    const withToken = mockRepo({ "package.json": packageJson });
    await fetchRepoSource(repo, { token: "t0ken", http: http0 });
    expect(withToken[0]?.headers.get("authorization")).toBe("Bearer t0ken");

    server.resetHandlers();
    const withoutToken = mockRepo({ "package.json": packageJson });
    await fetchRepoSource(repo, { http: http0 });
    expect(withoutToken[0]?.headers.has("authorization")).toBe(false);
  });

  it("reports a missing repository as not found", async () => {
    server.use(http.get(base, () => new HttpResponse(null, { status: 404 })));

    expect(await fetchRepoSource(repo, { http: http0 })).toEqual({
      ok: false,
      error: { code: "not-found" },
    });
  });

  it("treats a private repository the token can see as not found", async () => {
    server.use(
      http.get(base, () =>
        HttpResponse.json({ private: true, default_branch: "main" }),
      ),
    );

    expect(await fetchRepoSource(repo, { http: http0 })).toEqual({
      ok: false,
      error: { code: "not-found" },
    });
  });

  it("reports a repository without package.json in the root", async () => {
    mockRepo({ "README.md": "# shop", "yarn.lock": "" });

    expect(await fetchRepoSource(repo, { http: http0 })).toEqual({
      ok: false,
      error: { code: "no-package-json" },
    });
  });

  it("reports an empty repository as having no package.json", async () => {
    server.use(
      http.get(base, () =>
        HttpResponse.json({ private: false, default_branch: "main" }),
      ),
      http.get(`${base}/contents/`, () =>
        HttpResponse.json(
          { message: "This repository is empty." },
          { status: 404 },
        ),
      ),
    );

    expect(await fetchRepoSource(repo, { http: http0 })).toEqual({
      ok: false,
      error: { code: "no-package-json" },
    });
  });

  it("reports the rate limit with seconds until the reset", async () => {
    const reset = Math.floor(Date.now() / 1000) + 25 * 60;
    server.use(
      http.get(
        base,
        () =>
          new HttpResponse(
            JSON.stringify({ message: "API rate limit exceeded" }),
            {
              status: 403,
              headers: {
                "x-ratelimit-remaining": "0",
                "x-ratelimit-reset": String(reset),
              },
            },
          ),
      ),
    );

    const result = await fetchRepoSource(repo, { http: http0 });

    if (result.ok || result.error.code !== "rate-limited") {
      throw new Error("expected rate-limited");
    }
    expect(result.error.retryAfterSeconds).toBeGreaterThan(24 * 60);
    expect(result.error.retryAfterSeconds).toBeLessThanOrEqual(25 * 60);
  });

  it("reports a secondary limit with Retry-After", async () => {
    server.use(
      http.get(
        base,
        () =>
          new HttpResponse(null, {
            status: 429,
            headers: { "retry-after": "120" },
          }),
      ),
    );

    expect(await fetchRepoSource(repo, { http: http0 })).toEqual({
      ok: false,
      error: { code: "rate-limited", retryAfterSeconds: 120 },
    });
  });
});

describe("fetchReleases", () => {
  const releases = [
    {
      tag_name: "v2.0.0",
      name: "v2.0.0",
      body: "## Breaking changes",
      draft: false,
      prerelease: false,
      published_at: "2026-09-01T00:00:00Z",
      html_url: "https://github.com/acme/shop/releases/tag/v2.0.0",
    },
    {
      tag_name: "v2.1.0",
      name: "Next",
      body: "wip",
      draft: true,
      prerelease: false,
      published_at: null,
      html_url: "https://github.com/acme/shop/releases/tag/untagged",
    },
    {
      tag_name: "v1.0.0",
      name: null,
      body: null,
      draft: false,
      prerelease: true,
      published_at: "2026-01-01T00:00:00Z",
      html_url: "https://github.com/acme/shop/releases/tag/v1.0.0",
    },
  ];

  function options() {
    const { cache, entries } = createMemoryCache();
    return {
      entries,
      options: { cache, limit: createLimiter(2), http: http0 },
    };
  }

  it("maps published releases and drops drafts", async () => {
    let perPage: string | null = null;
    server.use(
      http.get(`${base}/releases`, ({ request }) => {
        perPage = new URL(request.url).searchParams.get("per_page");
        return HttpResponse.json(releases);
      }),
    );

    const result = await fetchReleases(repo, options().options);

    expect(perPage).toBe("100");
    expect(result).toEqual({
      ok: true,
      value: [
        {
          tag: "v2.0.0",
          name: "v2.0.0",
          body: "## Breaking changes",
          publishedAt: "2026-09-01T00:00:00Z",
          url: "https://github.com/acme/shop/releases/tag/v2.0.0",
          prerelease: false,
        },
        {
          tag: "v1.0.0",
          publishedAt: "2026-01-01T00:00:00Z",
          url: "https://github.com/acme/shop/releases/tag/v1.0.0",
          prerelease: true,
        },
      ],
    });
  });

  it("serves a repeated request from the cache, ignoring name case", async () => {
    const calls = { count: 0 };
    server.use(
      http.get(`${GITHUB_API_URL}/repos/:owner/:repo/releases`, () => {
        calls.count += 1;
        return HttpResponse.json(releases);
      }),
    );
    const { options: client, entries } = options();

    await fetchReleases(repo, client);
    const again = await fetchReleases({ owner: "ACME", repo: "Shop" }, client);

    expect(calls.count).toBe(1);
    expect([...entries.keys()]).toEqual(["github:releases:acme/shop"]);
    expect(again.ok && again.value).toHaveLength(2);
  });

  it("does not cache a failure", async () => {
    server.use(
      http.get(
        `${base}/releases`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    const { options: client, entries } = options();

    expect(await fetchReleases(repo, client)).toEqual({
      ok: false,
      error: { code: "not-found" },
    });
    expect(entries.size).toBe(0);
  });
});
