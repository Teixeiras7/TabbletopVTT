CREATE POLICY "characters_select_owner_or_master" ON "characters" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("characters"."owner_id" = auth.uid() or exists (select 1 from game_tables g where g.id = "characters"."table_id" and g.owner_id = auth.uid()));
--> statement-breakpoint
-- Storage: imagem do personagem. Caminho = "<table_id>/<character_id>/image" (sobrescrito a cada troca).
-- Bucket público como o das infos e do fundo do mapa: o endereço só é entregue a quem pode ver o
-- dossiê. Escrever: o dono do personagem ou o Mestre da mesa. Atenção ao "objects.name" qualificado
-- (sem isso "name" é capturado pela tabela da subconsulta; bug da migration 0004).
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-images', 'character-images', true)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE POLICY "character_images_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'character-images');
--> statement-breakpoint
CREATE POLICY "character_images_write" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'character-images'
    AND EXISTS (
      SELECT 1 FROM characters c JOIN game_tables g ON g.id = c.table_id
      WHERE g.id::text = (storage.foldername(objects.name))[1]
        AND c.id::text = (storage.foldername(objects.name))[2]
        AND (c.owner_id = auth.uid() OR g.owner_id = auth.uid())
    )
  );
--> statement-breakpoint
CREATE POLICY "character_images_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'character-images'
    AND EXISTS (
      SELECT 1 FROM characters c JOIN game_tables g ON g.id = c.table_id
      WHERE g.id::text = (storage.foldername(objects.name))[1]
        AND c.id::text = (storage.foldername(objects.name))[2]
        AND (c.owner_id = auth.uid() OR g.owner_id = auth.uid())
    )
  );
--> statement-breakpoint
CREATE POLICY "character_images_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'character-images'
    AND EXISTS (
      SELECT 1 FROM characters c JOIN game_tables g ON g.id = c.table_id
      WHERE g.id::text = (storage.foldername(objects.name))[1]
        AND c.id::text = (storage.foldername(objects.name))[2]
        AND (c.owner_id = auth.uid() OR g.owner_id = auth.uid())
    )
  );
