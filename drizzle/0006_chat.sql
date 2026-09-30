CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_table_members" ADD COLUMN "chat_cleared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_table_created_idx" ON "chat_messages" USING btree ("table_id","created_at");--> statement-breakpoint
CREATE POLICY "chat_messages_select_member" ON "chat_messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from game_table_members m where m.table_id = "chat_messages"."table_id" and m.user_id = auth.uid()));
--> statement-breakpoint
-- Realtime: o cliente recebe INSERT (mensagem nova) e DELETE (Mestre limpou tudo).
ALTER TABLE "chat_messages" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION supabase_realtime ADD TABLE "chat_messages";