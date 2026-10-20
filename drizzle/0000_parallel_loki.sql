CREATE TYPE "public"."check_status" AS ENUM('running', 'completed', 'partial', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."dependency_type" AS ENUM('prod', 'dev');--> statement-breakpoint
CREATE TYPE "public"."lag_kind" AS ENUM('current', 'patch', 'minor', 'major');--> statement-breakpoint
CREATE TYPE "public"."package_manager" AS ENUM('npm', 'pnpm', 'yarn');--> statement-breakpoint
CREATE TYPE "public"."package_status" AS ENUM('active', 'stale', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."report_source" AS ENUM('paste', 'upload', 'github');--> statement-breakpoint
CREATE TABLE "api_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_packages" (
	"check_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "dependency_type" NOT NULL,
	"specifier" text NOT NULL,
	"checked" boolean NOT NULL,
	"reason" text,
	"registry_name" text,
	"current" text,
	"latest" text,
	"lag_kind" "lag_kind",
	"lag_majors" integer,
	"status" "package_status",
	"deprecation_message" text,
	"last_release_at" timestamp with time zone,
	"vulnerabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_packages_check_id_name_pk" PRIMARY KEY("check_id","name")
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"status" "check_status" DEFAULT 'running' NOT NULL,
	"failure_reason" text,
	"total_packages" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"score" integer,
	"vulnerability_count" integer
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"subject" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_subject_window_start_pk" PRIMARY KEY("subject","window_start")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"expires_at" timestamp with time zone,
	"name" text,
	"source" "report_source" NOT NULL,
	"repo_url" text,
	"dependencies" jsonb NOT NULL,
	"locked_versions" jsonb,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"package_manager" "package_manager" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "reports_guest_or_project" CHECK (("reports"."project_id" is null) <> ("reports"."expires_at" is null))
);
--> statement-breakpoint
ALTER TABLE "check_packages" ADD CONSTRAINT "check_packages_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_cache_expires_at_idx" ON "api_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "checks_report_id_started_at_idx" ON "checks" USING btree ("report_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "checks_one_running_per_report_idx" ON "checks" USING btree ("report_id") WHERE "checks"."status" = 'running';--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "reports_expires_at_idx" ON "reports" USING btree ("expires_at");