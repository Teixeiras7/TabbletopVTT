// Loja: preços de compra e venda (Lista de Preços, pp. 241-245) e a perícia Negociação (pp. 182-183).

/** Sem Negociação: compra pelo preço de tabela, vende itens novos por metade. */
export const DEFAULT_RATES = { buy: 100, sell: 50 };

/** Tabela de compra/venda da Negociação: resultado mínimo → % paga na compra e % recebida na revenda. */
const NEGOTIATION_TABLE = [
  { min: 21, buy: 75, sell: 75 },
  { min: 18, buy: 80, sell: 70 },
  { min: 15, buy: 85, sell: 65 },
  { min: 13, buy: 90, sell: 60 },
  { min: 11, buy: 95, sell: 55 },
] as const;

export function negotiationRates(result: number) {
  return NEGOTIATION_TABLE.find((row) => result >= row.min) ?? DEFAULT_RATES;
}

/** Preço × quantidade × %, com uma casa decimal (decisão do usuário: aceita fração de coroa). */
export function priceWith(price: number, qty: number, percent: number) {
  return Math.round((price * qty * percent) / 10) / 10;
}
