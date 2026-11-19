import "server-only";
import { and, desc, eq, gt, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, gameTableMembers, gameTables, profiles, type ChatRoll } from "@/lib/db/schema";

// Mesma regra do resto de mesas/: o backend usa a conexão privilegiada (ignora
// RLS), então "é participante?" e "é o Mestre?" são checados aqui.

/** O banco guarda só as últimas mensagens de cada mesa; as mais antigas são apagadas a cada envio. */
export const CHAT_LIMIT = 100;

export type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  /** Rolagem: mostrada como cartão (título, total, nome; o detalhe dos dados ao passar o mouse). */
  roll: ChatRoll | null;
  createdAt: string;
};

function toChatMessage(row: typeof chatMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.authorName,
    content: row.content,
    roll: row.roll ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Últimas mensagens (em ordem) que este participante ainda "vê", isto é, posteriores ao último Limpar chat dele. Null se não participa. */
export async function listChatForMember(tableId: string, userId: string) {
  const [member] = await db
    .select({ chatClearedAt: gameTableMembers.chatClearedAt })
    .from(gameTableMembers)
    .where(and(eq(gameTableMembers.tableId, tableId), eq(gameTableMembers.userId, userId)))
    .limit(1);
  if (!member) return null;

  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      member.chatClearedAt
        ? and(eq(chatMessages.tableId, tableId), gt(chatMessages.createdAt, member.chatClearedAt))
        : eq(chatMessages.tableId, tableId),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(CHAT_LIMIT);

  return rows.reverse().map(toChatMessage);
}

/** Só participante envia. O nome do autor vem do perfil, nunca do cliente. Null se não participa. */
export async function sendChatMessage(tableId: string, userId: string, content: string) {
  const [message] = (await sendChatRows(tableId, userId, [{ content, roll: null }])) ?? [];
  return message ?? null;
}

/** Rolagens no chat, um cartão cada (ex.: a iniciativa de cada personagem no início do combate). */
export async function sendChatRolls(tableId: string, userId: string, rolls: ChatRoll[]) {
  if (rolls.length === 0) return;
  await sendChatRows(tableId, userId, rolls.map((roll) => ({ content: `${roll.title} — ${roll.label}: ${roll.detail}`, roll })));
}

async function sendChatRows(tableId: string, userId: string, rows: { content: string; roll: ChatRoll | null }[]) {
  const [author] = await db
    .select({ displayName: profiles.displayName })
    .from(gameTableMembers)
    .innerJoin(profiles, eq(gameTableMembers.userId, profiles.id))
    .where(and(eq(gameTableMembers.tableId, tableId), eq(gameTableMembers.userId, userId)))
    .limit(1);
  if (!author) return null;

  const inserted = await db
    .insert(chatMessages)
    .values(rows.map((r) => ({ tableId, authorId: userId, authorName: author.displayName, content: r.content, roll: r.roll })))
    .returning();
  const newest = db.select({ id: chatMessages.id }).from(chatMessages).where(eq(chatMessages.tableId, tableId)).orderBy(desc(chatMessages.createdAt)).limit(CHAT_LIMIT);
  await db.delete(chatMessages).where(and(eq(chatMessages.tableId, tableId), notInArray(chatMessages.id, newest)));
  return inserted.map(toChatMessage);
}

/** "Limpar chat" pessoal: só grava um corte de horário; as mensagens continuam para os demais. Retorna o corte, ou null se não participa. */
export async function clearMyChat(tableId: string, userId: string) {
  const [row] = await db
    .update(gameTableMembers)
    // now() do banco, não new Date(): created_at das mensagens também é do relógio do banco.
    .set({ chatClearedAt: sql`now()` })
    .where(and(eq(gameTableMembers.tableId, tableId), eq(gameTableMembers.userId, userId)))
    .returning({ chatClearedAt: gameTableMembers.chatClearedAt });
  return row?.chatClearedAt?.toISOString() ?? null;
}

/** Só o Mestre apaga o chat de todos (apaga de verdade). */
export async function clearAllChat(tableId: string, userId: string): Promise<boolean> {
  const [table] = await db
    .select({ ownerId: gameTables.ownerId })
    .from(gameTables)
    .where(eq(gameTables.id, tableId))
    .limit(1);
  if (table?.ownerId !== userId) return false;

  await db.delete(chatMessages).where(eq(chatMessages.tableId, tableId));
  return true;
}
