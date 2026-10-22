ALTER TABLE "projects" ADD COLUMN "demo_session_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_demo_session_id_session_id_fk" FOREIGN KEY ("demo_session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_demo_session_id_idx" ON "projects" USING btree ("demo_session_id");