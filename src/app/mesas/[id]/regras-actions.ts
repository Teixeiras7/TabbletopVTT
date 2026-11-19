"use server";

import { requireUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog/db";
import type { Progression, Spell, SpellList } from "@/lib/catalog/schemas";
import { isTableMember } from "@/lib/mesas/characters";
import { mesaIdSchema } from "@/lib/mesas/schemas";

/** Magias e as listas de carreira (Feiticeiro de Fogo, Sacerdote de Morrow…) para a consulta da aba Regras. */
export async function getSpellsAction(tableId: string): Promise<{ spells: Spell[]; lists: SpellList[] } | null> {
  const user = await requireUser();
  const parsed = mesaIdSchema.safeParse(tableId);
  if (!parsed.success || !(await isTableMember(parsed.data, user.id))) return null;
  const { spells, spellLists } = await getCatalog();
  return { spells: [...spells].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), lists: spellLists };
}

/** Tabela de progressão por XP (livro, p. 152). */
export async function getProgressionAction(tableId: string): Promise<Progression | null> {
  const user = await requireUser();
  const parsed = mesaIdSchema.safeParse(tableId);
  if (!parsed.success || !(await isTableMember(parsed.data, user.id))) return null;
  return (await getCatalog()).progression;
}
