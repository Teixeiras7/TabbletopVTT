CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"choices" jsonb NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "characters_table_idx" ON "characters" USING btree ("table_id");--> statement-breakpoint
CREATE POLICY "characters_select_member" ON "characters" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from game_table_members m where m.table_id = "characters"."table_id" and m.user_id = auth.uid()));