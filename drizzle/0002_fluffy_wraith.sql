CREATE TABLE "game_table_members" (
	"table_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_table_members_table_id_user_id_pk" PRIMARY KEY("table_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "game_table_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "game_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"invite_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_tables_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
ALTER TABLE "game_tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_table_members" ADD CONSTRAINT "game_table_members_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_table_members" ADD CONSTRAINT "game_table_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_table_members_user_idx" ON "game_table_members" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "game_table_members_select_own" ON "game_table_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth.uid() = "game_table_members"."user_id");--> statement-breakpoint
CREATE POLICY "game_tables_select_member" ON "game_tables" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from game_table_members m where m.table_id = "game_tables"."id" and m.user_id = auth.uid()));