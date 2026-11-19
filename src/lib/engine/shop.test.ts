import { describe, expect, it } from "vitest";
import { DEFAULT_RATES, negotiationRates, priceWith } from "./shop";

describe("Loja e Negociação (pp. 182-183)", () => {
  it("tabela de compra/revenda pelo resultado", () => {
    expect(negotiationRates(10)).toEqual(DEFAULT_RATES);
    expect(negotiationRates(11)).toMatchObject({ buy: 95, sell: 55 });
    expect(negotiationRates(14)).toMatchObject({ buy: 90, sell: 60 });
    expect(negotiationRates(17)).toMatchObject({ buy: 85, sell: 65 });
    expect(negotiationRates(20)).toMatchObject({ buy: 80, sell: 70 });
    expect(negotiationRates(25)).toMatchObject({ buy: 75, sell: 75 });
  });

  it("preço com uma casa decimal", () => {
    expect(priceWith(5, 1, 50)).toBe(2.5);
    expect(priceWith(15, 1, 95)).toBe(14.3);
    expect(priceWith(20, 3, 100)).toBe(60);
  });
});
