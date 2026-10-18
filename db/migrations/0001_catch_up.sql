CREATE TABLE "event_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"data" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"token" text NOT NULL,
	"sections" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "branding" jsonb;--> statement-breakpoint
ALTER TABLE "event_assets" ADD CONSTRAINT "event_assets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_shares" ADD CONSTRAINT "analytics_shares_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_assets_event_idx" ON "event_assets" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "analytics_shares_event_idx" ON "analytics_shares" USING btree ("event_id");