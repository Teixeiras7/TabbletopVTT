CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"name" text DEFAULT 'Mesa' NOT NULL,
	"grid_size" integer DEFAULT 40 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scenes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "scenes_select_member" ON "scenes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from game_table_members m where m.table_id = "scenes"."table_id" and m.user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "tokens_select_member" ON "tokens" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from scenes s
        join game_table_members m on m.table_id = s.table_id
        where s.id = "tokens"."scene_id" and m.user_id = auth.uid()
      ));
--> statement-breakpoint
-- Realtime (Supabase): sem isso o cliente não recebe INSERT/UPDATE/DELETE
-- de tokens. REPLICA IDENTITY FULL garante que o payload de DELETE traga
-- scene_id (o padrão só inclui a chave primária), necessário para o
-- cliente saber de qual cena o token removido era.
ALTER TABLE "tokens" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION supabase_realtime ADD TABLE "tokens";