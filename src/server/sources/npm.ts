import { z } from "zod";
import type { RegistryPackage } from "../analysis/registry-package";
import type { Result } from "../analysis/result";
import { type Cache, withCache } from "./cache";
import { fetchJson, type FetchJsonOptions, type SourceError } from "./http";
import type { Limiter } from "./limiter";

export const NPM_REGISTRY_URL = "https://registry.npmjs.org";

// Full packuments of `next` or `typescript` are 2+ MB gzipped and took
// 12–23 s on a slow connection; the default 10 s would never get them.
const NPM_TIMEOUT_MS = 30_000;

/** Registry data for the analysis plus metadata for the package card. */
export type NpmPackageInfo = {
  registry: RegistryPackage;
  description?: string;
  license?: string;
  homepage?: string;
  /** As published, e.g. `git+https://github.com/o/r.git`. */
  repositoryUrl?: string;
};

export type NpmClientOptions = {
  cache: Cache;
  limit: Limiter;
  http?: FetchJsonOptions;
};

// The full packument: the abbreviated one has no `time`, which stale needs.
const packumentSchema = z.object({
  description: z.string().optional(),
  "dist-tags": z.record(z.string(), z.string()).default({}),
  versions: z
    .record(
      z.string(),
      // Some old packages publish `deprecated: false` or "".
      z.object({ deprecated: z.union([z.string(), z.boolean()]).optional() }),
    )
    .default({}),
  // Unpublished packages keep `time.unpublished` as an object.
  time: z.record(z.string(), z.unknown()).default({}),
  license: z.unknown().optional(),
  homepage: z.string().optional(),
  repository: z
    .union([z.string(), z.object({ url: z.string().optional() })])
    .optional(),
});

type Packument = z.infer<typeof packumentSchema>;

// Validates what we stored, not what npm sent: the cache holds the trimmed
// shape because full packuments of popular packages weigh megabytes.
const npmPackageInfoSchema: z.ZodType<NpmPackageInfo> = z.object({
  registry: z.object({
    versions: z.record(
      z.string(),
      z.object({ deprecated: z.string().optional() }),
    ),
    distTags: z.record(z.string(), z.string()),
    time: z.record(z.string(), z.string()),
  }),
  description: z.string().optional(),
  license: z.string().optional(),
  homepage: z.string().optional(),
  repositoryUrl: z.string().optional(),
});

export function fetchNpmPackage(
  name: string,
  options: NpmClientOptions,
): Promise<Result<NpmPackageInfo, SourceError>> {
  return withCache(options.cache, `npm:${name}`, npmPackageInfoSchema, () =>
    options.limit(async () => {
      const result = await fetchJson(npmPackageUrl(name), packumentSchema, {
        timeoutMs: NPM_TIMEOUT_MS,
        ...options.http,
      });
      return result.ok
        ? { ok: true, value: toPackageInfo(result.value) }
        : result;
    }),
  );
}

/** Scoped names keep `@` but encode the slash, as the registry expects. */
export function npmPackageUrl(name: string): string {
  return `${NPM_REGISTRY_URL}/${name.replace("/", "%2f")}`;
}

function toPackageInfo(doc: Packument): NpmPackageInfo {
  const versions: RegistryPackage["versions"] = {};
  for (const [version, meta] of Object.entries(doc.versions)) {
    versions[version] =
      typeof meta.deprecated === "string" && meta.deprecated !== ""
        ? { deprecated: meta.deprecated }
        : {};
  }

  const time: RegistryPackage["time"] = {};
  for (const [key, value] of Object.entries(doc.time)) {
    if (typeof value === "string") time[key] = value;
  }

  return {
    registry: { versions, distTags: doc["dist-tags"], time },
    description: doc.description,
    license: licenseName(doc.license),
    homepage: doc.homepage,
    repositoryUrl:
      typeof doc.repository === "string" ? doc.repository : doc.repository?.url,
  };
}

// `license` is an SPDX string; legacy packages use `{ type }`.
function licenseName(license: unknown): string | undefined {
  if (typeof license === "string") return license;
  const parsed = z.object({ type: z.string() }).safeParse(license);
  return parsed.success ? parsed.data.type : undefined;
}
