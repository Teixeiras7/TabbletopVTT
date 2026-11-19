import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, gameTables, profiles } from "@/lib/db/schema";

// XP é dado pelo Mestre no fim da sessão (livro, p. 151); cada personagem pode receber um valor diferente,
// ou nada. As progressões que o XP libera são escolhidas depois, na ficha.

export type XpCharacter = { id: string; name: string; ownerName: string; xp: number };

async function isMaster(tableId: string, userId: string) {
  const [table] = await db.select({ ownerId: gameTables.ownerId }).from(gameTables).where(eq(gameTables.id, tableId)).limit(1);
  return table?.ownerId === userId;
}

/** Personagens da mesa com o XP atual. Null se o usuário não é o Mestre. */
export async function listXp(tableId: string, userId: string): Promise<XpCharacter[] | null> {
  if (!(await isMaster(tableId, userId))) return null;
  return db
    .select({ id: characters.id, name: characters.name, ownerName: profiles.displayName, xp: characters.xp })
    .from(characters)
    .innerJoin(profiles, eq(characters.ownerId, profiles.id))
    .where(eq(characters.tableId, tableId))
    .orderBy(asc(characters.createdAt));
}

/** Soma o XP de cada personagem escolhido (só os desta mesa). Valores já validados (inteiros de 1 a 50). */
export async function giveXp(tableId: string, userId: string, awards: { characterId: string; amount: number }[]) {
  if (!(await isMaster(tableId, userId))) return false;
  const amount = sql`case ${characters.id} ${sql.join(awards.map((a) => sql`when ${a.characterId}::uuid then ${a.amount}::int`), sql` `)} end`;
  await db
    .update(characters)
    .set({ xp: sql`${characters.xp} + ${amount}` })
    .where(and(eq(characters.tableId, tableId), inArray(characters.id, awards.map((a) => a.characterId))));
  return true;
}

