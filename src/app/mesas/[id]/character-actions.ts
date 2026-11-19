"use server";

import { requireUser } from "@/lib/auth/session";
import { getCatalog, getCatalogForWizard } from "@/lib/catalog/db";
import type { Catalog } from "@/lib/catalog/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createCharacter,
  createCharacterNote,
  chooseAdvance,
  deleteCharacter,
  editInventory,
  deleteCharacterNote,
  getCharacter,
  getDossier,
  getManageableTable,
  isTableMember,
  listCharacters,
  setCharacterImage,
  updateCharacterDetails,
  updateCharacterNote,
  updateCharacterState,
  type CharacterResult,
  type CharacterSummary,
  type CharacterView,
  type Dossier,
} from "@/lib/mesas/characters";
import { characterIdSchema } from "@/lib/mesas/character-schemas";
import { imageFileError, mesaIdSchema } from "@/lib/mesas/schemas";

// O cliente só apresenta opções e envia escolhas; quem decide se são válidas, e quem pode ver ou alterar
// o quê, é o backend com o usuário da sessão (src/lib/mesas/characters.ts).

const INVALID: CharacterResult = { ok: false, errors: ["Pedido inválido."] };
const IMAGE_BUCKET = "character-images";

/** Catálogo para o assistente de criação (só para quem participa da mesa). */
export async function getWizardCatalogAction(tableId: string): Promise<Catalog | null> {
  const user = await requireUser();
  const parsed = mesaIdSchema.safeParse(tableId);
  if (!parsed.success || !(await isTableMember(parsed.data, user.id))) return null;
  return getCatalogForWizard();
}

export async function createCharacterAction(tableId: string, choices: unknown, details: unknown): Promise<CharacterResult> {
  const user = await requireUser();
  const parsed = mesaIdSchema.safeParse(tableId);
  if (!parsed.success) return INVALID;
  return createCharacter(parsed.data, user.id, choices, details);
}

export async function listCharactersAction(tableId: string): Promise<CharacterSummary[] | null> {
  const user = await requireUser();
  const parsed = mesaIdSchema.safeParse(tableId);
  if (!parsed.success) return null;
  return listCharacters(parsed.data, user.id);
}

/** Dossiê (prévia): qualquer participante da mesa. */
export async function getDossierAction(characterId: string): Promise<Dossier | null> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  return parsed.success ? getDossier(parsed.data, user.id) : null;
}

/** Ficha completa: só o dono e o Mestre (senão, null). */
export async function getCharacterAction(characterId: string): Promise<CharacterView | null> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  return parsed.success ? getCharacter(parsed.data, user.id) : null;
}

export async function updateCharacterDetailsAction(characterId: string, details: unknown): Promise<CharacterResult> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  return parsed.success ? updateCharacterDetails(parsed.data, user.id, details) : INVALID;
}

export async function updateCharacterStateAction(characterId: string, state: unknown): Promise<CharacterResult> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  return parsed.success ? updateCharacterState(parsed.data, user.id, state) : INVALID;
}

export async function createCharacterNoteAction(characterId: string, note: unknown): Promise<CharacterResult> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  return parsed.success ? createCharacterNote(parsed.data, user.id, note) : INVALID;
}

export async function updateCharacterNoteAction(characterId: string, noteId: string, note: unknown): Promise<CharacterResult> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  return parsed.success ? updateCharacterNote(parsed.data, noteId, user.id, note) : INVALID;
}

export async function deleteCharacterNoteAction(characterId: string, noteId: string): Promise<CharacterResult> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  return parsed.success ? deleteCharacterNote(parsed.data, noteId, user.id) : INVALID;
}

export type ImageResult = { ok: true; imageUrl: string | null } | { ok: false; message: string };

/**
 * Envia a imagem como o próprio usuário (a policy de storage.objects, que só deixa o dono do personagem e
 * o Mestre escreverem, é a segunda trava). Caminho fixo: trocar sobrescreve, nunca acumula arquivos.
 */
export async function uploadCharacterImageAction(characterId: string, formData: FormData): Promise<ImageResult> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  const file = formData.get("file");
  if (!parsed.success || !(file instanceof File) || file.size === 0) return { ok: false, message: "Escolha uma imagem." };
  const fileError = imageFileError(file);
  if (fileError) return { ok: false, message: fileError };
  const tableId = await getManageableTable(parsed.data, user.id);
  if (!tableId) return { ok: false, message: "Você não pode alterar este personagem." };

  const supabase = await createSupabaseServerClient();
  const path = `${tableId}/${parsed.data}/image`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { ok: false, message: "Não foi possível enviar a imagem." };
  const {
    data: { publicUrl },
  } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  // O caminho não muda ao trocar a imagem; sem isto o navegador serviria a antiga do cache.
  const imageUrl = `${publicUrl}?v=${Date.now()}`;
  return (await setCharacterImage(parsed.data, user.id, imageUrl)) ? { ok: true, imageUrl } : { ok: false, message: "Não foi possível salvar." };
}

export async function removeCharacterImageAction(characterId: string): Promise<ImageResult> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  if (!parsed.success) return { ok: false, message: "Pedido inválido." };
  const tableId = await getManageableTable(parsed.data, user.id);
  if (!tableId) return { ok: false, message: "Você não pode alterar este personagem." };

  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(IMAGE_BUCKET).remove([`${tableId}/${parsed.data}/image`]);
  return (await setCharacterImage(parsed.data, user.id, null)) ? { ok: true, imageUrl: null } : { ok: false, message: "Não foi possível salvar." };
}

/** Exclui o personagem e a imagem dele. A imagem sai antes: a policy do Storage confere o personagem no banco. */
export async function deleteCharacterAction(characterId: string): Promise<CharacterResult> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  if (!parsed.success) return INVALID;
  const tableId = await getManageableTable(parsed.data, user.id);
  if (!tableId) return { ok: false, errors: ["Você não pode excluir este personagem."] };
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(IMAGE_BUCKET).remove([`${tableId}/${parsed.data}/image`]);
  return deleteCharacter(parsed.data, user.id);
}

/** Inventário e dinheiro pela aba Equipamentos (dono ou Mestre). */
export async function editInventoryAction(characterId: string, op: unknown): Promise<CharacterResult> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  return parsed.success ? editInventory(parsed.data, user.id, op) : INVALID;
}

export async function chooseAdvanceAction(characterId: string, advance: unknown): Promise<CharacterResult> {
  const user = await requireUser();
  const parsed = characterIdSchema.safeParse(characterId);
  return parsed.success ? chooseAdvance(parsed.data, user.id, advance) : INVALID;
}

/** Nomes da Lista de Preços para adicionar um item achado na aventura (só quem está logado). */
export async function listEquipmentNamesAction(): Promise<{ slug: string; name: string }[]> {
  await requireUser();
  return (await getCatalog()).equipment.map((e) => ({ slug: e.slug, name: e.name }));
}
