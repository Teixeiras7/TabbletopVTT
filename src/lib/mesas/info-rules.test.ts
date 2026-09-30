import { describe, expect, it } from "vitest";
import { canCreateInfo, canEditInfo, canHideInfo } from "./info-rules";

const master = "master-1";
const player = "player-1";
const otherPlayer = "player-2";

describe("regras das Infos", () => {
  it("imagem só o Mestre cria; nota qualquer participante", () => {
    expect(canCreateInfo("image", master, master)).toBe(true);
    expect(canCreateInfo("image", player, master)).toBe(false);
    expect(canCreateInfo("note", player, master)).toBe(true);
  });

  it("info do Mestre só o Mestre edita", () => {
    const masterNote = { createdBy: master };
    expect(canEditInfo(masterNote, master, master)).toBe(true);
    expect(canEditInfo(masterNote, player, master)).toBe(false);
  });

  it("info criada por jogador, todos editam (inclusive o Mestre e outros jogadores)", () => {
    const playerNote = { createdBy: player };
    expect(canEditInfo(playerNote, player, master)).toBe(true);
    expect(canEditInfo(playerNote, otherPlayer, master)).toBe(true);
    expect(canEditInfo(playerNote, master, master)).toBe(true);
  });

  it("só o Mestre oculta/mostra, e só o que ele mesmo criou", () => {
    expect(canHideInfo({ createdBy: master }, master, master)).toBe(true);
    expect(canHideInfo({ createdBy: master }, player, master)).toBe(false);
    expect(canHideInfo({ createdBy: player }, master, master)).toBe(false);
    expect(canHideInfo({ createdBy: player }, player, master)).toBe(false);
  });
});
