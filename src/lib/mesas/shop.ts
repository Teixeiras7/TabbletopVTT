import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, gameTables, type InventoryItem, type Negotiation } from "@/lib/db/schema";
import { getCatalog, getCatalogIndex } from "@/lib/catalog/db";
import type { Attribute, Equipment } from "@/lib/catalog/schemas";
import { evaluateCharacter } from "@/lib/engine/character";
import { rollDice } from "@/lib/engine/dice";
import { DEFAULT_RATES, negotiationRates, priceWith } from "@/lib/engine/shop";
import { addItem, isCatalogItem, removeOne, type CatalogItem } from "@/lib/engine/inventory";
import { canManage, isTableMember, loadAccess, type Access, type CharacterResult } from "./characters";
import { choicesSchema, detailsSchema } from "./character-schemas";
import { sendChatMessage } from "./chat";

// Compra e venda: o backend decide preço, saldo e se o personagem pode negociar. Dono e Mestre
// mexem no personagem; dar item e ajustar dinheiro é só do Mestre.

export type ShopCharacter = {
  id: string;
  name: string;
  money: number;
  /** Só o que a Loja compra: itens da Lista de Preços (os de texto ficam na aba Equipamentos da ficha). */
  inventory: (CatalogItem & { name: string })[];
  /** % da compra e da venda agora (tabela, ou o resultado da Negociação rolada nesta Loja). */
  rates: { buy: number; sell: number };
  negotiated: { buy: boolean; sell: boolean };
  /** Atributos que podem acompanhar a Negociação (perícia social: o jogador escolhe). Vazio = não tem a perícia. */
  negotiationAttributes: Attribute[];
};

export type ShopView = { isMaster: boolean; items: Equipment[]; characters: ShopCharacter[] };

type Sheet = NonNullable<ReturnType<typeof evaluateCharacter>["sheet"]>;

function sheetOf(idx: Awaited<ReturnType<typeof getCatalogIndex>>, a: Pick<Access, "choices" | "details" | "xp">): Sheet | null {
  const choices = choicesSchema.safeParse(a.choices);
  const details = detailsSchema.safeParse(a.details);
  return choices.success && details.success ? evaluateCharacter(idx, choices.data, details.data, a).sheet : null;
}

const negotiationLevel = (sheet: Sheet) => sheet.skills.find((s) => s.slug === "negociacao")?.level ?? 0;

/** Loja de uma mesa: catálogo + os personagens que este usuário pode usar (os seus; o Mestre, todos). */
export async function getShop(tableId: string, userId: string): Promise<ShopView | null> {
  if (!(await isTableMember(tableId, userId))) return null;
  const [catalog, idx, [table], rows] = await Promise.all([
    getCatalog(),
    getCatalogIndex(),
    db.select({ ownerId: gameTables.ownerId }).from(gameTables).where(eq(gameTables.id, tableId)),
    db.select().from(characters).where(eq(characters.tableId, tableId)).orderBy(asc(characters.createdAt)),
  ]);
  const isMaster = table?.ownerId === userId;
  const names = new Map(catalog.equipment.map((e) => [e.slug, e.name]));
  return {
    isMaster,
    items: catalog.equipment,
    characters: rows
      .filter((c) => isMaster || c.ownerId === userId)
      .map((c) => {
        const sheet = sheetOf(idx, c);
        const attrs = sheet && negotiationLevel(sheet) > 0 ? (Object.keys(sheet.attributes) as Attribute[]).filter((k) => sheet.attributes[k] !== null) : [];
        return {
          id: c.id,
          name: c.name,
          money: c.money,
          inventory: c.inventory.filter(isCatalogItem).map((i) => ({ ...i, name: names.get(i.id) ?? i.id })),
          rates: { buy: c.negotiation?.buy ?? DEFAULT_RATES.buy, sell: c.negotiation?.sell ?? DEFAULT_RATES.sell },
          negotiated: { buy: c.negotiation?.buy !== undefined, sell: c.negotiation?.sell !== undefined },
          negotiationAttributes: attrs,
        };
      }),
  };
}

const FORBIDDEN: CharacterResult = { ok: false, errors: ["Você não pode usar este personagem."] };
const ok = (id: string): CharacterResult => ({ ok: true, id });
const fail = (message: string): CharacterResult => ({ ok: false, errors: [message] });

async function save(id: string, change: Partial<{ money: number; inventory: InventoryItem[]; negotiation: Negotiation | null }>) {
  await db.update(characters).set(change).where(eq(characters.id, id));
  return ok(id);
}


async function itemById(itemId: string) {
  return (await getCatalog()).equipment.find((e) => e.slug === itemId) ?? null;
}

/** Rola 2d6 + atributo escolhido + Negociação (pp. 182-183), guarda a % e mostra no chat. Uma rolagem para compra e outra para venda. */
export async function negotiate(characterId: string, userId: string, kind: "buy" | "sell", attribute: Attribute): Promise<CharacterResult> {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return FORBIDDEN;
  const sheet = sheetOf(await getCatalogIndex(), a);
  const level = sheet ? negotiationLevel(sheet) : 0;
  const value = sheet?.attributes[attribute];
  if (!sheet || level === 0) return fail("O personagem não tem a perícia Negociação.");
  if (value === null || value === undefined) return fail("Atributo inválido.");
  if (a.negotiation?.[kind] !== undefined) return fail("Já negociou nesta Loja (o livro não permite repetir o teste).");

  const roll = rollDice({ sides: 6, count: 2 });
  const total = roll.total + value + level;
  const percent = negotiationRates(total)[kind];
  const label = kind === "buy" ? `a compra → paga ${percent}% do preço` : `a venda → recebe ${percent}% do preço`;
  await sendChatMessage(a.tableId, userId, `${a.name} negociou ${label}. Negociação (${attribute}): 2d6 (${roll.rolls.join(" + ")}) + ${value + level} = ${total}.`);
  return save(characterId, { negotiation: { ...a.negotiation, [kind]: percent } });
}

/** Fechou a Loja: a próxima negociação é outra rolagem. */
export async function endNegotiation(characterId: string, userId: string): Promise<CharacterResult> {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return FORBIDDEN;
  return a.negotiation ? save(characterId, { negotiation: null }) : ok(characterId);
}

export async function buy(characterId: string, userId: string, itemId: string): Promise<CharacterResult> {
  const [a, item] = await Promise.all([loadAccess(characterId, userId), itemById(itemId)]);
  if (!a || !canManage(a)) return FORBIDDEN;
  if (!item) return fail("Item não encontrado.");
  const cost = priceWith(item.price, 1, a.negotiation?.buy ?? DEFAULT_RATES.buy);
  if (cost > a.money) return fail(`Dinheiro insuficiente (custa ${cost} CO).`);
  return save(characterId, { money: Math.round((a.money - cost) * 10) / 10, inventory: addItem(a.inventory, item.slug, 1) });
}

export async function sell(characterId: string, userId: string, itemId: string): Promise<CharacterResult> {
  const [a, item] = await Promise.all([loadAccess(characterId, userId), itemById(itemId)]);
  if (!a || !canManage(a)) return FORBIDDEN;
  if (!item || !a.inventory.some((i) => isCatalogItem(i) && i.id === itemId)) return fail("O personagem não tem este item.");
  const gain = priceWith(item.price, 1, a.negotiation?.sell ?? DEFAULT_RATES.sell);
  return save(characterId, { money: Math.round((a.money + gain) * 10) / 10, inventory: removeOne(a.inventory, itemId) });
}

/** Mestre: dar um item de graça. */
export async function giveItem(characterId: string, userId: string, itemId: string): Promise<CharacterResult> {
  const [a, item] = await Promise.all([loadAccess(characterId, userId), itemById(itemId)]);
  if (!a?.isMaster) return fail("Só o Mestre dá itens.");
  if (!item) return fail("Item não encontrado.");
  return save(characterId, { inventory: addItem(a.inventory, item.slug, 1) });
}

/** Mestre: tirar um item (sem pagar nada). */
export async function takeItem(characterId: string, userId: string, itemId: string): Promise<CharacterResult> {
  const a = await loadAccess(characterId, userId);
  if (!a?.isMaster) return fail("Só o Mestre tira itens.");
  return save(characterId, { inventory: removeOne(a.inventory, itemId) });
}

/** Mestre: definir o dinheiro do personagem. */
export async function setMoney(characterId: string, userId: string, money: number): Promise<CharacterResult> {
  const a = await loadAccess(characterId, userId);
  if (!a?.isMaster) return fail("Só o Mestre altera o dinheiro.");
  if (!Number.isFinite(money) || money < 0 || money > 1_000_000) return fail("Valor inválido.");
  return save(characterId, { money: Math.round(money * 10) / 10 });
}
