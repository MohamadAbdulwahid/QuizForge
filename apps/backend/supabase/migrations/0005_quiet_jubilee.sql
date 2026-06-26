ALTER TYPE "public"."GAME_MODE" ADD VALUE 'bubbly-royale';--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "br_top_n" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "br_starting_lives" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "br_duel_timer_s" integer DEFAULT 25;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "br_power_bubble_timer_s" integer DEFAULT 15;
