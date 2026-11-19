/** Tipos genéricos do engine (rolagem de dados). As regras do jogo ficam em character.ts e shop.ts. */

export interface DiceRoll {
  sides: number;
  count: number;
}

export interface DiceRollResult {
  rolls: number[];
  total: number;
}
