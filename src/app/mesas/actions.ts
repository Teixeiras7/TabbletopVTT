"use server";

import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { fieldErrorsOf } from "@/lib/forms";
import { createMesaSchema, joinMesaSchema, mesaIdSchema, updateMesaSchema } from "@/lib/mesas/schemas";
import { createTable, deleteTable, joinTableByCode, leaveTable, updateTable } from "@/lib/mesas/queries";

export type CreateMesaState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "description", string>>;
};

export type UpdateMesaState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "description", string>>;
};

export type JoinMesaState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"code", string>>;
};

export async function createMesaAction(
  _prevState: CreateMesaState,
  formData: FormData,
): Promise<CreateMesaState> {
  const user = await requireUser();

  const parsed = createMesaSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const table = await createTable(user.id, parsed.data);
  redirect(`/mesas/${table.id}`);
}

export async function joinMesaAction(
  _prevState: JoinMesaState,
  formData: FormData,
): Promise<JoinMesaState> {
  const user = await requireUser();

  const parsed = joinMesaSchema.safeParse({ code: formData.get("code") ?? "" });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const tableId = await joinTableByCode(user.id, parsed.data.code);
  if (!tableId) {
    return { status: "error", message: "Nenhuma mesa encontrada com esse código." };
  }
  redirect(`/mesas/${tableId}`);
}

export async function updateMesaAction(
  tableId: string,
  _prevState: UpdateMesaState,
  formData: FormData,
): Promise<UpdateMesaState> {
  const user = await requireUser();
  const parsedId = mesaIdSchema.safeParse(tableId);
  if (!parsedId.success) notFound();

  const parsed = updateMesaSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const table = await updateTable(parsedId.data, user.id, parsed.data);
  if (!table) {
    return { status: "error", message: "Não foi possível salvar as alterações." };
  }
  return { status: "success" };
}

// As ações abaixo só são oferecidas na interface a quem pode usá-las,
// mas a permissão é decidida no backend: chamada indevida não faz nada.

export async function leaveMesaAction(formData: FormData) {
  const user = await requireUser();
  const tableId = mesaIdSchema.safeParse(formData.get("tableId"));
  if (!tableId.success) notFound();

  await leaveTable(tableId.data, user.id);
  redirect("/mesas");
}

export async function deleteMesaAction(formData: FormData) {
  const user = await requireUser();
  const tableId = mesaIdSchema.safeParse(formData.get("tableId"));
  if (!tableId.success) notFound();

  await deleteTable(tableId.data, user.id);
  redirect("/mesas");
}
