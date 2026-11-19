// Inventário do personagem: itens da Lista de Preços (por id) e itens de texto (bens fora da lista).
import type { Career, KitEntry } from "@/lib/catalog/schemas";
import type { InventoryItem } from "@/lib/db/schema";
import type { CharacterChoices } from "./character";

export type CatalogItem = Extract<InventoryItem, { id: string }>;
export type CustomItem = Extract<InventoryItem, { custom: string }>;

export const isCatalogItem = (i: InventoryItem): i is CatalogItem => "id" in i;
/** Chave única de uma linha do inventário. */
export const itemKey = (i: InventoryItem) => (isCatalogItem(i) ? i.id : i.custom);

/** Soma `qty` de um item da Lista de Preços (junta com o que já tem). */
export function addItem(inventory: InventoryItem[], id: string, qty: number): InventoryItem[] {
  const has = inventory.some((i) => isCatalogItem(i) && i.id === id);
  return has ? inventory.map((i) => (isCatalogItem(i) && i.id === id ? { ...i, qty: i.qty + qty } : i)) : [...inventory, { id, qty }];
}

/** Tira uma unidade da linha `key` (some quando chega a zero). */
export const removeOne = (inventory: InventoryItem[], key: string) =>
  inventory.map((i) => (itemKey(i) === key ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0);

/** Escolhas de bens que a carreira exige (ex.: Pistoleiro: canhão de mão ou par de pistolas). */
export const gearChoices = (career: Career) => career.initial.gear?.choices ?? [];

/**
 * Bens iniciais das carreiras (livro), já com as opções escolhidas. `newId` gera a chave dos itens de texto.
 * Opção inválida ou faltando = erro (o backend recusa a criação).
 */
export function startingInventory(
  careers: Map<string, Career>,
  picks: CharacterChoices["careers"],
  newId: () => string,
): { inventory: InventoryItem[]; errors: string[] } {
  let inventory: InventoryItem[] = [];
  const errors: string[] = [];
  const add = (k: KitEntry) => {
    if ("item" in k) inventory = addItem(inventory, k.item, k.qty);
    else inventory.push({ custom: newId(), name: k.text, description: "", qty: k.qty });
  };
  for (const pick of picks) {
    const career = careers.get(pick.career);
    if (!career) continue;
    career.initial.gear?.kit?.forEach(add);
    gearChoices(career).forEach((choice, i) => {
      const option = choice.options[pick.gear?.[i] ?? -1];
      if (option) option.kit.forEach(add);
      else errors.push(`${career.name}: escolha ${choice.label.toLowerCase()}.`);
    });
  }
  return { inventory, errors };
}
