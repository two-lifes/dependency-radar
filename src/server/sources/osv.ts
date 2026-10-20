import { z } from "zod";
import type { OsvRecord } from "../analysis/osv-record";
import type { Result } from "../analysis/result";
import { type Cache, readCache, withCache, writeCache } from "./cache";
import { fetchJson, type FetchJsonOptions, type SourceError } from "./http";
import type { Limiter } from "./limiter";

export const OSV_API_URL = "https://api.osv.dev/v1";

// The OSV docs don't state a batch size limit; 1000 is the commonly cited one.
// A check has at most 300 packages (spec 9), so this is only a guard.
const MAX_BATCH_SIZE = 1000;
// Pages appear only past ~1000 vulnerabilities per query; a token that never
// ends would otherwise stall the check.
const MAX_PAGES = 10;

export type OsvQuery = { name: string; version: string };

export type OsvClientOptions = {
  cache: Cache;
  limit: Limiter;
  http?: FetchJsonOptions;
};

const eventSchema = z.object({
  introduced: z.string().optional(),
  fixed: z.string().optional(),
  last_affected: z.string().optional(),
});

// Also validates cached records. Unknown fields are dropped, so the cache
// holds only what the analysis and the package card use.
const osvRecordSchema: z.ZodType<OsvRecord> = z.object({
  id: z.string(),
  aliases: z.array(z.string()).optional(),
  summary: z.string().optional(),
  details: z.string().optional(),
  withdrawn: z.string().optional(),
  severity: z
    .array(z.object({ type: z.string(), score: z.string() }))
    .optional(),
  // Only GHSA's string label is used; other databases put anything here.
  database_specific: z
    .object({ severity: z.string().optional().catch(undefined) })
    .optional()
    .catch(undefined),
  affected: z
    .array(
      z.object({
        package: z
          .object({ ecosystem: z.string(), name: z.string() })
          .optional(),
        ranges: z
          .array(z.object({ type: z.string(), events: z.array(eventSchema) }))
          .optional(),
        versions: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

const idsSchema = z.array(z.string());

// querybatch returns only `id` and `modified`; records come from /vulns/{id}.
const batchSchema = z.object({
  results: z.array(
    z.object({
      vulns: z.array(z.object({ id: z.string() })).default([]),
      next_page_token: z.string().optional(),
    }),
  ),
});

/**
 * Vulnerability records for each package version, in the order of `packages`.
 * A failed batch fails its packages; a record that couldn't be loaded fails
 * only the packages it affects, since an incomplete list would look safer
 * than it is.
 */
export async function fetchVulnerabilities(
  packages: readonly OsvQuery[],
  options: OsvClientOptions,
): Promise<Result<OsvRecord[], SourceError>[]> {
  const idLists = await queryIds(packages, options);

  const uniqueIds = new Set(
    idLists.flatMap((ids) => (ids.ok ? ids.value : [])),
  );
  const records = new Map(
    await Promise.all(
      [...uniqueIds].map(
        async (id) => [id, await fetchVulnerability(id, options)] as const,
      ),
    ),
  );

  return idLists.map((ids) => {
    if (!ids.ok) return ids;
    const found: OsvRecord[] = [];
    for (const id of ids.value) {
      const record = records.get(id);
      if (!record) continue;
      if (!record.ok) return record;
      found.push(record.value);
    }
    return { ok: true, value: found };
  });
}

function fetchVulnerability(
  id: string,
  options: OsvClientOptions,
): Promise<Result<OsvRecord, SourceError>> {
  return withCache(options.cache, `osv:vuln:${id}`, osvRecordSchema, () =>
    options.limit(() =>
      fetchJson(
        `${OSV_API_URL}/vulns/${encodeURIComponent(id)}`,
        osvRecordSchema,
        options.http,
      ),
    ),
  );
}

type QueryEntry = {
  query: OsvQuery;
  result?: Result<string[], SourceError>;
};

/** Vulnerability IDs per package: cached lists first, the rest in batches. */
async function queryIds(
  packages: readonly OsvQuery[],
  options: OsvClientOptions,
): Promise<Result<string[], SourceError>[]> {
  const entries: QueryEntry[] = await Promise.all(
    packages.map(async (query) => {
      const ids = await readCache(options.cache, queryKey(query), idsSchema);
      return ids ? { query, result: { ok: true, value: ids } } : { query };
    }),
  );

  const misses = entries.filter((entry) => !entry.result);
  const batches: QueryEntry[][] = [];
  for (let i = 0; i < misses.length; i += MAX_BATCH_SIZE) {
    batches.push(misses.slice(i, i + MAX_BATCH_SIZE));
  }
  await Promise.all(batches.map((batch) => queryBatch(batch, options)));

  await Promise.all(
    misses.map(async ({ query, result }) => {
      if (result?.ok)
        await writeCache(options.cache, queryKey(query), result.value);
    }),
  );

  return entries.map(
    (entry) =>
      entry.result ?? { ok: false, error: { code: "invalid-response" } },
  );
}

/** Sets `result` on every entry of the batch. */
async function queryBatch(
  batch: readonly QueryEntry[],
  options: OsvClientOptions,
): Promise<void> {
  const items = batch.map((entry) => ({
    entry,
    ids: new Set<string>(),
    pageToken: undefined as string | undefined,
  }));
  const fail = (error: SourceError) => {
    for (const { entry } of items) entry.result = { ok: false, error };
  };

  let pending = items;
  for (let page = 0; pending.length > 0; page++) {
    if (page >= MAX_PAGES) {
      console.error("[sources] osv querybatch: too many pages");
      fail({ code: "invalid-response" });
      return;
    }

    // The next page repeats only the queries that returned a token.
    const body = {
      queries: pending.map(({ entry, pageToken }) => ({
        package: { ecosystem: "npm", name: entry.query.name },
        version: entry.query.version,
        ...(pageToken === undefined ? {} : { page_token: pageToken }),
      })),
    };
    const response = await options.limit(() =>
      fetchJson(`${OSV_API_URL}/querybatch`, batchSchema, {
        ...options.http,
        method: "POST",
        body,
      }),
    );
    if (!response.ok) {
      fail(response.error);
      return;
    }
    // Results are matched to queries by position.
    const { results } = response.value;
    if (results.length !== pending.length) {
      fail({ code: "invalid-response" });
      return;
    }

    pending.forEach((item, i) => {
      const result = results[i];
      for (const vuln of result?.vulns ?? []) item.ids.add(vuln.id);
      item.pageToken = result?.next_page_token;
    });
    pending = pending.filter((item) => item.pageToken !== undefined);
  }

  for (const { entry, ids } of items) {
    entry.result = { ok: true, value: [...ids] };
  }
}

function queryKey({ name, version }: OsvQuery): string {
  return `osv:query:${name}@${version}`;
}
