CREATE TYPE "public"."GAME_MODE" AS ENUM('forge-classic', 'treasure-forge');--> statement-breakpoint
CREATE TABLE "chest_pick" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chest_pick_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" bigint NOT NULL,
	"session_player_id" bigint NOT NULL,
	"round_number" bigint NOT NULL,
	"outcome_type" text NOT NULL,
	"outcome_value" bigint,
	"gold_delta" bigint DEFAULT 0 NOT NULL,
	"target_player_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "game_mode" "GAME_MODE" DEFAULT 'forge-classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "chest_pick" ADD CONSTRAINT "chest_pick_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chest_pick" ADD CONSTRAINT "chest_pick_session_player_id_session_player_id_fk" FOREIGN KEY ("session_player_id") REFERENCES "public"."session_player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chest_pick" ADD CONSTRAINT "chest_pick_target_player_id_session_player_id_fk" FOREIGN KEY ("target_player_id") REFERENCES "public"."session_player"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chest_pick_session_idx" ON "chest_pick" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chest_pick_player_idx" ON "chest_pick" USING btree ("session_player_id");--> statement-breakpoint
CREATE INDEX "chest_pick_round_idx" ON "chest_pick" USING btree ("session_id","round_number");--> statement-breakpoint
CREATE INDEX "group_creator_idx" ON "group" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "group_discoverable_idx" ON "group" USING btree ("is_discoverable");--> statement-breakpoint
CREATE INDEX "invite_user_idx" ON "group_invite" USING btree ("invited_user_id");--> statement-breakpoint
CREATE INDEX "join_request_group_idx" ON "group_join_request" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_member_user_idx" ON "group_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "question_quiz_idx" ON "question" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "quiz_creator_idx" ON "quiz" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "quiz_share_code_idx" ON "quiz" USING btree ("share_code");--> statement-breakpoint
CREATE INDEX "game_event_session_idx" ON "game_event" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_pin_idx" ON "session" USING btree ("pin");--> statement-breakpoint
CREATE INDEX "session_status_idx" ON "session" USING btree ("status");--> statement-breakpoint
CREATE INDEX "session_host_idx" ON "session" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "session_player_session_idx" ON "session_player" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_player_user_idx" ON "session_player" USING btree ("user_id");