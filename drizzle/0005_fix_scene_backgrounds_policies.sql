-- Bug: dentro do EXISTS, a subconsulta "FROM game_tables g" também tem uma
-- coluna "name" (o nome da mesa). A referência não qualificada
-- storage.foldername(name) era capturada por esse "g.name" em vez de
-- correlacionar com o "name" (caminho do objeto) da linha de storage.objects
-- sendo verificada — a política nunca era satisfeita, nem para o Mestre.
-- Corrige qualificando explicitamente para a tabela externa (objects.name).
DROP POLICY "scene_backgrounds_master_write" ON storage.objects;
DROP POLICY "scene_backgrounds_master_update" ON storage.objects;
DROP POLICY "scene_backgrounds_master_delete" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "scene_backgrounds_master_write" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'scene-backgrounds'
    AND EXISTS (
      SELECT 1 FROM game_tables g
      WHERE g.id::text = (storage.foldername(objects.name))[1]
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
      WHERE g.id::text = (storage.foldername(objects.name))[1]
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
      WHERE g.id::text = (storage.foldername(objects.name))[1]
        AND g.owner_id = auth.uid()
    )
  );
