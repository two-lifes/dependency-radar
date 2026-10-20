ALTER TABLE "checks" ADD COLUMN "retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "lease_until" timestamp with time zone;