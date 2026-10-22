import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CheckFailureCode } from "../analysis/check-outcome";
import type { Vulnerability } from "../analysis/merge-vulnerabilities";
import type { LockedPackage } from "../analysis/parse-lockfile";
import type { ManifestDependency } from "../analysis/parse-manifest";
import type { ReportWarning } from "../analysis/report-input";
import type { UncheckedReason } from "../analysis/resolve-versions";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const reportSource = pgEnum("report_source", [
  "paste",
  "upload",
  "github",
]);
export const packageManager = pgEnum("package_manager", [
  "npm",
  "pnpm",
  "yarn",
]);
export const checkStatus = pgEnum("check_status", [
  "running",
  "completed",
  "partial",
  "cancelled",
  "failed",
]);
export const dependencyType = pgEnum("dependency_type", ["prod", "dev"]);
export const lagKind = pgEnum("lag_kind", [
  "current",
  "patch",
  "minor",
  "major",
]);
export const packageStatus = pgEnum("package_status", [
  "active",
  "stale",
  "deprecated",
]);

// Better Auth tables (user, session, account, verification): field names are
// the ones its Drizzle adapter expects; ids are text because Better Auth
// generates them itself.
export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamptz("expires_at").notNull(),
    token: text().notNull().unique(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text(),
    password: text(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

/** Magic link tokens. */
export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("projects_owner_id_idx").on(t.ownerId)],
);

export const reports = pgTable(
  "reports",
  {
    // Random UUID: a guest report is public to anyone who has the link.
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .unique()
      .references(() => projects.id, { onDelete: "cascade" }),
    expiresAt: timestamptz("expires_at"),
    /** From package.json; null is shown as "Untitled project". */
    name: text(),
    source: reportSource().notNull(),
    repoUrl: text("repo_url"),
    dependencies: jsonb().$type<ManifestDependency[]>().notNull(),
    /** Lockfile entries by installed name; null when no lockfile was given. */
    lockedVersions:
      jsonb("locked_versions").$type<Record<string, LockedPackage>>(),
    warnings: jsonb().$type<ReportWarning[]>().notNull().default([]),
    packageManager: packageManager("package_manager").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // A report is either a guest one (expires) or belongs to a project.
    check(
      "reports_guest_or_project",
      sql`(${t.projectId} is null) <> (${t.expiresAt} is null)`,
    ),
    index("reports_expires_at_idx").on(t.expiresAt),
  ],
);

export const checks = pgTable(
  "checks",
  {
    id: uuid().primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    status: checkStatus().notNull().default("running"),
    failureReason: text("failure_reason").$type<CheckFailureCode>(),
    /** When a rate-limited source allows a retry, for "Try again in N minutes". */
    retryAt: timestamptz("retry_at"),
    totalPackages: integer("total_packages").notNull(),
    // The stream that runs the check holds and renews this lease; other
    // streams only follow progress until it expires (runner died on timeout).
    leaseUntil: timestamptz("lease_until"),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    finishedAt: timestamptz("finished_at"),
    // Snapshot taken when the check ends, for dashboard cards and history;
    // the report page recomputes them from check_packages.
    score: integer(),
    vulnerabilityCount: integer("vulnerability_count"),
    /** Packages whose worst vulnerability is critical or high (card colour). */
    severeVulnerableCount: integer("severe_vulnerable_count"),
  },
  (t) => [
    index("checks_report_id_started_at_idx").on(t.reportId, t.startedAt.desc()),
    uniqueIndex("checks_one_running_per_report_idx")
      .on(t.reportId)
      .where(sql`${t.status} = 'running'`),
  ],
);

/** A row exists once the package is processed; Resume checks the rest. */
export const checkPackages = pgTable(
  "check_packages",
  {
    checkId: uuid("check_id")
      .notNull()
      .references(() => checks.id, { onDelete: "cascade" }),
    // Input snapshot, so history survives "Replace source".
    name: text().notNull(),
    type: dependencyType().notNull(),
    specifier: text().notNull(),
    checked: boolean().notNull(),
    reason: text().$type<UncheckedReason>(),
    registryName: text("registry_name"),
    current: text(),
    latest: text(),
    lagKind: lagKind("lag_kind"),
    lagMajors: integer("lag_majors"),
    status: packageStatus(),
    deprecationMessage: text("deprecation_message"),
    lastReleaseAt: timestamptz("last_release_at"),
    vulnerabilities: jsonb().$type<Vulnerability[]>().notNull().default([]),
    checkedAt: timestamptz("checked_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.checkId, t.name] })],
);

export const apiCache = pgTable(
  "api_cache",
  {
    key: text().primaryKey(),
    value: jsonb().notNull(),
    fetchedAt: timestamptz("fetched_at").notNull().defaultNow(),
    expiresAt: timestamptz("expires_at").notNull(),
  },
  (t) => [index("api_cache_expires_at_idx").on(t.expiresAt)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    /** `ip:<address>` for guests, `user:<id>` for signed-in users. */
    subject: text().notNull(),
    windowStart: timestamptz("window_start").notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.subject, t.windowStart] })],
);
