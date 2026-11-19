import { describe, expect, it } from "vitest";
import { nextTurn, rollInitiative, type CombatState } from "./combat";

/** Dados viciados: devolve os valores em sequência (1d6 = floor(r * 6) + 1). */
const dice = (...faces: number[]) => {
  let i = 0;
  return () => ((faces[i++ % faces.length] ?? 1) - 1) / 6;
};

describe("iniciativa e rodadas (pp. 197-198)", () => {
  it("2d6 + Iniciativa, maior primeiro; empate rola de novo", () => {
    const order = rollInitiative(
      [
        { characterId: "a", name: "A", bonus: 10 },
        { characterId: "b", name: "B", bonus: 10 },
      ],
      dice(3, 3, 3, 3, 6, 6, 1, 1), // empatam em 16; na nova rolagem A tira 12 e B tira 2
    );
    expect(order.map((i) => [i.characterId, i.total])).toEqual([
      ["a", 22],
      ["b", 12],
    ]);
  });

  it("passa os turnos, vira a rodada, insere quem chegou e tira quem saiu do mapa", () => {
    const i = (id: string, total: number) => ({ characterId: id, name: id, rolls: [], bonus: 0, total });
    let s: CombatState = { round: 1, turn: 0, order: [i("a", 20), i("b", 15)] };
    s = nextTurn(s, new Set(["a", "b", "c"]), [i("c", 18)]);
    expect([s.round, s.turn]).toEqual([1, 1]);
    s = nextTurn(s, new Set(["a", "b", "c"]), [i("c", 18)]);
    expect(s.round).toBe(2);
    expect(s.order.map((x) => x.characterId)).toEqual(["a", "c", "b"]); // c entra pela posição do total
    s = nextTurn({ ...s, turn: 0 }, new Set(["a", "b"]), []); // c saiu do mapa
    expect(s.order.map((x) => x.characterId)).toEqual(["a", "b"]);
    expect(s.order[s.turn]?.characterId).toBe("b");
  });
});
