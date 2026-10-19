import { z } from "zod";
import type { Result } from "./result";

// Real lockfiles are often several MB, so they get a separate, larger limit
// than package.json.
export const MAX_LOCKFILE_BYTES = 10 * 1024 * 1024;

export type LockedPackage = {
  version: string;
  /** Set when the installed name is an `npm:` alias for another package. */
  realName?: string;
};

export type LockfileError =
  { code: "too-large"; maxBytes: number } | { code: "unsupported" };

const lockfileSchema = z.object({
  lockfileVersion: z.union([z.literal(2), z.literal(3)]),
  packages: z.record(
    z.string(),
    z.object({
      name: z.string().optional(),
      version: z.string().optional(),
      link: z.boolean().optional(),
    }),
  ),
});

// Direct dependencies live at the top level: `node_modules/<name>` or
// `node_modules/@scope/<name>`. Anything deeper is transitive.
const TOP_LEVEL_KEY = /^node_modules\/((?:@[^/]+\/)?[^/]+)$/;

/** Parses package-lock.json v2/v3 into installed versions of top-level packages. */
export function parseLockfile(
  text: string,
): Result<Map<string, LockedPackage>, LockfileError> {
  if (new TextEncoder().encode(text).length > MAX_LOCKFILE_BYTES) {
    return {
      ok: false,
      error: { code: "too-large", maxBytes: MAX_LOCKFILE_BYTES },
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: "unsupported" } };
  }

  const parsed = lockfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: "unsupported" } };
  }

  const packages = new Map<string, LockedPackage>();
  for (const [key, entry] of Object.entries(parsed.data.packages)) {
    const name = TOP_LEVEL_KEY.exec(key)?.[1];
    if (!name || entry.link || entry.version === undefined) continue;

    packages.set(name, {
      version: entry.version,
      ...(entry.name !== undefined &&
        entry.name !== name && { realName: entry.name }),
    });
  }

  return { ok: true, value: packages };
}
