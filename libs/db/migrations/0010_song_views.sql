CREATE TABLE "song_views" (
	"user_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "song_views_pkey" PRIMARY KEY("user_id","song_id")
);
--> statement-breakpoint
ALTER TABLE "song_views" ADD CONSTRAINT "song_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_views" ADD CONSTRAINT "song_views_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_song_views_user_viewed_at" ON "song_views" USING btree ("user_id","viewed_at" DESC NULLS LAST);