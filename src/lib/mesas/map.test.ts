import { describe, expect, it } from "vitest";
import {
  GRID_SIZES,
  MAP_SIZE,
  cellAt,
  cellCenter,
  cellsPerSide,
  clampCell,
  nearestGridSizeIndex,
} from "./map";

describe("mapa de tamanho fixo", () => {
  it("todo tamanho de quadrado divide o mapa exatamente", () => {
    for (const size of GRID_SIZES) expect(MAP_SIZE % size).toBe(0);
  });

  it("mudar o quadrado muda quantas casas cabem, não o espaço", () => {
    expect(cellsPerSide(40)).toBe(36);
    expect(cellsPerSide(80)).toBe(18);
    expect(cellsPerSide(40) * 40).toBe(cellsPerSide(80) * 80);
  });

  it("cellAt acha a casa do ponto e nunca sai do mapa", () => {
    expect(cellAt(0, 40)).toBe(0);
    expect(cellAt(59, 40)).toBe(1);
    expect(cellAt(-500, 40)).toBe(0);
    expect(cellAt(MAP_SIZE + 500, 40)).toBe(35);
  });

  it("o token fica na casa e acompanha o tamanho do quadrado", () => {
    expect(cellCenter(2, 40)).toBe(100);
    expect(cellCenter(2, 80)).toBe(200);
  });

  it("casa que deixou de existir (quadrado maior) aparece na última casa", () => {
    // Casa 30 existe a 40 px (36 casas), mas não a 80 px (18 casas).
    expect(cellCenter(30, 40)).toBe(30 * 40 + 20);
    expect(cellCenter(30, 80)).toBe(17 * 80 + 40);
    expect(clampCell(30, 80)).toBe(17);
  });

  it("tamanho antigo fora da lista cai no mais próximo", () => {
    expect(GRID_SIZES[nearestGridSizeIndex(44)]).toBe(45);
    expect(GRID_SIZES[nearestGridSizeIndex(40)]).toBe(40);
    expect(GRID_SIZES[nearestGridSizeIndex(1000)]).toBe(160);
  });
});
