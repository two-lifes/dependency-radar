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
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
};

const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_TIMEOUT_MS = 10_000;
// A longer Retry-After would stall the whole check; give up and report it.
const MAX_RETRY_DELAY_MS = 5_000;

type Attempt =
  | { done: true; result: Result<unknown, SourceError> }
  | { done: false; error: SourceError; retryAfterMs?: number };

/**
 * GET a JSON document and validate it. 429, 5xx, timeouts and network errors
 * are retried with exponential backoff; everything ends as a `Result`, except
 * cancellation through `signal`, which throws.
 */
export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  options: FetchJsonOptions = {},
): Promise<Result<T, SourceError>> {
  const {
    signal,
    headers,
    retries = DEFAULT_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  for (let attempt = 0; ; attempt++) {
    const outcome = await attemptFetch(url, { signal, headers, timeoutMs });

    if (outcome.done) {
      if (!outcome.result.ok) return outcome.result;
      const parsed = schema.safeParse(outcome.result.value);
      return parsed.success
        ? { ok: true, value: parsed.data }
        : { ok: false, error: { code: "invalid-response" } };
    }

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
  options: {
    signal?: AbortSignal;
    headers?: Record<string, string>;
    timeoutMs: number;
  },
): Promise<Attempt> {
  const { signal, headers, timeoutMs } = options;
  const unavailable: Attempt = { done: false, error: { code: "unavailable" } };

  let response: Response;
  let body: string;
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    response = await fetch(url, {
      headers,
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
  if (response.status === 429) {
    const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
    return {
      done: false,
      error: {
        code: "rate-limited",
        retryAfterSeconds:
          retryAfterMs === undefined
            ? undefined
            : Math.ceil(retryAfterMs / 1000),
      },
      retryAfterMs,
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

  try {
    return { done: true, result: { ok: true, value: JSON.parse(body) } };
  } catch {
    // Malformed JSON is reported like a schema mismatch.
    return {
      done: true,
      result: { ok: false, error: { code: "invalid-response" } },
    };
  }
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
