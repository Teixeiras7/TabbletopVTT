/**
 * Tipos de domínio do RPGSystemEngine.
 *
 * As regras reais de Reinos de Ferro (fórmulas de teste, dano, progressão)
 * ainda não foram documentadas em docs/regras-rpg.md — por isso este
 * arquivo contém apenas o que é genérico o suficiente para não depender
 * dessas regras (rolagem de dados). Tipos de domínio (Character,
 * CreatureInstance, Effect, Action...) entram aqui quando as regras forem
 * analisadas, para não supor nada que o manual não confirme.
 */

export interface DiceRoll {
  sides: number;
  count: number;
}

export interface DiceRollResult {
  rolls: number[];
  total: number;
}
