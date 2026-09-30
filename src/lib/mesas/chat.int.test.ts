import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameTables, profiles } from "@/lib/db/schema";
import { clearAllChat, clearMyChat, listChatForMember, sendChatMessage } from "./chat";
import { createTable, joinTableByCode } from "./queries";

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
  // Mensagens saem por cascade junto com a mesa; mesas antes dos perfis (chave estrangeira).
  await db.delete(gameTables).where(inArray(gameTables.ownerId, userIds));
  await db.delete(profiles).where(inArray(profiles.id, userIds));
  await db.$client.end();
});

describe("chat no banco real", () => {
  it("envio, limpar meu chat (só para mim) e limpar tudo (só o Mestre)", async () => {
    const table = await createTable(master, { name: "Mesa do Chat", description: null });
    await joinTableByCode(player, table.inviteCode);

    // Só participante envia e lê; o nome do autor vem do perfil.
    expect(await sendChatMessage(table.id, stranger, "oi")).toBeNull();
    expect(await listChatForMember(table.id, stranger)).toBeNull();
    const first = await sendChatMessage(table.id, player, "Olá, mesa!");
    expect(first).toMatchObject({ authorId: player, authorName: "Teste Jogador", content: "Olá, mesa!" });
    await sendChatMessage(table.id, master, "Bem-vindos.");

    expect((await listChatForMember(table.id, master))?.map((m) => m.content)).toEqual([
      "Olá, mesa!",
      "Bem-vindos.",
    ]);

    // Limpar meu chat: some só para quem clicou; mensagens novas continuam chegando.
    expect(await clearMyChat(table.id, stranger)).toBeNull();
    expect(await clearMyChat(table.id, player)).not.toBeNull();
    expect(await listChatForMember(table.id, player)).toEqual([]);
    expect(await listChatForMember(table.id, master)).toHaveLength(2);
    await sendChatMessage(table.id, master, "Depois de limpar.");
    expect((await listChatForMember(table.id, player))?.map((m) => m.content)).toEqual(["Depois de limpar."]);

    // Limpar tudo: só o Mestre; apaga para todos.
    expect(await clearAllChat(table.id, player)).toBe(false);
    expect(await clearAllChat(table.id, stranger)).toBe(false);
    expect(await listChatForMember(table.id, master)).toHaveLength(3);
    expect(await clearAllChat(table.id, master)).toBe(true);
    expect(await listChatForMember(table.id, master)).toEqual([]);
    expect(await listChatForMember(table.id, player)).toEqual([]);
  });
});
