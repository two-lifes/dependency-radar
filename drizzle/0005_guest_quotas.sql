CREATE TABLE "guest_quotas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "guest_quotas_used_check" CHECK ("guest_quotas"."used" between 0 and 3)
);
