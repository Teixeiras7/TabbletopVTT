-- tokens.x / tokens.y passam de "casa do grid" para pixels do mapa (centro do
-- token), para o token continuar no mesmo ponto quando o tamanho do quadrado
-- muda. Converte os existentes pelo tamanho de quadrado da cena; LEAST evita
-- passar da borda do mapa (1440 px) se o quadrado era grande.
UPDATE tokens t
SET x = LEAST(1440, t.x * s.grid_size + s.grid_size / 2),
    y = LEAST(1440, t.y * s.grid_size + s.grid_size / 2)
FROM scenes s
WHERE s.id = t.scene_id;
