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

/** Posição em GRID_SIZES do tamanho mais próximo (um valor antigo fora da lista ainda aparece no controle). */
export function nearestGridSizeIndex(size: number) {
  let best = 0;
  GRID_SIZES.forEach((candidate, index) => {
    if (Math.abs(candidate - size) < Math.abs((GRID_SIZES[best] ?? candidate) - size)) best = index;
  });
  return best;
}

/** Tipo do arrasto da lista de Fichas para o mapa (o dado é o id do personagem). */
export const CHARACTER_DRAG_TYPE = "application/x-personagem";

/** Evento da página: algo do mapa mudou as fichas (ex.: no combate, as ações do personagem da vez zeram). */
export const SHEETS_CHANGED_EVENT = "vtt:fichas-mudaram";
/** O mesmo aviso para as janelas separadas da ficha (BroadcastChannel do navegador, mesmo site). */
export const SHEETS_CHANNEL = "vtt-fichas";
