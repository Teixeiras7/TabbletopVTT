"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { mesaIdSchema } from "@/lib/mesas/schemas";
import { giveXp, listXp, type XpCharacter } from "@/lib/mesas/xp";

export async function listXpAction(tableId: string): Promise<XpCharacter[] | null> {
  const user = await requireUser();
  const parsed = mesaIdSchema.safeParse(tableId);
  return parsed.success ? listXp(parsed.data, user.id) : null;
}

const awardsSchema = z
  .array(z.object({ characterId: z.uuid(), amount: z.number().int().min(1).max(50) }))
  .min(1, "Escolha ao menos um personagem.");

export async function giveXpAction(tableId: string, awards: unknown): Promise<{ ok: boolean; message?: string }> {
  const user = await requireUser();
  const table = mesaIdSchema.safeParse(tableId);
  const parsed = awardsSchema.safeParse(awards);
  if (!table.success || !parsed.success) return { ok: false, message: parsed.error?.issues[0]?.message ?? "Pedido inválido." };
  return (await giveXp(table.data, user.id, parsed.data)) ? { ok: true } : { ok: false, message: "Só o Mestre dá XP." };
}

