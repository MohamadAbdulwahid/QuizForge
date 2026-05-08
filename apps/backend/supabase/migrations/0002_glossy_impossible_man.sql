DELETE FROM "group_member" a
USING "group_member" b
WHERE a."group_id" = b."group_id"
  AND a."user_id" = b."user_id"
  AND a."id" > b."id";
--> statement-breakpoint
CREATE UNIQUE INDEX "group_member_group_id_user_id_unique" ON "group_member" USING btree ("group_id","user_id");
