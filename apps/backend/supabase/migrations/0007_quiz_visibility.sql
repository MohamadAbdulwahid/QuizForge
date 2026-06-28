-- Migration 0007 — adds quiz visibility, status, play_count + discover feed index
CREATE TYPE "public"."quiz_visibility" AS ENUM('private', 'unlisted', 'public');
--> statement-breakpoint
CREATE TYPE "public"."quiz_status" AS ENUM('draft', 'published');
--> statement-breakpoint
ALTER TABLE "quiz" ADD COLUMN "visibility" "quiz_visibility" DEFAULT 'unlisted' NOT NULL;
--> statement-breakpoint
ALTER TABLE "quiz" ADD COLUMN "status" "quiz_status" DEFAULT 'published' NOT NULL;
--> statement-breakpoint
ALTER TABLE "quiz" ADD COLUMN "play_count" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX "quiz_discover_feed_idx" ON "quiz" USING btree ("status", "visibility", "created_at" DESC);
--> statement-breakpoint
UPDATE "quiz" SET "visibility" = 'public' WHERE "visibility" IS NULL;
--> statement-breakpoint
UPDATE "quiz" SET "status" = 'published' WHERE "status" IS NULL;
