"use server";

import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createInfo,
  deleteInfo,
  getEditableInfo,
  listInfosForMember,
  setInfoHidden,
  updateInfo,
} from "@/lib/mesas/infos";
import type { InfoView } from "@/lib/mesas/info-rules";
import { imageFileError, infoDescriptionSchema, infoNameSchema, mesaIdSchema } from "@/lib/mesas/schemas";

// Quem pode o quê é decidido em src/lib/mesas/infos.ts (e info-rules.ts), sempre
// com o usuário da sessão. Toda escrita devolve a lista já atualizada para o
// autor (uma ida à rede só); os outros participantes recebem um aviso
// "mudou" e buscam a própria lista, filtrada para o papel deles — infos
// ocultas nunca trafegam pelo canal em tempo real.

export type InfoActionResult = { ok: true; infos: InfoView[] } | { ok: false; message: string };

const INFO_BUCKET = "info-images";
const NOT_ALLOWED = "Você não tem permissão para isso.";

function fail(message: string): InfoActionResult {
  return { ok: false, message };
}

async function currentList(tableId: string, userId: string): Promise<InfoActionResult> {
  const infos = await listInfosForMember(tableId, userId);
  return infos ? { ok: true, infos } : fail(NOT_ALLOWED);
}

function imagePath(tableId: string, infoId: string) {
  return `${tableId}/${infoId}`;
}

/** Envia como o próprio usuário: quem pode escrever no bucket são as policies de storage.objects (só o Mestre). */
async function uploadInfoImage(tableId: string, infoId: string, file: File) {
  const supabase = await createSupabaseServerClient();
  const path = imagePath(tableId, infoId);
  const { error } = await supabase.storage.from(INFO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) return null;
  const {
    data: { publicUrl },
  } = supabase.storage.from(INFO_BUCKET).getPublicUrl(path);
  // O caminho não muda ao trocar a imagem; sem isso o navegador serviria a antiga do cache.
  return `${publicUrl}?v=${Date.now()}`;
}

async function removeInfoImage(tableId: string, infoId: string) {
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(INFO_BUCKET).remove([imagePath(tableId, infoId)]);
}

export async function listInfosAction(tableId: string): Promise<InfoView[] | null> {
  const user = await requireUser();
  const parsedTable = mesaIdSchema.safeParse(tableId);
  if (!parsedTable.success) return null;
  return listInfosForMember(parsedTable.data, user.id);
}

export async function createNoteInfoAction(
  tableId: string,
  input: { name: string; description: string },
): Promise<InfoActionResult> {
  const user = await requireUser();
  const parsedTable = mesaIdSchema.safeParse(tableId);
  const name = infoNameSchema.safeParse(input.name);
  const description = infoDescriptionSchema.safeParse(input.description);
  if (!parsedTable.success) return fail(NOT_ALLOWED);
  if (!name.success) return fail(name.error.issues[0]?.message ?? "Nome inválido.");
  if (!description.success) return fail(description.error.issues[0]?.message ?? "Descrição inválida.");

  const created = await createInfo(parsedTable.data, user.id, {
    kind: "note",
    name: name.data,
    description: description.data,
    imageUrl: null,
  });
  return created ? currentList(parsedTable.data, user.id) : fail(NOT_ALLOWED);
}

export async function createImageInfoAction(tableId: string, formData: FormData): Promise<InfoActionResult> {
  const user = await requireUser();
  const parsedTable = mesaIdSchema.safeParse(tableId);
  const name = infoNameSchema.safeParse(formData.get("name"));
  const file = formData.get("file");
  if (!parsedTable.success) return fail(NOT_ALLOWED);
  if (!name.success) return fail(name.error.issues[0]?.message ?? "Nome inválido.");
  if (!(file instanceof File) || file.size === 0) return fail("Escolha uma imagem.");
  const fileError = imageFileError(file);
  if (fileError) return fail(fileError);

  // O id nasce aqui porque o caminho da imagem no Storage usa o id da info.
  const infoId = randomUUID();
  const imageUrl = await uploadInfoImage(parsedTable.data, infoId, file);
  if (!imageUrl) return fail("Não foi possível enviar a imagem.");

  const created = await createInfo(parsedTable.data, user.id, {
    id: infoId,
    kind: "image",
    name: name.data,
    description: null,
    imageUrl,
  });
  if (!created) {
    await removeInfoImage(parsedTable.data, infoId);
    return fail(NOT_ALLOWED);
  }
  return currentList(parsedTable.data, user.id);
}

export async function updateNoteInfoAction(
  infoId: string,
  input: { name: string; description: string },
): Promise<InfoActionResult> {
  const user = await requireUser();
  const parsedInfo = mesaIdSchema.safeParse(infoId);
  const name = infoNameSchema.safeParse(input.name);
  const description = infoDescriptionSchema.safeParse(input.description);
  if (!parsedInfo.success) return fail(NOT_ALLOWED);
  if (!name.success) return fail(name.error.issues[0]?.message ?? "Nome inválido.");
  if (!description.success) return fail(description.error.issues[0]?.message ?? "Descrição inválida.");

  const target = await getEditableInfo(parsedInfo.data, user.id);
  if (!target || target.kind !== "note") return fail(NOT_ALLOWED);
  const updated = await updateInfo(parsedInfo.data, user.id, { name: name.data, description: description.data });
  return updated ? currentList(target.tableId, user.id) : fail(NOT_ALLOWED);
}

/** Nome sempre; imagem só se enviada outra (senão fica a atual). */
export async function updateImageInfoAction(infoId: string, formData: FormData): Promise<InfoActionResult> {
  const user = await requireUser();
  const parsedInfo = mesaIdSchema.safeParse(infoId);
  const name = infoNameSchema.safeParse(formData.get("name"));
  const file = formData.get("file");
  if (!parsedInfo.success) return fail(NOT_ALLOWED);
  if (!name.success) return fail(name.error.issues[0]?.message ?? "Nome inválido.");

  const target = await getEditableInfo(parsedInfo.data, user.id);
  if (!target || target.kind !== "image") return fail(NOT_ALLOWED);

  let imageUrl: string | undefined;
  if (file instanceof File && file.size > 0) {
    const fileError = imageFileError(file);
    if (fileError) return fail(fileError);
    imageUrl = (await uploadInfoImage(target.tableId, target.id, file)) ?? undefined;
    if (!imageUrl) return fail("Não foi possível enviar a imagem.");
  }

  const updated = await updateInfo(parsedInfo.data, user.id, { name: name.data, imageUrl });
  return updated ? currentList(target.tableId, user.id) : fail(NOT_ALLOWED);
}

export async function setInfoHiddenAction(infoId: string, hidden: boolean): Promise<InfoActionResult> {
  const user = await requireUser();
  const parsedInfo = mesaIdSchema.safeParse(infoId);
  if (!parsedInfo.success) return fail(NOT_ALLOWED);

  const target = await getEditableInfo(parsedInfo.data, user.id);
  if (!target) return fail(NOT_ALLOWED);
  const updated = await setInfoHidden(parsedInfo.data, user.id, hidden);
  return updated ? currentList(target.tableId, user.id) : fail(NOT_ALLOWED);
}

export async function deleteInfoAction(infoId: string): Promise<InfoActionResult> {
  const user = await requireUser();
  const parsedInfo = mesaIdSchema.safeParse(infoId);
  if (!parsedInfo.success) return fail(NOT_ALLOWED);

  const deleted = await deleteInfo(parsedInfo.data, user.id);
  if (!deleted) return fail(NOT_ALLOWED);
  if (deleted.kind === "image") await removeInfoImage(deleted.tableId, deleted.id);
  return currentList(deleted.tableId, user.id);
}
