ALTER TYPE "public"."catalog_kind" ADD VALUE 'action' BEFORE 'progression';--> statement-breakpoint
CREATE TABLE "character_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "state" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "character_notes" ADD CONSTRAINT "character_notes_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_notes_character_idx" ON "character_notes" USING btree ("character_id");--> statement-breakpoint
DROP POLICY "characters_select_member" ON "characters" CASCADE;--> statement-breakpoint
CREATE POLICY "character_notes_select_owner_or_master" ON "character_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from characters c join game_tables g on g.id = c.table_id where c.id = "character_notes"."character_id" and (c.owner_id = auth.uid() or g.owner_id = auth.uid())));