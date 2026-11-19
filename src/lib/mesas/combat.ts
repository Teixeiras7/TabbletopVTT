import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, gameTables, scenes, tokens } from "@/lib/db/schema";
import { getCatalogIndex } from "@/lib/catalog/db";
import { evaluateCharacter } from "@/lib/engine/character";
import { nextTurn, rollInitiative, type CombatState, type Initiative } from "@/lib/engine/combat";
import { sendChatRolls } from "./chat";
import { choicesSchema, detailsSchema } from "./character-schemas";

// Combate da cena: o Mestre inicia (todos no mapa rolam iniciativa), o dono do personagem da vez (ou o Mestre)
// encerra o turno, e o Mestre encerra o combate. O estado fica em `cenas.combate` e chega a todos pelo Realtime.

type Result = { ok: true } | { ok: false; error: string };

async function sceneInfo(sceneId: string) {
  const [row] = await db
    .select({ tableId: scenes.tableId, combat: scenes.combat, ownerId: gameTables.ownerId })
    .from(scenes)
    .innerJoin(gameTables, eq(scenes.tableId, gameTables.id))
    .where(eq(scenes.id, sceneId))
    .limit(1);
  return row ?? null;
}

/** Personagens no mapa da cena, com o bônus de Iniciativa calculado pela ficha. */
async function onMap(sceneId: string) {
  const [rows, idx] = await Promise.all([
    db
      .select({ id: characters.id, name: characters.name, ownerId: characters.ownerId, choices: characters.choices, details: characters.details, xp: characters.xp })
      .from(tokens)
      .innerJoin(characters, eq(tokens.characterId, characters.id))
      .where(eq(tokens.sceneId, sceneId)),
    getCatalogIndex(),
  ]);
  return rows.map((r) => {
    const choices = choicesSchema.safeParse(r.choices);
    const details = detailsSchema.safeParse(r.details);
    const sheet = choices.success && details.success ? evaluateCharacter(idx, choices.data, details.data, r).sheet : null;
    return { characterId: r.id, name: r.name, ownerId: r.ownerId, bonus: sheet?.derived.initiative ?? 0 };
  });
}

/** Cartão de iniciativa no chat: total grande, nome embaixo; o detalhe dos dados aparece ao passar o mouse. */
const initiativeCards = (list: Initiative[]) =>
  list.map((i) => ({ title: "Iniciativa", total: i.total, label: i.name, detail: `2d6 (${i.rolls.join(" + ")}) + ${i.bonus} = ${i.total}` }));

/** Ações do turno do personagem ficam livres de novo quando chega a vez dele. */
async function freeActions(characterId: string | undefined) {
  if (!characterId) return;
  await db
    .update(characters)
    .set({ state: sql`${characters.state} || '{"actionsUsed": []}'::jsonb` })
    .where(eq(characters.id, characterId));
}

async function save(sceneId: string, combat: CombatState | null) {
  await db.update(scenes).set({ combat }).where(eq(scenes.id, sceneId));
}

export async function startCombat(sceneId: string, userId: string): Promise<Result> {
  const scene = await sceneInfo(sceneId);
  if (!scene || scene.ownerId !== userId) return { ok: false, error: "Só o Mestre inicia o combate." };
  if (scene.combat) return { ok: false, error: "O combate já começou." };
  const fighters = await onMap(sceneId);
  if (fighters.length === 0) return { ok: false, error: "Coloque os personagens no mapa antes de iniciar." };
  const order = rollInitiative(fighters);
  const state: CombatState = { round: 1, turn: 0, order };
  await save(sceneId, state);
  await freeActions(order[0]?.characterId);
  await sendChatRolls(scene.tableId, userId, initiativeCards(order));
  return { ok: true };
}

/** Encerra o turno da vez e passa para o próximo (ao virar a rodada, entra quem chegou ao mapa no meio). */
export async function endTurn(sceneId: string, userId: string): Promise<Result> {
  const scene = await sceneInfo(sceneId);
  if (!scene?.combat) return { ok: false, error: "Não há combate." };
  const current = scene.combat.order[scene.combat.turn];
  const fighters = await onMap(sceneId);
  const owner = fighters.find((f) => f.characterId === current?.characterId)?.ownerId;
  if (scene.ownerId !== userId && owner !== userId) return { ok: false, error: "Só o dono do personagem da vez ou o Mestre encerra o turno." };

  const inOrder = new Set(scene.combat.order.map((i) => i.characterId));
  const newcomers = fighters.filter((f) => !inOrder.has(f.characterId));
  const lastOfRound = scene.combat.turn >= scene.combat.order.length - 1;
  const joining = lastOfRound && newcomers.length ? rollInitiative(newcomers) : [];
  const next = nextTurn(scene.combat, new Set(fighters.map((f) => f.characterId)), joining);
  if (next.order.length === 0) {
    await save(sceneId, null);
    return { ok: true };
  }
  await save(sceneId, next);
  await freeActions(next.order[next.turn]?.characterId);
  await sendChatRolls(scene.tableId, userId, initiativeCards(joining));
  return { ok: true };
}

export async function endCombat(sceneId: string, userId: string): Promise<Result> {
  const scene = await sceneInfo(sceneId);
  if (!scene || scene.ownerId !== userId) return { ok: false, error: "Só o Mestre encerra o combate." };
  await save(sceneId, null);
  return { ok: true };
}

