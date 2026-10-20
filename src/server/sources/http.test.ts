// @vitest-environment node
import { http, HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchJson, fetchText, parseRetryAfter } from "./http";
import { setupMswServer } from "./test/msw-server";

const server = setupMswServer();
const url = "https://example.test/resource";
const options = { baseDelayMs: 0 };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  return () => vi.restoreAllMocks();
});

/** Counts requests; every one gets the same response. */
function respond(make: () => Response) {
  const calls = { count: 0 };
  server.use(
    http.all(url, () => {
      calls.count += 1;
      return make();
    }),
  );
  return calls;
}

const epochSeconds = (offsetSeconds: number) =>
  String(Math.floor(Date.now() / 1000) + offsetSeconds);

describe("fetchJson", () => {
  it("sends a JSON body with POST", async () => {
    const received: { method?: string; type?: string | null; body?: unknown } =
      {};
    server.use(
      http.post(url, async ({ request }) => {
        received.method = request.method;
        received.type = request.headers.get("content-type");
        received.body = await request.json();
        return HttpResponse.json({ ok: 1 });
      }),
    );

    const result = await fetchJson(url, z.object({ ok: z.number() }), {
      method: "POST",
      body: { queries: [1] },
    });

    expect(result).toEqual({ ok: true, value: { ok: 1 } });
    expect(received).toEqual({
      method: "POST",
      type: "application/json",
      body: { queries: [1] },
    });
  });
});

describe("fetchText", () => {
  it("returns the body as is", async () => {
    const text = '{\n  "name": "x"\n}\n';
    respond(() => new HttpResponse(text));

    expect(await fetchText(url, options)).toEqual({ ok: true, value: text });
  });

  it.each([403, 429])(
    "reads an exhausted GitHub limit from %i without retrying",
    async (code) => {
      const calls = respond(
        () =>
          new HttpResponse(null, {
            status: code,
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": epochSeconds(600),
            },
          }),
      );

      const result = await fetchText(url, options);

      expect(calls.count).toBe(1);
      expect(result.ok).toBe(false);
      if (result.ok || result.error.code !== "rate-limited") {
        throw new Error("expected rate-limited");
      }
      expect(result.error.retryAfterSeconds).toBeGreaterThan(590);
      expect(result.error.retryAfterSeconds).toBeLessThanOrEqual(600);
    },
  );

  it("uses Retry-After of a secondary limit sent with 403", async () => {
    const calls = respond(
      () =>
        new HttpResponse(null, {
          status: 403,
          headers: { "retry-after": "30" },
        }),
    );

    expect(await fetchText(url, options)).toEqual({
      ok: false,
      error: { code: "rate-limited", retryAfterSeconds: 30 },
    });
    expect(calls.count).toBe(1);
  });

  it("waits a minute after a secondary limit without headers", async () => {
    const calls = respond(() =>
      HttpResponse.json(
        { message: "You have exceeded a secondary rate limit." },
        { status: 403 },
      ),
    );

    expect(await fetchText(url, options)).toEqual({
      ok: false,
      error: { code: "rate-limited", retryAfterSeconds: 60 },
    });
    expect(calls.count).toBe(1);
  });

  it("treats a plain 403 as unavailable without retrying", async () => {
    const calls = respond(() =>
      HttpResponse.json(
        { message: "Resource not accessible" },
        { status: 403 },
      ),
    );

    expect(await fetchText(url, options)).toEqual({
      ok: false,
      error: { code: "unavailable" },
    });
    expect(calls.count).toBe(1);
  });
});

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-10-20T12:00:00.000Z");

  it("reads delay seconds", () => {
    expect(parseRetryAfter("30", now)).toBe(30_000);
  });

  it("reads an HTTP date", () => {
    expect(parseRetryAfter("Tue, 20 Oct 2026 12:01:00 GMT", now)).toBe(60_000);
  });

  it("clamps a past date to zero", () => {
    expect(parseRetryAfter("Tue, 20 Oct 2026 11:00:00 GMT", now)).toBe(0);
  });

  it.each([null, "", "soon"])("ignores %j", (value) => {
    expect(parseRetryAfter(value, now)).toBeUndefined();
  });
});
