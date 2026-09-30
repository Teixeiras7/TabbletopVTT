import type { DiceRoll, DiceRollResult } from "./types";

/**
 * Função de aleatoriedade injetável para permitir testes determinísticos.
 * Nunca importar/chamar `Math.random` diretamente fora daqui.
 */
export type RandomSource = () => number;

const defaultRandom: RandomSource = Math.random;

export function rollDie(sides: number, random: RandomSource = defaultRandom): number {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new RangeError(`Número de lados inválido: ${sides}`);
  }
  return Math.floor(random() * sides) + 1;
}

export function rollDice(
  { sides, count }: DiceRoll,
  random: RandomSource = defaultRandom,
): DiceRollResult {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`Número de dados inválido: ${count}`);
  }

  const rolls = Array.from({ length: count }, () => rollDie(sides, random));
  return { rolls, total: rolls.reduce((sum, roll) => sum + roll, 0) };
}
