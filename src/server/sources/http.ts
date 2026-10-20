import type { z } from "zod";
import type { Result } from "../analysis/result";

/** Why one source request failed; the check marks only that package. */
export type SourceError =
  | { code: "not-found" }
  | { code: "rate-limited"; retryAfterSeconds?: number }
  | { code: "unavailable" }
  | { code: "invalid-response" };

export type FetchJsonOptions = {
  /** Cancels the request and any pending retry; the abort reason is thrown. */
  signal?: AbortSignal;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  /** Sent as JSON. */
  body?: unknown;
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
};

const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_TIMEOUT_MS = 10_000;
// A longer Retry-After would stall the whole check; give up and report it.
const MAX_RETRY_DELAY_MS = 5_000;
// GitHub docs: after a secondary rate limit without headers, wait at least a minute.
const SECONDARY_LIMIT_DELAY_MS = 60_000;

type Attempt =
  | { done: true; result: Result<string, SourceError> }
  | { done: false; error: SourceError; retryAfterMs?: number };

/**
 * Fetch a JSON document and validate it. 429, 5xx, timeouts and network errors
 * are retried with exponential backoff; everything ends as a `Result`, except
 * cancellation through `signal`, which throws.
 */
export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  options: FetchJsonOptions = {},
): Promise<Result<T, SourceError>> {
  const text = await fetchText(url, options);
  if (!text.ok) return text;

  let raw: unknown;
  try {
    raw = JSON.parse(text.value);
  } catch {
    // Malformed JSON is reported like a schema mismatch.
    return { ok: false, error: { code: "invalid-response" } };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: { code: "invalid-response" } };
}

/** Like `fetchJson`, but returns the body as is (files read from GitHub). */
export async function fetchText(
  url: string,
  options: FetchJsonOptions = {},
): Promise<Result<string, SourceError>> {
  const {
    signal,
    headers,
    method,
    body,
    retries = DEFAULT_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  for (let attempt = 0; ; attempt++) {
    const outcome = await attemptFetch(url, {
      signal,
      headers,
      method,
      body,
      timeoutMs,
    });
    if (outcome.done) return outcome.result;

    const backoffMs = baseDelayMs * 2 ** attempt;
    const delayMs = Math.max(backoffMs, outcome.retryAfterMs ?? 0);
    if (attempt >= retries || delayMs > MAX_RETRY_DELAY_MS) {
      return { ok: false, error: outcome.error };
    }
    await sleep(delayMs, signal);
  }
}

async function attemptFetch(
  url: string,
  options: Omit<FetchJsonOptions, "retries" | "baseDelayMs"> & {
    timeoutMs: number;
  },
): Promise<Attempt> {
  const { signal, headers, method, body: payload, timeoutMs } = options;
  const unavailable: Attempt = { done: false, error: { code: "unavailable" } };

  let response: Response;
  let body: string;
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    response = await fetch(url, {
      method,
      headers:
        payload === undefined
          ? headers
          : { "content-type": "application/json", ...headers },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    body = await response.text();
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    console.error(`[sources] ${url} failed`, error);
    // A slow source (huge packument) would just time out again, costing the
    // whole timeout per retry. A network failure may recover.
    if (timeout.aborted) {
      return {
        done: true,
        result: { ok: false, error: { code: "unavailable" } },
      };
    }
    return unavailable;
  }

  if (response.status === 404) {
    return { done: true, result: { ok: false, error: { code: "not-found" } } };
  }
  const limit = rateLimit(response.status, response.headers, body);
  if (limit) {
    return {
      done: false,
      error: {
        code: "rate-limited",
        retryAfterSeconds:
          limit.retryAfterMs === undefined
            ? undefined
            : Math.ceil(limit.retryAfterMs / 1000),
      },
      retryAfterMs: limit.retryAfterMs,
    };
  }
  if (response.status >= 500) return unavailable;
  if (!response.ok) {
    // Other 4xx won't change on retry.
    return {
      done: true,
      result: { ok: false, error: { code: "unavailable" } },
    };
  }

  return { done: true, result: { ok: true, value: body } };
}

/**
 * GitHub reports rate limits with 403 as well as 429: the primary limit sets
 * `x-ratelimit-remaining: 0` and the reset time, a secondary one may send
 * `retry-after` or only a message. A plain 403 (no access) is not a limit.
 */
function rateLimit(
  status: number,
  headers: Headers,
  body: string,
  now: number = Date.now(),
): { retryAfterMs?: number } | undefined {
  if (status !== 429 && status !== 403) return undefined;

  const retryAfterMs = parseRetryAfter(headers.get("retry-after"), now);
  if (retryAfterMs !== undefined) return { retryAfterMs };

  if (headers.get("x-ratelimit-remaining") === "0") {
    const resetHeader = headers.get("x-ratelimit-reset");
    const reset = Number(resetHeader);
    if (resetHeader && Number.isFinite(reset)) {
      return { retryAfterMs: Math.max(0, reset * 1000 - now) };
    }
    return { retryAfterMs: SECONDARY_LIMIT_DELAY_MS };
  }

  if (status === 429) return {};
  return /rate limit/i.test(body)
    ? { retryAfterMs: SECONDARY_LIMIT_DELAY_MS }
    : undefined;
}

/** `Retry-After` is either delay seconds or an HTTP date. */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
