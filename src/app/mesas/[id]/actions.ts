"use server";

import { notFound } from "next/navigation";
import { z } from "zod";
import { listTokens, placeToken, removeToken } from "@/lib/mesas/tokens";
import { endCombat, endTurn, startCombat } from "@/lib/mesas/combat";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearAllChat, clearMyChat, sendChatMessage } from "@/lib/mesas/chat";
import {
  updateSceneBackground,
  updateSceneGridSize,
} from "@/lib/mesas/queries";
import {
  chatMessageSchema,
  gridSizeSchema,
  imageFileError,
  mesaIdSchema,
} from "@/lib/mesas/schemas";

// Chamadas diretamente pelo Canvas (cliente), não por <form>: a permissão
// (só o Mestre) é sempre checada de novo no backend antes de qualquer
// escrita, nunca só pela interface (CLAUDE.md §17).

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

/** Remove o fundo: apaga o arquivo do Storage (policy: só o Mestre) e volta o mapa ao grid normal. */
export async function removeSceneBackgroundAction(sceneId: string, tableId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsedScene = mesaIdSchema.safeParse(sceneId);
  const parsedTable = mesaIdSchema.safeParse(tableId);
  if (!parsedScene.success || !parsedTable.success) return { ok: false };
  if (!(await updateSceneBackground(parsedScene.data, user.id, null))) return { ok: false };
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(BACKGROUND_BUCKET).remove([`${parsedTable.data}/background`]);
  return { ok: true };
}

const cellSchema = z.number().int().min(0).max(200);

export async function listTokensAction(sceneId: string) {
  const user = await requireUser();
  const parsed = mesaIdSchema.safeParse(sceneId);
  return parsed.success ? listTokens(parsed.data, user.id) : null;
}

/** Coloca/move o personagem numa casa do mapa (dono ou Mestre). */
export async function placeTokenAction(sceneId: string, characterId: string, x: number, y: number) {
  const user = await requireUser();
  const ids = z.object({ sceneId: z.uuid(), characterId: z.uuid(), x: cellSchema, y: cellSchema }).safeParse({ sceneId, characterId, x, y });
  return ids.success ? placeToken(ids.data.sceneId, ids.data.characterId, user.id, ids.data.x, ids.data.y) : false;
}

export async function removeTokenAction(sceneId: string, characterId: string) {
  const user = await requireUser();
  const ids = z.object({ sceneId: z.uuid(), characterId: z.uuid() }).safeParse({ sceneId, characterId });
  return ids.success ? removeToken(ids.data.sceneId, ids.data.characterId, user.id) : false;
}

/** Combate da cena (iniciar e encerrar: Mestre; encerrar turno: dono do personagem da vez ou Mestre). */
export async function combatAction(sceneId: string, action: "start" | "end-turn" | "end") {
  const user = await requireUser();
  const parsed = z.uuid().safeParse(sceneId);
  if (!parsed.success) return { ok: false as const, error: "Pedido inválido." };
  const run = action === "start" ? startCombat : action === "end-turn" ? endTurn : action === "end" ? endCombat : null;
  return run ? run(parsed.data, user.id) : { ok: false as const, error: "Pedido inválido." };
}
