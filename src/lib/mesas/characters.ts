import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, gameTableMembers, gameTables, profiles, type CharacterNote, type InventoryItem, type Negotiation } from "@/lib/db/schema";
import { getCatalog, getCatalogIndex } from "@/lib/catalog/db";
import type { Equipment } from "@/lib/catalog/schemas";
import type { ActionCost } from "@/lib/catalog/schemas";
import {
  actionRows,
  clampMarks,
  evaluateCharacter,
  nextAdvance,
  pendingAdvances,
  spiralBranches,
  validActionsUsed,
  type ActionRow,
  type CharacterDetails,
  type CharacterSheet,
} from "@/lib/engine/character";
import { addItem, isCatalogItem, itemKey, startingInventory } from "@/lib/engine/inventory";
import { advanceSchema, characterStateSchema, inventoryOpSchema, choicesSchema, detailsSchema, noteSchema } from "./character-schemas";

// Mesma regra do resto de mesas/: o backend usa a conexão privilegiada (ignora RLS), então
// "participa?", "é o dono?" e "é o Mestre?" são checados aqui.
//   - Dossiê (nome, imagem, dados pessoais): todo participante da mesa.
//   - Ficha completa, notas, estado de jogo e edição: só o dono do personagem e o Mestre.

export type CharacterSummary = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  imageUrl: string | null;
  race: string;
  archetype: string;
  careers: string[];
};

export type CharacterResult = { ok: true; id: string } | { ok: false; errors: string[] };

export async function isTableMember(tableId: string, userId: string) {
  const [row] = await db
    .select({ userId: gameTableMembers.userId })
    .from(gameTableMembers)
    .where(and(eq(gameTableMembers.tableId, tableId), eq(gameTableMembers.userId, userId)))
    .limit(1);
  return !!row;
}

export type Access = {
  id: string;
  tableId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  imageUrl: string | null;
  choices: unknown;
  details: unknown;
  state: unknown;
  notes: CharacterNote[];
  xp: number;
  money: number;
  inventory: InventoryItem[];
  negotiation: Negotiation | null;
  isOwner: boolean;
  isMaster: boolean;
};

/** Personagem + o papel do usuário nele. Null se não existe ou o usuário não participa da mesa. */
export async function loadAccess(characterId: string, userId: string): Promise<Access | null> {
  const [row] = await db
    .select({
      id: characters.id,
      tableId: characters.tableId,
      ownerId: characters.ownerId,
      ownerName: profiles.displayName,
      name: characters.name,
      imageUrl: characters.imageUrl,
      choices: characters.choices,
      details: characters.details,
      state: characters.state,
      notes: characters.notes,
      xp: characters.xp,
      money: characters.money,
      inventory: characters.inventory,
      negotiation: characters.negotiation,
      tableOwnerId: gameTables.ownerId,
    })
    .from(characters)
    .innerJoin(gameTables, eq(characters.tableId, gameTables.id))
    .innerJoin(profiles, eq(characters.ownerId, profiles.id))
    .innerJoin(gameTableMembers, and(eq(gameTableMembers.tableId, characters.tableId), eq(gameTableMembers.userId, userId)))
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!row) return null;
  const { tableOwnerId, ...rest } = row;
  return { ...rest, isOwner: row.ownerId === userId, isMaster: tableOwnerId === userId };
}

export const canManage = (a: Access) => a.isOwner || a.isMaster;

/** Lista leve (nome, dono, raça, arquétipo, carreiras). Null se não participa da mesa. */
export async function listCharacters(tableId: string, userId: string): Promise<CharacterSummary[] | null> {
  if (!(await isTableMember(tableId, userId))) return null;
  const [rows, idx] = await Promise.all([
    db
      .select({ id: characters.id, name: characters.name, ownerId: characters.ownerId, ownerName: profiles.displayName, imageUrl: characters.imageUrl, choices: characters.choices })
      .from(characters)
      .innerJoin(profiles, eq(characters.ownerId, profiles.id))
      .where(eq(characters.tableId, tableId))
      .orderBy(asc(characters.createdAt)),
    getCatalogIndex(),
  ]);
  return rows.map((r) => {
    const c = choicesSchema.safeParse(r.choices);
    return {
      id: r.id,
      name: r.name,
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      imageUrl: r.imageUrl,
      race: c.success ? (idx.races.get(c.data.race)?.name ?? "?") : "?",
      archetype: c.success ? (idx.archetypes.get(c.data.archetype)?.name ?? "?") : "?",
      careers: c.success ? c.data.careers.map((p) => idx.careers.get(p.career)?.name ?? "?") : [],
    };
  });
}

// ---------- dossiê (público na mesa) ----------

export type Dossier = {
  id: string;
  tableId: string;
  name: string;
  imageUrl: string | null;
  ownerName: string;
  /** Só o dono e o Mestre abrem a ficha; os outros veem apenas o dossiê. */
  canOpenSheet: boolean;
  personal: Pick<CharacterDetails, "age" | "nationality" | "filiation" | "organization" | "height" | "weight" | "crimes">;
};

export async function getDossier(characterId: string, userId: string): Promise<Dossier | null> {
  const a = await loadAccess(characterId, userId);
  if (!a) return null;
  const d = detailsSchema.safeParse(a.details);
  const p = d.success ? d.data : detailsSchema.parse({});
  return {
    id: a.id,
    tableId: a.tableId,
    name: a.name,
    imageUrl: a.imageUrl,
    ownerName: a.ownerName,
    canOpenSheet: canManage(a),
    personal: { age: p.age, nationality: p.nationality, filiation: p.filiation, organization: p.organization, height: p.height, weight: p.weight, crimes: p.crimes },
  };
}

// ---------- ficha (dono e Mestre) ----------

export type CharacterView = {
  id: string;
  tableId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  imageUrl: string | null;
  /** O Mestre abrindo a ficha de um jogador (ele também edita). */
  isMaster: boolean;
  /** Null se o catálogo mudou e as escolhas guardadas deixaram de ser válidas. */
  sheet: CharacterSheet | null;
  /** Dano marcado em cada ramo da espiral vital (6 números). */
  marks: number[];
  actionsUsed: ActionCost[];
  /** Ações do livro com o custo que valem para este personagem (habilidades que dão ação extra específica). */
  actions: ActionRow[];
  notes: CharacterNote[];
  /** Próxima progressão de XP a escolher (null = nenhuma pendente). */
  advance: ReturnType<typeof nextAdvance>;
  money: number;
  /** Inventário já com nome e o que o livro diz de cada item (os de texto têm nome e descrição editáveis). */
  equipment: EquipmentRow[];
};

export type EquipmentRow = {
  key: string;
  qty: number;
  custom: boolean;
  name: string;
  description: string;
  category: Equipment["category"] | null;
  details: Equipment["details"];
  sourcePage: number | null;
};

/** Ficha montada na hora (nada calculado é gravado). Null se não existe, não participa da mesa, ou não é o dono nem o Mestre. */
export async function getCharacter(characterId: string, userId: string): Promise<CharacterView | null> {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return null;

  const [idx, catalog] = await Promise.all([getCatalogIndex(), getCatalog()]);
  const items = new Map(catalog.equipment.map((e) => [e.slug, e]));
  const choices = choicesSchema.safeParse(a.choices);
  const details = detailsSchema.safeParse(a.details);
  const sheet = choices.success && details.success ? evaluateCharacter(idx, choices.data, details.data, a).sheet : null;
  const state = characterStateSchema.safeParse(a.state);
  const marks = sheet ? clampMarks(state.success ? state.data.marks : undefined, spiralBranches(sheet.vitality)) : [0, 0, 0, 0, 0, 0];
  const used = state.success ? (state.data.actionsUsed ?? []) : [];
  return {
    id: a.id,
    tableId: a.tableId,
    ownerId: a.ownerId,
    ownerName: a.ownerName,
    name: a.name,
    imageUrl: a.imageUrl,
    isMaster: a.isMaster,
    sheet,
    marks,
    actionsUsed: validActionsUsed(used) ? used : [],
    actions: sheet ? actionRows(idx, { abilities: sheet.abilities.map((x) => x.slug), benefits: sheet.benefits.map((x) => x.slug) }) : [],
    notes: a.notes,
    advance: choices.success && details.success ? nextAdvance(idx, choices.data, details.data, a) : null,
    money: a.money,
    equipment: a.inventory.map((i): EquipmentRow => {
      const item = isCatalogItem(i) ? items.get(i.id) : undefined;
      return isCatalogItem(i)
        ? { key: i.id, qty: i.qty, custom: false, name: item?.name ?? i.id, description: "", category: item?.category ?? null, details: item?.details ?? null, sourcePage: item?.sourcePage ?? null }
        : { key: i.custom, qty: i.qty, custom: true, name: i.name, description: i.description, category: null, details: null, sourcePage: null };
    }),
  };
}

/** Cria o personagem depois de o engine revalidar cada escolha contra o catálogo. */
export async function createCharacter(tableId: string, userId: string, rawChoices: unknown, rawDetails: unknown): Promise<CharacterResult> {
  if (!(await isTableMember(tableId, userId))) return { ok: false, errors: ["Você não participa desta mesa."] };
  const choices = choicesSchema.safeParse(rawChoices);
  const details = detailsSchema.safeParse(rawDetails);
  if (!choices.success || !details.success) return { ok: false, errors: ["Dados inválidos."] };

  const idx = await getCatalogIndex();
  const { errors, sheet } = evaluateCharacter(idx, choices.data, details.data);
  if (!sheet) return { ok: false, errors: errors.map((e) => e.message) };
  // Bens iniciais das carreiras (com as opções escolhidas) vão direto para o inventário.
  const gear = startingInventory(idx.careers, choices.data.careers, () => crypto.randomUUID());
  if (gear.errors.length) return { ok: false, errors: gear.errors };

  const [row] = await db
    .insert(characters)
    .values({ tableId, ownerId: userId, name: sheet.details.name, choices: choices.data, details: sheet.details, money: sheet.gold, inventory: gear.inventory })
    .returning({ id: characters.id });
  return row ? { ok: true, id: row.id } : { ok: false, errors: ["Não foi possível salvar."] };
}

const FORBIDDEN: CharacterResult = { ok: false, errors: ["Você não pode alterar este personagem."] };

/** Dono e Mestre alteram os detalhes (nome, idade, nacionalidade…). As escolhas da criação não mudam aqui. */
export async function updateCharacterDetails(characterId: string, userId: string, rawDetails: unknown): Promise<CharacterResult> {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return FORBIDDEN;
  const details = detailsSchema.safeParse(rawDetails);
  const choices = choicesSchema.safeParse(a.choices);
  if (!details.success || !choices.success) return { ok: false, errors: ["Dados inválidos."] };

  const { errors, sheet } = evaluateCharacter(await getCatalogIndex(), choices.data, details.data, a);
  if (!sheet) return { ok: false, errors: errors.map((e) => e.message) };
  await db.update(characters).set({ name: sheet.details.name, details: sheet.details, updatedAt: new Date() }).where(eq(characters.id, characterId));
  return { ok: true, id: characterId };
}

/** Mesa do personagem, se o usuário pode alterá-lo (para montar o caminho da imagem no Storage). */
export async function getManageableTable(characterId: string, userId: string): Promise<string | null> {
  const a = await loadAccess(characterId, userId);
  return a && canManage(a) ? a.tableId : null;
}

export async function setCharacterImage(characterId: string, userId: string, imageUrl: string | null): Promise<boolean> {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return false;
  await db.update(characters).set({ imageUrl, updatedAt: new Date() }).where(eq(characters.id, characterId));
  return true;
}

/** Dano marcado e ações gastas no turno. O dano é limitado ao que cada ramo comporta; as ações precisam formar um turno válido. */
export async function updateCharacterState(characterId: string, userId: string, rawState: unknown): Promise<CharacterResult> {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return FORBIDDEN;
  const next = characterStateSchema.safeParse(rawState);
  const choices = choicesSchema.safeParse(a.choices);
  if (!next.success || !choices.success) return { ok: false, errors: ["Dados inválidos."] };
  if (next.data.actionsUsed && !validActionsUsed(next.data.actionsUsed)) return { ok: false, errors: ["Combinação de ações inválida."] };

  const details = detailsSchema.parse(a.details);
  const { sheet } = evaluateCharacter(await getCatalogIndex(), choices.data, details, a);
  if (!sheet) return { ok: false, errors: ["Ficha indisponível."] };
  const previous = characterStateSchema.safeParse(a.state);
  const merged = {
    marks: next.data.marks ? clampMarks(next.data.marks, spiralBranches(sheet.vitality)) : previous.success ? previous.data.marks : undefined,
    actionsUsed: next.data.actionsUsed ?? (previous.success ? previous.data.actionsUsed : undefined),
  };
  await db.update(characters).set({ state: merged }).where(eq(characters.id, characterId));
  return { ok: true, id: characterId };
}

// ---------- notas (lista dentro do próprio personagem) ----------

async function editNotes(characterId: string, userId: string, change: (notes: CharacterNote[]) => CharacterNote[] | string): Promise<CharacterResult> {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return FORBIDDEN;
  const next = change(a.notes);
  if (typeof next === "string") return { ok: false, errors: [next] };
  await db.update(characters).set({ notes: next }).where(eq(characters.id, characterId));
  return { ok: true, id: characterId };
}

export async function createCharacterNote(characterId: string, userId: string, raw: unknown): Promise<CharacterResult> {
  const note = noteSchema.safeParse(raw);
  if (!note.success) return { ok: false, errors: note.error.issues.map((i) => i.message) };
  const id = crypto.randomUUID();
  const result = await editNotes(characterId, userId, (notes) => [{ id, ...note.data }, ...notes]);
  return result.ok ? { ok: true, id } : result;
}

export async function updateCharacterNote(characterId: string, noteId: string, userId: string, raw: unknown): Promise<CharacterResult> {
  const note = noteSchema.safeParse(raw);
  if (!note.success) return { ok: false, errors: note.error.issues.map((i) => i.message) };
  return editNotes(characterId, userId, (notes) =>
    notes.some((n) => n.id === noteId) ? notes.map((n) => (n.id === noteId ? { id: noteId, ...note.data } : n)) : "Nota não encontrada.",
  );
}

export async function deleteCharacterNote(characterId: string, noteId: string, userId: string): Promise<CharacterResult> {
  return editNotes(characterId, userId, (notes) => notes.filter((n) => n.id !== noteId));
}

/** Exclui o personagem (dono ou Mestre). As notas, o dinheiro e o inventário estão na própria linha e vão junto. */
export async function deleteCharacter(characterId: string, userId: string): Promise<CharacterResult> {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return FORBIDDEN;
  await db.delete(characters).where(eq(characters.id, characterId));
  return { ok: true, id: a.tableId };
}

// ---------- inventário e dinheiro (aba Equipamentos) ----------

/**
 * Dono e Mestre mexem no inventário e no dinheiro direto da ficha (o que se acha na aventura, o que se gasta fora
 * da Loja). Itens da Lista de Preços pelo id; itens de texto com nome e descrição livres.
 */
export async function editInventory(characterId: string, userId: string, raw: unknown): Promise<CharacterResult> {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return FORBIDDEN;
  const op = inventoryOpSchema.safeParse(raw);
  if (!op.success) return { ok: false, errors: op.error.issues.map((i) => i.message) };
  const o = op.data;
  if (o.type === "money") {
    await db.update(characters).set({ money: Math.round(o.money * 10) / 10 }).where(eq(characters.id, characterId));
    return { ok: true, id: characterId };
  }
  let inventory = a.inventory;
  if (o.type === "add-catalog") {
    if (!(await getCatalog()).equipment.some((e) => e.slug === o.id)) return { ok: false, errors: ["Item não encontrado na Lista de Preços."] };
    inventory = addItem(inventory, o.id, o.qty);
  } else if (o.type === "add-custom") {
    inventory = [...inventory, { custom: crypto.randomUUID(), name: o.name, description: o.description, qty: o.qty }];
  } else {
    if (!inventory.some((i) => itemKey(i) === o.key)) return { ok: false, errors: ["Item não encontrado."] };
    inventory =
      o.type === "qty"
        ? inventory.map((i) => (itemKey(i) === o.key ? { ...i, qty: o.qty } : i)).filter((i) => i.qty > 0)
        : inventory.map((i) => (!isCatalogItem(i) && i.custom === o.key ? { ...i, name: o.name, description: o.description } : i));
  }
  await db.update(characters).set({ inventory }).where(eq(characters.id, characterId));
  return { ok: true, id: characterId };
}

// ---------- progressão por XP ----------

/** Dono ou Mestre escolhe a próxima progressão liberada pelo XP. O motor confere as regras antes de gravar. */
export async function chooseAdvance(characterId: string, userId: string, raw: unknown): Promise<CharacterResult> {
  const a = await loadAccess(characterId, userId);
  if (!a || !canManage(a)) return FORBIDDEN;
  const advance = advanceSchema.safeParse(raw);
  const choices = choicesSchema.safeParse(a.choices);
  const details = detailsSchema.safeParse(a.details);
  if (!advance.success || !choices.success || !details.success) return { ok: false, errors: ["Dados inválidos."] };
  const idx = await getCatalogIndex();
  // Na ordem da tabela: só a próxima pendente.
  if (pendingAdvances(idx, choices.data, a)[0]?.xp !== advance.data.xp) return { ok: false, errors: ["Escolha a próxima progressão da tabela."] };
  const next = { ...choices.data, advances: [...(choices.data.advances ?? []), advance.data] };
  const { errors } = evaluateCharacter(idx, next, details.data, a);
  if (errors.length) return { ok: false, errors: errors.map((e) => e.message) };
  await db.update(characters).set({ choices: next, updatedAt: new Date() }).where(eq(characters.id, characterId));
  return { ok: true, id: characterId };
}
