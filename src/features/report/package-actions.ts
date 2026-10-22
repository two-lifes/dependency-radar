"use server";

import { z } from "zod";
import type { Result } from "@/server/analysis/result";
import {
  type PackageDetails,
  toPackageDetails,
} from "@/server/check/package-details";
import {
  type ReleaseNotesView,
  releasesRepo,
  toReleaseNotesView,
} from "@/server/check/release-notes";
import { isReportExpired } from "@/server/check/report-view";
import { getDb } from "@/server/db/client";
import { getReportPackage } from "@/server/db/report-page";
import { canOpenReport } from "@/server/report-access";
import { type Cache, createPgCache } from "@/server/sources/cache";
import { fetchReleases } from "@/server/sources/github";
import { createLimiter } from "@/server/sources/limiter";
import { fetchNpmPackage, type NpmPackageInfo } from "@/server/sources/npm";

const inputSchema = z.object({
  reportId: z.uuid(),
  // npm caps names at 214 characters.
  name: z.string().min(1).max(214),
});

export type PackageDetailsError = "not-found" | "unavailable";

type Target = { registryName: string; current: string; latest: string };

/**
 * Only a package the report has a checked result for: the registry name and
 * the versions come from the database, not from the client. After a check
 * the npm document is usually still in the cache.
 */
async function loadCheckedPackage(
  reportId: string,
  name: string,
): Promise<
  Result<
    { target: Target; info: NpmPackageInfo; cache: Cache },
    PackageDetailsError
  >
> {
  const input = inputSchema.safeParse({ reportId, name });
  if (!input.success) return { ok: false, error: "not-found" };

  const db = getDb();
  const found = await getReportPackage(
    db,
    input.data.reportId,
    input.data.name,
  );
  const row = found?.row;
  if (!found || !(await canOpenReport(found.report))) {
    return { ok: false, error: "not-found" };
  }
  if (
    isReportExpired(found.report.expiresAt, new Date()) ||
    !row?.checked ||
    row.registryName === null ||
    row.current === null ||
    row.latest === null
  ) {
    return { ok: false, error: "not-found" };
  }

  const cache = createPgCache(db);
  const npm = await fetchNpmPackage(row.registryName, {
    cache,
    limit: createLimiter(1),
  });
  if (!npm.ok) return { ok: false, error: "unavailable" };
  return {
    ok: true,
    value: {
      target: {
        registryName: row.registryName,
        current: row.current,
        latest: row.latest,
      },
      info: npm.value,
      cache,
    },
  };
}

/** screens 5.9: description, license, links and the release scale. */
export async function getPackageDetails(
  reportId: string,
  name: string,
): Promise<Result<PackageDetails, PackageDetailsError>> {
  const loaded = await loadCheckedPackage(reportId, name);
  if (!loaded.ok) return loaded;
  const { info, target } = loaded.value;
  return { ok: true, value: toPackageDetails(info, target) };
}

/**
 * screens 5.9: release notes from GitHub, loaded only when the card opens
 * (decisions 37). A failure here leaves the rest of the card working.
 */
export async function getReleaseNotes(
  reportId: string,
  name: string,
): Promise<Result<ReleaseNotesView, PackageDetailsError>> {
  const loaded = await loadCheckedPackage(reportId, name);
  if (!loaded.ok) return loaded;
  const { info, target, cache } = loaded.value;

  const repo = releasesRepo(info);
  if (repo === null) {
    return { ok: true, value: toReleaseNotesView(info, [], target) };
  }
  const releases = await fetchReleases(repo, {
    cache,
    limit: createLimiter(1),
    token: process.env.GITHUB_TOKEN,
  });
  if (!releases.ok) {
    // A renamed, deleted or private repository publishes nothing we can read:
    // that is "no release notes", not a failure to retry.
    if (releases.error.code !== "not-found") {
      return { ok: false, error: "unavailable" };
    }
    return { ok: true, value: toReleaseNotesView(info, [], target) };
  }
  return {
    ok: true,
    value: toReleaseNotesView(info, releases.value, target),
  };
}
