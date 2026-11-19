"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { ATTRIBUTES } from "@/lib/catalog/schemas";
import type { CharacterResult } from "@/lib/mesas/characters";
import { characterIdSchema } from "@/lib/mesas/character-schemas";
import { mesaIdSchema } from "@/lib/mesas/schemas";
import * as shop from "@/lib/mesas/shop";

const INVALID: CharacterResult = { ok: false, errors: ["Pedido inválido."] };
const itemId = z.string().max(100);

export async function getShopAction(tableId: string): Promise<shop.ShopView | null> {
  const user = await requireUser();
  const parsed = mesaIdSchema.safeParse(tableId);
  return parsed.success ? shop.getShop(parsed.data, user.id) : null;
}

/** Valida o personagem (e o item, se houver) e chama a regra com o usuário da sessão. */
async function run(characterId: string, item: string | null, fn: (characterId: string, userId: string, item: string) => Promise<CharacterResult>) {
  const user = await requireUser();
  const c = characterIdSchema.safeParse(characterId);
  const i = itemId.safeParse(item ?? "");
  return c.success && i.success ? fn(c.data, user.id, i.data) : INVALID;
}

export const buyAction = async (characterId: string, item: string) => run(characterId, item, shop.buy);
export const sellAction = async (characterId: string, item: string) => run(characterId, item, shop.sell);
export const giveItemAction = async (characterId: string, item: string) => run(characterId, item, shop.giveItem);
export const takeItemAction = async (characterId: string, item: string) => run(characterId, item, shop.takeItem);
export const endNegotiationAction = async (characterId: string) => run(characterId, null, shop.endNegotiation);

export async function negotiateAction(characterId: string, kind: "buy" | "sell", attribute: string) {
  const parsed = z.object({ kind: z.enum(["buy", "sell"]), attribute: z.enum(ATTRIBUTES) }).safeParse({ kind, attribute });
  return parsed.success ? run(characterId, null, (c, u) => shop.negotiate(c, u, parsed.data.kind, parsed.data.attribute)) : INVALID;
}

export async function setMoneyAction(characterId: string, money: number) {
  return typeof money === "number" ? run(characterId, null, (c, u) => shop.setMoney(c, u, money)) : INVALID;
}
