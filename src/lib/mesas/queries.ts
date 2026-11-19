import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameTableMembers, gameTables, profiles, scenes } from "@/lib/db/schema";
import { generateInviteCode } from "./invite-code";
import { roleOf, type MesaRole } from "./roles";

export type MesaMember = { userId: string; displayName: string; joinedAt: Date; role: MesaRole };

// O backend acessa o banco com a conexão privilegiada (ignora RLS), então
// toda checagem de "quem pode o quê" acontece aqui, nunca só na interface.

function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) => (e as { code?: string } | null)?.code;
  return code(error) === "23505" || code((error as { cause?: unknown } | null)?.cause) === "23505";
}

export async function listMyTables(userId: string) {
  const rows = await db
    .select({
      id: gameTables.id,
      name: gameTables.name,
      description: gameTables.description,
      ownerId: gameTables.ownerId,
      inviteCode: gameTables.inviteCode,
    })
    .from(gameTableMembers)
    .innerJoin(gameTables, eq(gameTableMembers.tableId, gameTables.id))
    .where(eq(gameTableMembers.userId, userId))
    .orderBy(desc(gameTables.createdAt));

  return rows.map((row) => ({ ...row, role: roleOf(row.ownerId, userId) }));
}

/** Só o Mestre (criador) edita. Retorna null se a mesa não existe ou o usuário não é o Mestre. */
export async function updateTable(
  tableId: string,
  userId: string,
  input: { name: string; description: string | null },
) {
  const [table] = await db
    .update(gameTables)
    .set(input)
    .where(and(eq(gameTables.id, tableId), eq(gameTables.ownerId, userId)))
    .returning();
  return table ?? null;
}

/** Retorna null quando a mesa não existe OU o usuário não participa — quem não é membro não descobre que ela existe. */
export async function getTableForMember(tableId: string, userId: string) {
  // As duas em paralelo (cada ida ao banco custa ~170 ms); a lista de membros só sai se ele participa.
  const [[row], members] = await Promise.all([
    db
      .select({ table: gameTables })
      .from(gameTables)
      .innerJoin(gameTableMembers, and(eq(gameTableMembers.tableId, gameTables.id), eq(gameTableMembers.userId, userId)))
      .where(eq(gameTables.id, tableId))
      .limit(1),
    db
      .select({ userId: gameTableMembers.userId, displayName: profiles.displayName, joinedAt: gameTableMembers.joinedAt })
      .from(gameTableMembers)
      .innerJoin(profiles, eq(gameTableMembers.userId, profiles.id))
      .where(eq(gameTableMembers.tableId, tableId))
      .orderBy(asc(gameTableMembers.joinedAt)),
  ]);
  if (!row) return null;

  return {
    table: row.table,
    role: roleOf(row.table.ownerId, userId),
    members: members.map((m) => ({ ...m, role: roleOf(row.table.ownerId, m.userId) })),
  };
}

export async function createTable(
  userId: string,
  input: { name: string; description: string | null },
) {
  // Colisão de código é improvável (~10^12 combinações), mas a coluna é
  // UNIQUE: em vez de checar antes (corrida), tenta e repete se colidir.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Um comando só (mesa + Mestre como membro + cena): atômico sem transação e uma ida ao banco.
      // Transação não dá: o cliente roda sem pipelining (src/lib/db/index.ts), que o sql.begin exige.
      const rows = await db.execute<{ id: string }>(sql`
        with mesa as (
          insert into ${gameTables} (nome, descricao, dono_id, codigo_convite)
          values (${input.name}, ${input.description}, ${userId}, ${generateInviteCode()})
          returning id
        ),
        membro as (insert into ${gameTableMembers} (mesa_id, usuario_id) select id, ${userId} from mesa),
        cena as (insert into ${scenes} (mesa_id) select id from mesa)
        select id from mesa`);
      const table = rows[0];
      if (!table) throw new Error("Falha ao criar a mesa.");
      return table;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Não foi possível gerar um código de convite único.");
}

/** Idempotente: quem já participa continua participando. Retorna null se o código não existe. */
export async function joinTableByCode(userId: string, inviteCode: string) {
  const [table] = await db
    .select({ id: gameTables.id })
    .from(gameTables)
    .where(eq(gameTables.inviteCode, inviteCode))
    .limit(1);
  if (!table) return null;

  await db
    .insert(gameTableMembers)
    .values({ tableId: table.id, userId })
    .onConflictDoNothing();
  return table.id;
}

export type LeaveResult = "left" | "not_member" | "is_master";

/** O Mestre não sai da própria mesa: só pode excluí-la. */
export async function leaveTable(tableId: string, userId: string): Promise<LeaveResult> {
  const [table] = await db
    .select({ ownerId: gameTables.ownerId })
    .from(gameTables)
    .where(eq(gameTables.id, tableId))
    .limit(1);
  if (!table) return "not_member";
  if (table.ownerId === userId) return "is_master";

  const removed = await db
    .delete(gameTableMembers)
    .where(and(eq(gameTableMembers.tableId, tableId), eq(gameTableMembers.userId, userId)))
    .returning({ userId: gameTableMembers.userId });
  return removed.length > 0 ? "left" : "not_member";
}

/** Só o Mestre (criador) exclui. Retorna false se a mesa não existe ou o usuário não é o Mestre. */
export async function deleteTable(tableId: string, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(gameTables)
    .where(and(eq(gameTables.id, tableId), eq(gameTables.ownerId, userId)))
    .returning({ id: gameTables.id });
  return deleted.length > 0;
}

/** Retorna null quando a mesa não existe OU o usuário não participa dela. */
export async function getSceneForMember(tableId: string, userId: string) {
  const [row] = await db
    .select({ scene: scenes, ownerId: gameTables.ownerId })
    .from(scenes)
    .innerJoin(gameTables, eq(scenes.tableId, gameTables.id))
    .innerJoin(
      gameTableMembers,
      and(eq(gameTableMembers.tableId, gameTables.id), eq(gameTableMembers.userId, userId)),
    )
    .where(eq(scenes.tableId, tableId))
    .limit(1);
  if (!row) return null;
  return { scene: row.scene, role: roleOf(row.ownerId, userId) };
}

async function assertMaster(sceneId: string, userId: string) {
  const [row] = await db
    .select({ ownerId: gameTables.ownerId })
    .from(scenes)
    .innerJoin(gameTables, eq(scenes.tableId, gameTables.id))
    .where(eq(scenes.id, sceneId))
    .limit(1);
  return row?.ownerId === userId;
}

/** Só o Mestre da mesa muda o tamanho da célula do grid. */
export async function updateSceneGridSize(sceneId: string, userId: string, gridSize: number) {
  if (!(await assertMaster(sceneId, userId))) return false;
  const updated = await db
    .update(scenes)
    .set({ gridSize })
    .where(eq(scenes.id, sceneId))
    .returning({ id: scenes.id });
  return updated.length > 0;
}

/** Só o Mestre da mesa troca a imagem de fundo (ou remove, passando null). */
export async function updateSceneBackground(sceneId: string, userId: string, backgroundUrl: string | null) {
  if (!(await assertMaster(sceneId, userId))) return false;
  const updated = await db
    .update(scenes)
    .set({ backgroundUrl })
    .where(eq(scenes.id, sceneId))
    .returning({ id: scenes.id });
  return updated.length > 0;
}
