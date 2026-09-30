ALTER TABLE "scenes" ADD COLUMN "background_url" text;--> statement-breakpoint
CREATE POLICY "scenes_update_master" ON "scenes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from game_tables g where g.id = "scenes"."table_id" and g.owner_id = auth.uid()));
--> statement-breakpoint
-- Realtime: tamanho do grid e imagem de fundo precisam aparecer ao vivo
-- para quem já está com a mesa aberta, igual os tokens (etapa 7).
ALTER TABLE "scenes" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION supabase_realtime ADD TABLE "scenes";
--> statement-breakpoint
-- Storage: bucket público para a imagem de fundo do grid. Público porque a
-- imagem em si não é sensível (é o mapa da mesa) e simplifica servir a URL
-- direto, sem gerar link assinado; upload/troca continuam restritos ao
-- Mestre pelas políticas abaixo. Caminho do objeto = "<table_id>/background"
-- (sem extensão, sobrescrito a cada troca — "um ou nenhum", nunca vários).
INSERT INTO storage.buckets (id, name, public)
VALUES ('scene-backgrounds', 'scene-backgrounds', true)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE POLICY "scene_backgrounds_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'scene-backgrounds');
--> statement-breakpoint
CREATE POLICY "scene_backgrounds_master_write" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'scene-backgrounds'
    AND EXISTS (
      SELECT 1 FROM game_tables g
      WHERE g.id::text = (storage.foldername(name))[1]
        AND g.owner_id = auth.uid()
    )
  );
--> statement-breakpoint
CREATE POLICY "scene_backgrounds_master_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'scene-backgrounds'
    AND EXISTS (
      SELECT 1 FROM game_tables g
      WHERE g.id::text = (storage.foldername(name))[1]
        AND g.owner_id = auth.uid()
    )
  );
--> statement-breakpoint
CREATE POLICY "scene_backgrounds_master_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'scene-backgrounds'
    AND EXISTS (
      SELECT 1 FROM game_tables g
      WHERE g.id::text = (storage.foldername(name))[1]
        AND g.owner_id = auth.uid()
    )
  );