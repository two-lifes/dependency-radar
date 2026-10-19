import semver from "semver";
import type { OsvEvent, OsvRecord } from "./osv-record";
import {
  compareSeverity,
  maxSeverity,
  recordSeverity,
  type Severity,
} from "./severity";

/**
 * One vulnerability after merging OSV records linked through `aliases`
 * (spec 7.3). Score, counters, table and package card all use this list.
 */
export type Vulnerability = {
  /** Every ID of the merged records and their aliases: GHSA, CVE, then others. */
  ids: string[];
  primaryId: string;
  severity: Severity;
  summary?: string;
  details?: string;
  /** Lowest version fixed by every merged record; null = "No fix available". */
  fixedIn: string | null;
};

export function mergeVulnerabilities(
  records: readonly OsvRecord[],
  target: { packageName: string; currentVersion: string },
): Vulnerability[] {
  const active = records.filter((record) => record.withdrawn === undefined);

  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.has(root) && parent.get(root) !== root) {
      root = parent.get(root) ?? root;
    }
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  for (const record of active) {
    find(record.id);
    for (const alias of record.aliases ?? []) union(record.id, alias);
  }

  const groups = new Map<string, OsvRecord[]>();
  for (const record of active) {
    const root = find(record.id);
    groups.set(root, [...(groups.get(root) ?? []), record]);
  }

  const vulnerabilities = [...groups.values()].map((group) =>
    toVulnerability(group, target),
  );
  return vulnerabilities.sort(
    (a, b) =>
      compareSeverity(a.severity, b.severity) ||
      compareIds(a.primaryId, b.primaryId),
  );
}

function toVulnerability(
  group: OsvRecord[],
  target: { packageName: string; currentVersion: string },
): Vulnerability {
  const ids = [
    ...new Set(
      group.flatMap((record) => [record.id, ...(record.aliases ?? [])]),
    ),
  ].sort(compareIds);
  const ordered = [...group].sort((a, b) => compareIds(a.id, b.id));
  const summary = ordered.find((record) => record.summary)?.summary;
  const details = ordered.find((record) => record.details)?.details;
  // Group is never empty, so neither are ids nor the severity list.
  const primaryId = ids[0] ?? group[0]?.id ?? "";

  return {
    ids,
    primaryId,
    severity: maxSeverity(group.map(recordSeverity)) ?? "moderate",
    ...(summary !== undefined && { summary }),
    ...(details !== undefined && { details }),
    fixedIn: findFixedIn(group, target),
  };
}

const ID_PREFIX_ORDER = ["GHSA-", "CVE-"];

function compareIds(a: string, b: string): number {
  const rank = (id: string) => {
    const index = ID_PREFIX_ORDER.findIndex((prefix) => id.startsWith(prefix));
    return index === -1 ? ID_PREFIX_ORDER.length : index;
  };
  return rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0);
}

/**
 * spec 7.3: not the minimum of the records' fixes, but the lowest fix that
 * leaves every merged record unaffected. Candidates come only from `fixed`
 * events: a version we know was released as a fix.
 */
function findFixedIn(
  group: OsvRecord[],
  target: { packageName: string; currentVersion: string },
): string | null {
  const affected = group.map((record) => affectedEntries(record, target));
  const candidates = affected
    .flat()
    .flatMap((entry) => entry.ranges.flat())
    .flatMap((event) => (event.fixed !== undefined ? [event.fixed] : []))
    .filter(
      (version) =>
        semver.valid(version) !== null &&
        semver.gt(version, target.currentVersion),
    )
    .sort(semver.compare);

  for (const candidate of candidates) {
    if (affected.every((entries) => !isAffected(entries, candidate))) {
      return candidate;
    }
  }
  return null;
}

type AffectedEntry = { ranges: OsvEvent[][]; versions: string[] };

function affectedEntries(
  record: OsvRecord,
  target: { packageName: string },
): AffectedEntry[] {
  return (record.affected ?? [])
    .filter(
      (entry) =>
        entry.package?.ecosystem === "npm" &&
        entry.package.name === target.packageName,
    )
    .map((entry) => ({
      // GIT ranges hold commit hashes, not versions.
      ranges: (entry.ranges ?? [])
        .filter(
          (range) => range.type === "SEMVER" || range.type === "ECOSYSTEM",
        )
        .map((range) => range.events),
      versions: entry.versions ?? [],
    }));
}

function isAffected(entries: AffectedEntry[], version: string): boolean {
  return entries.some(
    (entry) =>
      entry.versions.includes(version) ||
      entry.ranges.some((events) => inRange(events, version)),
  );
}

// OSV range evaluation: walk events in version order; the last one at or
// below the version decides.
type EventPoint = {
  at: string;
  kind: "introduced" | "fixed" | "last_affected";
};

function inRange(events: OsvEvent[], version: string): boolean {
  const points = events
    .flatMap((event): EventPoint[] => {
      if (event.introduced !== undefined) {
        return [{ at: event.introduced, kind: "introduced" }];
      }
      if (event.fixed !== undefined) {
        return [{ at: event.fixed, kind: "fixed" }];
      }
      if (event.last_affected !== undefined) {
        return [{ at: event.last_affected, kind: "last_affected" }];
      }
      return [];
    })
    .filter((point) => point.at === "0" || semver.valid(point.at) !== null)
    .sort((a, b) => compareEventVersions(a.at, b.at));

  let affected = false;
  for (const point of points) {
    if (point.kind === "introduced") {
      if (point.at === "0" || semver.gte(version, point.at)) affected = true;
    } else if (point.kind === "fixed") {
      if (semver.gte(version, point.at)) affected = false;
    } else if (semver.gt(version, point.at)) {
      affected = false;
    }
  }
  return affected;
}

// "0" in `introduced` means "since the first version".
function compareEventVersions(a: string, b: string): number {
  if (a === "0") return b === "0" ? 0 : -1;
  if (b === "0") return 1;
  return semver.compare(a, b);
}
