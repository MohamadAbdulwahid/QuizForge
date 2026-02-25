CREATE TYPE "public"."question_type" AS ENUM('multiple-choice', 'true-false', 'open');--> statement-breakpoint
CREATE TYPE "public"."PLAYER_STATUS" AS ENUM('active', 'disconnected', 'eliminated');--> statement-breakpoint
CREATE TYPE "public"."SESSION_STATUS" AS ENUM('pending', 'waiting', 'in-progress', 'ended');--> statement-breakpoint
CREATE TABLE "question" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"quiz_id" bigint NOT NULL,
	"text" text NOT NULL,
	"type" "question_type" NOT NULL,
	"options" jsonb NOT NULL,
	"correct_answer" text,
	"time_limit" bigint,
	"points" bigint DEFAULT 0 NOT NULL,
	"order_index" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text,
	"creator_id" uuid NOT NULL,
	"share_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" bigint NOT NULL,
	"session_player_id" bigint,
	"event_type" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "session_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"quiz_id" bigint NOT NULL,
	"pin" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"host_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_player" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "session_player_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"username" text NOT NULL,
	"score" bigint DEFAULT 0 NOT NULL,
	"lives" bigint,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_event" ADD CONSTRAINT "game_event_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_event" ADD CONSTRAINT "game_event_session_player_id_session_player_id_fk" FOREIGN KEY ("session_player_id") REFERENCES "public"."session_player"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_player" ADD CONSTRAINT "session_player_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_player" ADD CONSTRAINT "session_player_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;