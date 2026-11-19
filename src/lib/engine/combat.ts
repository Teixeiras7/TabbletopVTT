// Rodadas e iniciativa (livro, pp. 197-198): cada um rola 2d6 + Iniciativa no início da batalha; empate rola de novo;
// a ordem é fixa, do maior para o menor; quem entra no meio rola no início da rodada seguinte e é inserido.
import { rollDice, type RandomSource } from "./dice";

export type Initiative = { characterId: string; name: string; rolls: number[]; bonus: number; total: number };
export type CombatState = { round: number; turn: number; order: Initiative[] };

/** Rola a iniciativa de todos; empatados rolam de novo até desempatar. Devolve em ordem (maior primeiro). */
export function rollInitiative(entries: { characterId: string; name: string; bonus: number }[], random?: RandomSource): Initiative[] {
  const roll = (e: (typeof entries)[number]): Initiative => {
    const r = rollDice({ sides: 6, count: 2 }, random);
    return { ...e, rolls: r.rolls, total: r.total + e.bonus };
  };
  let result = entries.map(roll);
  for (let guard = 0; guard < 50; guard++) {
    const counts = new Map<number, number>();
    for (const i of result) counts.set(i.total, (counts.get(i.total) ?? 0) + 1);
    if ([...counts.values()].every((n) => n === 1)) break;
    result = result.map((i) => ((counts.get(i.total) ?? 0) > 1 ? roll(i) : i));
  }
  return result.sort((a, b) => b.total - a.total);
}

/** Insere quem entrou no meio, cada um na posição do seu total (a ordem dos demais não muda). */
function insert(order: Initiative[], joining: Initiative[]) {
  const out = [...order];
  for (const j of joining) {
    const at = out.findIndex((i) => i.total < j.total);
    out.splice(at === -1 ? out.length : at, 0, j);
  }
  return out;
}

/**
 * Passa para o próximo turno. `onMap`: quem ainda está no mapa (quem saiu deixa a ordem). Ao virar a rodada, entra
 * quem chegou no meio (`joining`, já rolado).
 */
export function nextTurn(state: CombatState, onMap: Set<string>, joining: Initiative[]): CombatState {
  const order = state.order.filter((i) => onMap.has(i.characterId));
  const current = state.order[state.turn]?.characterId;
  const at = order.findIndex((i) => i.characterId === current);
  const next = (at === -1 ? Math.min(state.turn, order.length) : at + 1);
  if (next < order.length) return { round: state.round, turn: next, order };
  return { round: state.round + 1, turn: 0, order: insert(order, joining) };
}
