CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_pkey" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "registration_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"label" text NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_sessions_token_key" UNIQUE("token"),
	CONSTRAINT "registration_sessions_window_check" CHECK ("registration_sessions"."closes_at" > "registration_sessions"."opens_at")
);
--> statement-breakpoint
ALTER TABLE "pre_members" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "registration_sessions" ADD CONSTRAINT "registration_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_sessions" ADD CONSTRAINT "registration_sessions_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rate_limits_window_start" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "idx_registration_sessions_opens_at" ON "registration_sessions" USING btree ("opens_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "pre_members" ADD CONSTRAINT "pre_members_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."registration_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pre_members_session_id" ON "pre_members" USING btree ("session_id");