ALTER TYPE "public"."question_type" ADD VALUE 'ordering';--> statement-breakpoint
ALTER TYPE "public"."question_type" ADD VALUE 'matching';--> statement-breakpoint
ALTER TYPE "public"."question_type" ADD VALUE 'fill-in-blank';--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "tf_end_mode" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "tf_timer_minutes" integer;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "tf_gold_goal" integer;