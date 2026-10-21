"use server";

import { z } from "zod";
import type { Result } from "@/server/analysis/result";
import {
  type PackageDetails,
  toPackageDetails,
} from "@/server/check/package-details";
import { isReportExpired } from "@/server/check/report-view";
import { getDb } from "@/server/db/client";
import { getReportPackage } from "@/server/db/report-page";
import { createPgCache } from "@/server/sources/cache";
import { createLimiter } from "@/server/sources/limiter";
import { fetchNpmPackage } from "@/server/sources/npm";

const inputSchema = z.object({
  reportId: z.uuid(),
  // npm caps names at 214 characters.
  name: z.string().min(1).max(214),
});

export type PackageDetailsError = "not-found" | "unavailable";

/**
 * screens 5.9: description, license, links and the release scale. Only a
 * package the report has a checked result for: the registry name and the
 * versions come from the database, not from the client. After a check the
 * npm document is usually still in the cache.
 */
export async function getPackageDetails(
  reportId: string,
  name: string,
): Promise<Result<PackageDetails, PackageDetailsError>> {
  const input = inputSchema.safeParse({ reportId, name });
  if (!input.success) return { ok: false, error: "not-found" };

  const db = getDb();
  const found = await getReportPackage(
    db,
    input.data.reportId,
    input.data.name,
  );
  const row = found?.row;
  if (
    !found ||
    isReportExpired(found.report.expiresAt, new Date()) ||
    !row?.checked ||
    row.registryName === null ||
    row.current === null ||
    row.latest === null
  ) {
    return { ok: false, error: "not-found" };
  }

  const npm = await fetchNpmPackage(row.registryName, {
    cache: createPgCache(db),
    limit: createLimiter(1),
  });
  if (!npm.ok) return { ok: false, error: "unavailable" };
  return {
    ok: true,
    value: toPackageDetails(npm.value, {
      registryName: row.registryName,
      current: row.current,
      latest: row.latest,
    }),
  };
}
