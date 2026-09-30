"use server";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearAllChat, clearMyChat, sendChatMessage } from "@/lib/mesas/chat";
import {
  createToken,
  deleteToken,
  moveToken,
  updateSceneBackground,
  updateSceneGridSize,
} from "@/lib/mesas/queries";
import {
  chatMessageSchema,
  createTokenSchema,
  gridSizeSchema,
  imageFileError,
  mesaIdSchema,
  moveTokenSchema,
} from "@/lib/mesas/schemas";

// Chamadas diretamente pelo Canvas (cliente), não por <form>: a permissão
// (só o Mestre) é sempre checada de novo no backend antes de qualquer
// escrita, nunca só pela interface (CLAUDE.md §17).

export async function createTokenAction(
  sceneId: string,
  input: { label: string; color?: string; x?: number; y?: number },
) {
  const user = await requireUser();
  const parsedScene = mesaIdSchema.safeParse(sceneId);
  const parsed = createTokenSchema.safeParse(input);
  if (!parsedScene.success || !parsed.success) notFound();

  const token = await createToken(parsedScene.data, user.id, parsed.data);
  return token ? { ok: true as const } : { ok: false as const };
}

export async function moveTokenAction(input: { tokenId: string; x: number; y: number }) {
  const user = await requireUser();
  const parsed = moveTokenSchema.safeParse(input);
  if (!parsed.success) notFound();

  const ok = await moveToken(parsed.data.tokenId, user.id, parsed.data.x, parsed.data.y);
  return { ok };
}

export async function deleteTokenAction(tokenId: string) {
  const user = await requireUser();
  const parsed = mesaIdSchema.safeParse(tokenId);
  if (!parsed.success) notFound();

  const ok = await deleteToken(parsed.data, user.id);
  return { ok };
}

export async function updateGridSizeAction(sceneId: string, gridSize: number) {
  const user = await requireUser();
  const parsedScene = mesaIdSchema.safeParse(sceneId);
  const parsedSize = gridSizeSchema.safeParse(gridSize);
  if (!parsedScene.success || !parsedSize.success) return { ok: false as const };

  const ok = await updateSceneGridSize(parsedScene.data, user.id, parsedSize.data);
  return { ok };
}

export async function sendChatMessageAction(tableId: string, content: string) {
  const user = await requireUser();
  const parsedTable = mesaIdSchema.safeParse(tableId);
  const parsedContent = chatMessageSchema.safeParse(content);
  if (!parsedTable.success || !parsedContent.success) return { ok: false as const };

  const message = await sendChatMessage(parsedTable.data, user.id, parsedContent.data);
  return message ? { ok: true as const, message } : { ok: false as const };
}

export async function clearMyChatAction(tableId: string) {
  const user = await requireUser();
  const parsedTable = mesaIdSchema.safeParse(tableId);
  if (!parsedTable.success) return { ok: false as const };

  const clearedAt = await clearMyChat(parsedTable.data, user.id);
  return clearedAt ? { ok: true as const, clearedAt } : { ok: false as const };
}

export async function clearAllChatAction(tableId: string) {
  const user = await requireUser();
  const parsedTable = mesaIdSchema.safeParse(tableId);
  if (!parsedTable.success) return { ok: false as const };

  return { ok: await clearAllChat(parsedTable.data, user.id) };
}

const BACKGROUND_BUCKET = "scene-backgrounds";

/**
 * Envia como o próprio usuário (não com uma chave privilegiada): quem pode
 * escrever no bucket é decidido pelas policies de storage.objects (só o
 * Mestre da mesa, ver migration 0004), não por este código.
 */
export async function uploadSceneBackgroundAction(
  sceneId: string,
  tableId: string,
  formData: FormData,
): Promise<{ ok: boolean; url?: string; message?: string }> {
  const user = await requireUser();
  const parsedScene = mesaIdSchema.safeParse(sceneId);
  const parsedTable = mesaIdSchema.safeParse(tableId);
  const file = formData.get("file");
  if (!parsedScene.success || !parsedTable.success || !(file instanceof File)) {
    return { ok: false, message: "Arquivo inválido." };
  }
  const fileError = imageFileError(file);
  if (fileError) return { ok: false, message: fileError };

  const supabase = await createSupabaseServerClient();
  // Caminho fixo por mesa: cada envio sobrescreve o anterior (upsert), nunca
  // acumula arquivos — "um ou nenhum" fundo por cena.
  const path = `${parsedTable.data}/background`;
  const { error: uploadError } = await supabase.storage
    .from(BACKGROUND_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) {
    return { ok: false, message: "Não foi possível enviar a imagem." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BACKGROUND_BUCKET).getPublicUrl(path);
  // O caminho não muda entre envios; sem isso o navegador serviria a imagem
  // antiga do cache mesmo depois de trocada.
  const url = `${publicUrl}?v=${Date.now()}`;

  const ok = await updateSceneBackground(parsedScene.data, user.id, url);
  return ok ? { ok: true, url } : { ok: false, message: "Não foi possível salvar." };
}
