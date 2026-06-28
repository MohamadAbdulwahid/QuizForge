CREATE TYPE "public"."knowledge_relationship_type" AS ENUM('prerequisite', 'related', 'part-of', 'contradicts');--> statement-breakpoint
CREATE TABLE "knowledge_edge" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_edge_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"source_node_id" bigint NOT NULL,
	"target_node_id" bigint NOT NULL,
	"relationship_type" "knowledge_relationship_type" NOT NULL,
	"strength" real DEFAULT 0 NOT NULL,
	"ai_explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_node" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_node_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"quiz_id" bigint NOT NULL,
	"concept_label" text NOT NULL,
	"mastery_score" integer DEFAULT 0 NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"correct_attempts" integer DEFAULT 0 NOT NULL,
	"last_analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_edge" ADD CONSTRAINT "knowledge_edge_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_edge" ADD CONSTRAINT "knowledge_edge_source_node_id_knowledge_node_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."knowledge_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_edge" ADD CONSTRAINT "knowledge_edge_target_node_id_knowledge_node_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."knowledge_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_node" ADD CONSTRAINT "knowledge_node_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_node" ADD CONSTRAINT "knowledge_node_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_edge_user_idx" ON "knowledge_edge" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "knowledge_edge_source_idx" ON "knowledge_edge" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "knowledge_edge_target_idx" ON "knowledge_edge" USING btree ("target_node_id");--> statement-breakpoint
CREATE INDEX "knowledge_node_user_idx" ON "knowledge_node" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "knowledge_node_quiz_idx" ON "knowledge_node" USING btree ("quiz_id");