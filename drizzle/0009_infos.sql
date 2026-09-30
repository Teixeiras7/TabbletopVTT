CREATE TYPE "public"."info_kind" AS ENUM('image', 'note');--> statement-breakpoint
CREATE TABLE "infos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"kind" "info_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"created_by" uuid NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "infos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "infos" ADD CONSTRAINT "infos_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infos" ADD CONSTRAINT "infos_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "infos_table_idx" ON "infos" USING btree ("table_id");--> statement-breakpoint
CREATE POLICY "infos_select_visible" ON "infos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from game_table_members m where m.table_id = "infos"."table_id" and m.user_id = auth.uid())
        and (not "infos"."hidden" or exists (select 1 from game_tables g where g.id = "infos"."table_id" and g.owner_id = auth.uid())));
--> statement-breakpoint
-- Storage: imagens das infos. Caminho do objeto = "<table_id>/<info_id>" (sem
-- extensão; trocar a imagem sobrescreve). Bucket público como o do fundo do
-- mapa: o endereço só é enviado a quem pode ver a info (a oculta nunca chega
-- ao jogador) e contém um uuid impossível de adivinhar. Escrever é só do
-- Mestre. Atenção: "objects.name" qualificado — sem isso "name" é capturado
-- por game_tables.name dentro do EXISTS (bug da migration 0004, corrigido na 0005).
INSERT INTO storage.buckets (id, name, public)
VALUES ('info-images', 'info-images', true)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE POLICY "info_images_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'info-images');
--> statement-breakpoint
CREATE POLICY "info_images_master_write" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'info-images'
    AND EXISTS (
      SELECT 1 FROM game_tables g
      WHERE g.id::text = (storage.foldername(objects.name))[1]
        AND g.owner_id = auth.uid()
    )
  );
--> statement-breakpoint
CREATE POLICY "info_images_master_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'info-images'
    AND EXISTS (
      SELECT 1 FROM game_tables g
      WHERE g.id::text = (storage.foldername(objects.name))[1]
        AND g.owner_id = auth.uid()
    )
  );
--> statement-breakpoint
CREATE POLICY "info_images_master_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'info-images'
    AND EXISTS (
      SELECT 1 FROM game_tables g
      WHERE g.id::text = (storage.foldername(objects.name))[1]
        AND g.owner_id = auth.uid()
    )
  );