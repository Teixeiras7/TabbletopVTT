/** Lado do mapa em pixels. Fixo: mudar o tamanho do quadrado só muda quantas casas cabem, nunca o espaço. */
export const MAP_SIZE = 1440;

// Só tamanhos que dividem MAP_SIZE exatamente (16 a 160 px), para o mapa
// fechar sem uma casa cortada na borda.
export const GRID_SIZES = [16, 18, 20, 24, 30, 32, 36, 40, 45, 48, 60, 72, 80, 90, 96, 120, 144, 160] as const;

// 4 MB porque na Vercel o corpo de uma requisição a uma função é limitado a
// ~4,5 MB. Fica aqui (e não em schemas.ts) porque o painel, no navegador,
// também usa — e schemas.ts importa código que só roda no servidor.
export const MAX_BACKGROUND_BYTES = 4 * 1024 * 1024;
export const BACKGROUND_TOO_BIG_MESSAGE = `Imagem muito grande (máximo ${MAX_BACKGROUND_BYTES / 1024 / 1024} MB).`;

export function cellsPerSide(cellSize: number) {
  return Math.floor(MAP_SIZE / cellSize);
}

/** Maior número de casas por lado (com o menor quadrado): limite das coordenadas de token. */
export const MAX_CELLS = cellsPerSide(GRID_SIZES[0]);

/** Mantém a casa dentro do mapa: token guardado numa casa que deixou de existir (quadrado maior) aparece na última. */
export function clampCell(cell: number, cellSize: number) {
  return Math.max(0, Math.min(cellsPerSide(cellSize) - 1, cell));
}

/** Casa (0, 1, 2…) que contém o ponto `px`, sempre dentro do mapa. */
export function cellAt(px: number, cellSize: number) {
  return clampCell(Math.floor(px / cellSize), cellSize);
}

/** Centro da casa em pixels; o token é desenhado aqui, então acompanha o tamanho do quadrado. */
export function cellCenter(cell: number, cellSize: number) {
  return clampCell(cell, cellSize) * cellSize + cellSize / 2;
}

/** Posição em GRID_SIZES do tamanho mais próximo (um valor antigo fora da lista ainda aparece no controle). */
export function nearestGridSizeIndex(size: number) {
  let best = 0;
  GRID_SIZES.forEach((candidate, index) => {
    if (Math.abs(candidate - size) < Math.abs((GRID_SIZES[best] ?? candidate) - size)) best = index;
  });
  return best;
}
