import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameTables, profiles } from "@/lib/db/schema";
import {
  createInfo,
  deleteInfo,
  getEditableInfo,
  listInfosForMember,
  setInfoHidden,
  updateInfo,
} from "./infos";
import { createTable, joinTableByCode } from "./queries";

const master = randomUUID();
const player = randomUUID();
const otherPlayer = randomUUID();
const stranger = randomUUID();
const userIds = [master, player, otherPlayer, stranger];

beforeAll(async () => {
  await db.insert(profiles).values([
    { id: master, displayName: "Teste Mestre" },
    { id: player, displayName: "Teste Jogador" },
    { id: otherPlayer, displayName: "Teste Jogador 2" },
    { id: stranger, displayName: "Teste Estranho" },
  ]);
});

afterAll(async () => {
  // Infos saem por cascade junto com a mesa; mesas antes dos perfis (chave estrangeira).
  await db.delete(gameTables).where(inArray(gameTables.ownerId, userIds));
  await db.delete(profiles).where(inArray(profiles.id, userIds));
  await db.$client.end();
});

const names = (list: { name: string }[] | null) => list?.map((i) => i.name).sort();

describe("infos no banco real", () => {
  it("criar, ocultar/mostrar, editar e excluir — respeitando quem criou", async () => {
    const table = await createTable(master, { name: "Mesa das Infos", description: null });
    await joinTableByCode(player, table.inviteCode);
    await joinTableByCode(otherPlayer, table.inviteCode);

    // Quem não participa não vê nem cria; jogador não cria imagem.
    expect(await listInfosForMember(table.id, stranger)).toBeNull();
    expect(
      await createInfo(table.id, stranger, { kind: "note", name: "x", description: "x", imageUrl: null }),
    ).toBeNull();
    expect(
      await createInfo(table.id, player, { kind: "image", name: "Mapa", description: null, imageUrl: "https://x.test/a.png" }),
    ).toBeNull();

    // O que o Mestre cria nasce oculto; o que o jogador cria já é visível.
    const masterImage = await createInfo(table.id, master, {
      kind: "image",
      name: "Taverna",
      description: null,
      imageUrl: "https://x.test/taverna.png",
    });
    const masterNote = await createInfo(table.id, master, {
      kind: "note",
      name: "Segredo do vilão",
      description: "É o irmão do rei.",
      imageUrl: null,
    });
    const playerNote = await createInfo(table.id, player, {
      kind: "note",
      name: "Minhas dúvidas",
      description: "Quem é o vilão?",
      imageUrl: null,
    });
    expect(masterImage?.hidden).toBe(true);
    expect(masterNote?.hidden).toBe(true);
    expect(playerNote?.hidden).toBe(false);

    // Jogador não recebe as ocultas; o Mestre vê tudo.
    expect(names(await listInfosForMember(table.id, player))).toEqual(["Minhas dúvidas"]);
    expect(names(await listInfosForMember(table.id, otherPlayer))).toEqual(["Minhas dúvidas"]);
    expect(names(await listInfosForMember(table.id, master))).toEqual([
      "Minhas dúvidas",
      "Segredo do vilão",
      "Taverna",
    ]);

    // Só o Mestre mostra/oculta, e só o que ele criou.
    expect(await setInfoHidden(masterNote!.id, player, false)).toBeNull();
    expect(await setInfoHidden(playerNote!.id, master, true)).toBeNull();
    expect((await setInfoHidden(masterNote!.id, master, false))?.hidden).toBe(false);
    expect(names(await listInfosForMember(table.id, player))).toEqual(["Minhas dúvidas", "Segredo do vilão"]);
    expect((await setInfoHidden(masterNote!.id, master, true))?.hidden).toBe(true);
    expect(names(await listInfosForMember(table.id, player))).toEqual(["Minhas dúvidas"]);

    // Info do Mestre: jogador não edita nem exclui (nem sabendo o id de uma oculta).
    expect(await updateInfo(masterNote!.id, player, { name: "Hack" })).toBeNull();
    expect(await deleteInfo(masterNote!.id, player)).toBeNull();
    expect(await getEditableInfo(masterImage!.id, player)).toBeNull();
    expect((await updateInfo(masterNote!.id, master, { name: "Segredo", description: "Novo." }))?.name).toBe("Segredo");

    // Info de jogador: qualquer participante edita e exclui, mas não quem está fora.
    expect(await updateInfo(playerNote!.id, stranger, { name: "Hack" })).toBeNull();
    expect((await updateInfo(playerNote!.id, otherPlayer, { name: "Dúvidas", description: "Editado." }))?.description).toBe(
      "Editado.",
    );
    expect((await updateInfo(playerNote!.id, master, { name: "Dúvidas do grupo" }))?.name).toBe("Dúvidas do grupo");

    // Trocar a imagem muda o endereço; sem imagem nova, mantém o atual.
    expect((await updateInfo(masterImage!.id, master, { name: "Taverna 2", imageUrl: "https://x.test/novo.png" }))?.imageUrl).toBe(
      "https://x.test/novo.png",
    );
    expect((await updateInfo(masterImage!.id, master, { name: "Taverna 3" }))?.imageUrl).toBe("https://x.test/novo.png");

    // Excluir.
    expect(await deleteInfo(playerNote!.id, stranger)).toBeNull();
    expect((await deleteInfo(playerNote!.id, otherPlayer))?.id).toBe(playerNote!.id);
    expect(names(await listInfosForMember(table.id, master))).toEqual(["Segredo", "Taverna 3"]);
  });
});
