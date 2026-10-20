import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import { MAX_LOCKFILE_BYTES, parseLockfile } from "./analysis/parse-lockfile";
import type { LockedVersionsResult } from "./analysis/report-input";

const gunzipAsync = promisify(gunzip);

/**
 * package-lock.json from Upload arrives gzipped: lockfiles reach 10 MB, while
 * Vercel caps a function request body at 4.5 MB (decisions 28).
 */
export async function readUploadedLockfile(
  gzipped: Blob,
): Promise<LockedVersionsResult> {
  let text: string;
  try {
    // The cap guards against a small archive that inflates to gigabytes.
    const inflated = await gunzipAsync(
      Buffer.from(await gzipped.arrayBuffer()),
      { maxOutputLength: MAX_LOCKFILE_BYTES },
    );
    text = inflated.toString("utf8");
  } catch (error) {
    if (isTooLarge(error)) {
      return {
        ok: false,
        error: { code: "too-large", maxBytes: MAX_LOCKFILE_BYTES },
      };
    }
    // Not gzip or truncated: unusable, and the check goes on without it.
    return { ok: false, error: { code: "unsupported" } };
  }
  return lockedVersionsFromText(text);
}

export function lockedVersionsFromText(text: string): LockedVersionsResult {
  const result = parseLockfile(text);
  return result.ok
    ? { ok: true, value: Object.fromEntries(result.value) }
    : result;
}

function isTooLarge(error: unknown): boolean {
  return (
    error instanceof RangeError &&
    "code" in error &&
    error.code === "ERR_BUFFER_TOO_LARGE"
  );
}
