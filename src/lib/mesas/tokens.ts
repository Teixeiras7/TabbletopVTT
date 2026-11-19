import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, gameTableMembers, scenes, tokens } from "@/lib/db/schema";
import { canManage, loadAccess } from "./characters";

// Personagens no mapa. Todos da mesa veem; só o dono do personagem e o Mestre colocam, movem e tiram.

export type TokenView = { id: string; characterId: string; ownerId: string; name: string; imageUrl: string | null; x: number; y: number };

/** Casas do mapa vão de 0 a MAX_CELL (com o menor quadrado, 16 px, o mapa de 1440 px tem 90 casas). */
const MAX_CELL = 89;

async function sceneTable(sceneId: string) {
  const [scene] = await db.select({ tableId: scenes.tableId }).from(scenes).where(eq(scenes.id, sceneId)).limit(1);
  return scene?.tableId ?? null;
}

/** Tokens da cena, com nome e imagem do personagem. Null se o usuário não participa da mesa. */
export async function listTokens(sceneId: string, userId: string): Promise<TokenView[] | null> {
  const tableId = await sceneTable(sceneId);
  if (!tableId) return null;
  const [member] = await db
    .select({ userId: gameTableMembers.userId })
    .from(gameTableMembers)
    .where(and(eq(gameTableMembers.tableId, tableId), eq(gameTableMembers.userId, userId)))
    .limit(1);
  if (!member) return null;
  return db
    .select({ id: tokens.id, characterId: tokens.characterId, ownerId: characters.ownerId, name: characters.name, imageUrl: characters.imageUrl, x: tokens.x, y: tokens.y })
    .from(tokens)
    .innerJoin(characters, eq(tokens.characterId, characters.id))
    .where(eq(tokens.sceneId, sceneId));
}

/** Coloca o personagem na casa (ou move, se já está no mapa). */
export async function placeToken(sceneId: string, characterId: string, userId: string, x: number, y: number) {
  const [a, tableId] = await Promise.all([loadAccess(characterId, userId), sceneTable(sceneId)]);
  if (!a || !canManage(a) || a.tableId !== tableId) return false;
  const cell = { x: Math.max(0, Math.min(MAX_CELL, x)), y: Math.max(0, Math.min(MAX_CELL, y)) };
  await db
    .insert(tokens)
    .values({ sceneId, characterId, ...cell })
    .onConflictDoUpdate({ target: [tokens.sceneId, tokens.characterId], set: cell });
  return true;
}

/** Tira o personagem do mapa. */
export async function removeToken(sceneId: string, characterId: string, userId: string) {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return false;
  await db.delete(tokens).where(and(eq(tokens.sceneId, sceneId), eq(tokens.characterId, characterId)));
  return true;
}
