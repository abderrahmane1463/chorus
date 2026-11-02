ALTER TABLE "events" ADD COLUMN "settings" jsonb;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "consented_at" timestamp with time zone;