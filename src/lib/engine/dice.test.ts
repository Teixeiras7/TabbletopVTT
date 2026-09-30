import { describe, expect, it } from "vitest";
import { rollDie, rollDice } from "./dice";

describe("rollDie", () => {
  it("respeita o resultado da fonte de aleatoriedade injetada", () => {
    expect(rollDie(6, () => 0)).toBe(1);
    expect(rollDie(6, () => 0.999)).toBe(6);
  });

  it("rejeita número de lados inválido", () => {
    expect(() => rollDie(0)).toThrow(RangeError);
    expect(() => rollDie(1.5)).toThrow(RangeError);
  });
});

describe("rollDice", () => {
  it("soma múltiplas rolagens determinísticas", () => {
    const result = rollDice({ sides: 6, count: 3 }, () => 0.5);
    expect(result.rolls).toEqual([4, 4, 4]);
    expect(result.total).toBe(12);
  });

  it("rejeita quantidade de dados inválida", () => {
    expect(() => rollDice({ sides: 6, count: 0 })).toThrow(RangeError);
  });
});
