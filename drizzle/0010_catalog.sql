CREATE TYPE "public"."catalog_kind" AS ENUM('race', 'archetype', 'career', 'skill', 'ability', 'spell', 'spell_list', 'connection', 'progression');--> statement-breakpoint
CREATE TABLE "catalog_entries" (
	"kind" "catalog_kind" NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "catalog_entries_kind_slug_pk" PRIMARY KEY("kind","slug")
);
--> statement-breakpoint
ALTER TABLE "catalog_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "catalog_entries_select_all" ON "catalog_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);