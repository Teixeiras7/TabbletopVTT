import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameTableMembers, gameTables, infos } from "@/lib/db/schema";
import { canCreateInfo, canEditInfo, canHideInfo, type InfoKind, type InfoView } from "./info-rules";

// Mesma regra do resto de mesas/: o backend usa a conexão privilegiada (ignora
// RLS), então "participa?", "é o Mestre?" e "o que cada um vê" são checados aqui.

function toInfoView(row: typeof infos.$inferSelect): InfoView {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    createdBy: row.createdBy,
    hidden: row.hidden,
  };
}

/** Dono da mesa se o usuário participa dela; null caso contrário (quem não participa não descobre que existe). */
async function ownerIfMember(tableId: string, userId: string) {
  const [row] = await db
    .select({ ownerId: gameTables.ownerId })
    .from(gameTables)
    .innerJoin(
      gameTableMembers,
      and(eq(gameTableMembers.tableId, gameTables.id), eq(gameTableMembers.userId, userId)),
    )
    .where(eq(gameTables.id, tableId))
    .limit(1);
  return row?.ownerId ?? null;
}

async function loadInfo(infoId: string, userId: string) {
  const [row] = await db
    .select({ info: infos, ownerId: gameTables.ownerId })
    .from(infos)
    .innerJoin(gameTables, eq(infos.tableId, gameTables.id))
    .innerJoin(
      gameTableMembers,
      and(eq(gameTableMembers.tableId, gameTables.id), eq(gameTableMembers.userId, userId)),
    )
    .where(eq(infos.id, infoId))
    .limit(1);
  return row ?? null;
}

/** O Mestre vê tudo; jogador não recebe as infos ocultas. Null se não participa. */
export async function listInfosForMember(tableId: string, userId: string): Promise<InfoView[] | null> {
  const ownerId = await ownerIfMember(tableId, userId);
  if (!ownerId) return null;

  const rows = await db
    .select()
    .from(infos)
    .where(
      ownerId === userId
        ? eq(infos.tableId, tableId)
        : and(eq(infos.tableId, tableId), eq(infos.hidden, false)),
    )
    .orderBy(asc(infos.createdAt));
  return rows.map(toInfoView);
}

/**
 * Imagem: só o Mestre. Nota: qualquer participante. O que o Mestre cria nasce
 * oculto (ele mostra depois); o que o jogador cria já é visível a todos.
 * `id` opcional porque a imagem é enviada ao Storage (caminho com o id) antes.
 */
export async function createInfo(
  tableId: string,
  userId: string,
  input: { id?: string; kind: InfoKind; name: string; description: string | null; imageUrl: string | null },
): Promise<InfoView | null> {
  const ownerId = await ownerIfMember(tableId, userId);
  if (!ownerId || !canCreateInfo(input.kind, userId, ownerId)) return null;

  const [row] = await db
    .insert(infos)
    .values({ ...input, tableId, createdBy: userId, hidden: userId === ownerId })
    .returning();
  return row ? toInfoView(row) : null;
}

/** Info que este usuário pode editar/excluir (com a mesa a que pertence, para achar o arquivo no Storage). Null se não pode. */
export async function getEditableInfo(infoId: string, userId: string) {
  const found = await loadInfo(infoId, userId);
  if (!found || !canEditInfo(found.info, userId, found.ownerId)) return null;
  return { id: found.info.id, kind: found.info.kind, tableId: found.info.tableId };
}

/** Nota: nome e descrição. Imagem: nome e, se enviada outra, o novo endereço. */
export async function updateInfo(
  infoId: string,
  userId: string,
  patch: { name: string; description?: string; imageUrl?: string },
): Promise<InfoView | null> {
  const found = await loadInfo(infoId, userId);
  if (!found || !canEditInfo(found.info, userId, found.ownerId)) return null;

  const set =
    found.info.kind === "note"
      ? { name: patch.name, description: patch.description ?? found.info.description }
      : { name: patch.name, imageUrl: patch.imageUrl ?? found.info.imageUrl };
  const [row] = await db.update(infos).set(set).where(eq(infos.id, infoId)).returning();
  return row ? toInfoView(row) : null;
}

export async function setInfoHidden(infoId: string, userId: string, hidden: boolean): Promise<InfoView | null> {
  const found = await loadInfo(infoId, userId);
  if (!found || !canHideInfo(found.info, userId, found.ownerId)) return null;

  const [row] = await db.update(infos).set({ hidden }).where(eq(infos.id, infoId)).returning();
  return row ? toInfoView(row) : null;
}

/** Retorna o que foi excluído (a ação apaga a imagem do Storage), ou null se não pode. */
export async function deleteInfo(infoId: string, userId: string) {
  const found = await loadInfo(infoId, userId);
  if (!found || !canEditInfo(found.info, userId, found.ownerId)) return null;

  await db.delete(infos).where(eq(infos.id, infoId));
  return { id: found.info.id, kind: found.info.kind, tableId: found.info.tableId };
}
