-- Desfaz a 0007: tokens.x / tokens.y voltam a ser a casa do grid (0 = primeira),
-- porque o token deve continuar na casa e acompanhar o tamanho do quadrado.
-- Converte de pixels para casas pela escala da cena; LEAST mantém dentro do mapa.
UPDATE tokens t
SET x = LEAST(t.x / s.grid_size, 1440 / s.grid_size - 1),
    y = LEAST(t.y / s.grid_size, 1440 / s.grid_size - 1)
FROM scenes s
WHERE s.id = t.scene_id;
