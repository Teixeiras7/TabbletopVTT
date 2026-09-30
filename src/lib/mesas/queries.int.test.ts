import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameTables, profiles } from "@/lib/db/schema";
import {
  createTable,
  createToken,
  deleteTable,
  deleteToken,
  getSceneForMember,
  getTableForMember,
  joinTableByCode,
  leaveTable,
  listMyTables,
  moveToken,
  updateSceneBackground,
  updateSceneGridSize,
  updateTable,
} from "./queries";

const master = randomUUID();
const player = randomUUID();
const stranger = randomUUID();
const userIds = [master, player, stranger];

beforeAll(async () => {
  await db.insert(profiles).values([
    { id: master, displayName: "Teste Mestre" },
    { id: player, displayName: "Teste Jogador" },
    { id: stranger, displayName: "Teste Estranho" },
  ]);
});

afterAll(async () => {
  // Apaga as mesas antes dos perfis (chave estrangeira); membros saem por cascade.
  await db.delete(gameTables).where(inArray(gameTables.ownerId, userIds));
  await db.delete(profiles).where(inArray(profiles.id, userIds));
  await db.$client.end();
});

describe("mesas no banco real", () => {
  it("fluxo completo: criar, convidar, sair, excluir — respeitando permissões", async () => {
    const table = await createTable(master, { name: "Mesa de Teste", description: null });
    expect(table.inviteCode).toHaveLength(8);

    // Criador entra como Mestre e único membro.
    const asMaster = await getTableForMember(table.id, master);
    expect(asMaster?.role).toBe("master");
    expect(asMaster?.members).toHaveLength(1);

    // Quem não participa não vê nem sabe que a mesa existe.
    expect(await getTableForMember(table.id, stranger)).toBeNull();
    expect(await joinTableByCode(stranger, "ZZZZZZZZ")).toBeNull();

    // Entrar por código vira Jogador; entrar de novo não duplica.
    expect(await joinTableByCode(player, table.inviteCode)).toBe(table.id);
    expect(await joinTableByCode(player, table.inviteCode)).toBe(table.id);
    const asPlayer = await getTableForMember(table.id, player);
    expect(asPlayer?.role).toBe("player");
    expect(asPlayer?.members.map((m) => m.role)).toEqual(["master", "player"]);

    // Minhas Mesas mostra a mesa com o código e o papel de cada um.
    const masterList = await listMyTables(master);
    expect(masterList.find((t) => t.id === table.id)).toMatchObject({
      role: "master",
      inviteCode: table.inviteCode,
    });
    expect((await listMyTables(player)).find((t) => t.id === table.id)?.role).toBe("player");
    expect(await listMyTables(stranger)).toHaveLength(0);

    // Só o Mestre edita nome/descrição.
    expect(await updateTable(table.id, player, { name: "Hack", description: null })).toBeNull();
    const updated = await updateTable(table.id, master, { name: "Mesa Renomeada", description: "Nova descrição" });
    expect(updated).toMatchObject({ name: "Mesa Renomeada", description: "Nova descrição" });

    // Só o Mestre exclui; o Mestre não "sai".
    expect(await deleteTable(table.id, player)).toBe(false);
    expect(await deleteTable(table.id, stranger)).toBe(false);
    expect(await leaveTable(table.id, master)).toBe("is_master");

    // Jogador sai e deixa de ver a mesa.
    expect(await leaveTable(table.id, player)).toBe("left");
    expect(await leaveTable(table.id, player)).toBe("not_member");
    expect(await getTableForMember(table.id, player)).toBeNull();

    // Mestre exclui e a mesa some (membros junto, por cascade).
    expect(await deleteTable(table.id, master)).toBe(true);
    expect(await getTableForMember(table.id, master)).toBeNull();
  });

  it("cena e tokens: criada automaticamente, só o Mestre edita, RLS por participante", async () => {
    const table = await createTable(master, { name: "Mesa do Mapa", description: null });
    await joinTableByCode(player, table.inviteCode);

    // A cena é criada junto com a mesa (uma por mesa, por enquanto).
    const scene = await getSceneForMember(table.id, master);
    expect(scene?.scene.tableId).toBe(table.id);
    expect(scene?.tokens).toHaveLength(0);

    // Quem não participa não vê a cena.
    expect(await getSceneForMember(table.id, stranger)).toBeNull();

    // Jogador não cria, move nem remove token — só o Mestre.
    expect(await createToken(scene!.scene.id, player, { label: "Orc", color: "#ef4444", x: 1, y: 1 })).toBeNull();

    const token = await createToken(scene!.scene.id, master, {
      label: "Orc #1",
      color: "#ef4444",
      x: 2,
      y: 3,
    });
    expect(token).toMatchObject({ label: "Orc #1", x: 2, y: 3 });

    expect(await moveToken(token!.id, player, 5, 5)).toBe(false);
    expect(await moveToken(token!.id, master, 5, 5)).toBe(true);
    expect((await getSceneForMember(table.id, player))?.tokens[0]).toMatchObject({ x: 5, y: 5 });

    expect(await deleteToken(token!.id, player)).toBe(false);
    expect(await deleteToken(token!.id, master)).toBe(true);
    expect((await getSceneForMember(table.id, master))?.tokens).toHaveLength(0);

    // Tamanho do grid e imagem de fundo: só o Mestre muda.
    expect(await updateSceneGridSize(scene!.scene.id, player, 80)).toBe(false);
    expect(await updateSceneGridSize(scene!.scene.id, master, 80)).toBe(true);
    expect((await getSceneForMember(table.id, master))?.scene.gridSize).toBe(80);

    expect(await updateSceneBackground(scene!.scene.id, player, "https://x.test/img.png")).toBe(false);
    expect(await updateSceneBackground(scene!.scene.id, master, "https://x.test/img.png")).toBe(true);
    expect((await getSceneForMember(table.id, master))?.scene.backgroundUrl).toBe("https://x.test/img.png");

    await deleteTable(table.id, master);
  });
});
