"use client";

import { useActionState, useState } from "react";
import { Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CopyInvite } from "@/components/copy-invite";
import { deleteMesaAction, updateMesaAction, type UpdateMesaState } from "../actions";

const initialState: UpdateMesaState = { status: "idle" };
const EDIT_FORM_ID = "mesa-edit-form";
const DELETE_FORM_ID = "mesa-delete-form";

export function MesaSettingsDialog({
  table,
  inviteLink,
}: {
  table: { id: string; name: string; description: string | null; inviteCode: string };
  inviteLink: string;
}) {
  const [open, setOpen] = useState(false);
  const updateForThisMesa = updateMesaAction.bind(null, table.id);
  const [state, formAction, isPending] = useActionState(updateForThisMesa, initialState);

  // Fecha o modal quando a ação termina com sucesso. Ajustar durante a
  // renderização (em vez de useEffect) evita o "flash" de um frame com o
  // modal ainda aberto — padrão recomendado pelo React para reagir a uma
  // mudança de valor entre renders.
  const [announcedStatus, setAnnouncedStatus] = useState(state.status);
  if (state.status !== announcedStatus) {
    setAnnouncedStatus(state.status);
    if (state.status === "success") setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Configurar mesa">
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar mesa</DialogTitle>
        </DialogHeader>

        <form id={EDIT_FORM_ID} action={formAction}>
          <FieldGroup>
            {state.status === "error" && state.message && (
              <p role="alert" className="text-sm text-destructive">
                {state.message}
              </p>
            )}

            <Field>
              <FieldLabel htmlFor="settings-name">Nome da mesa</FieldLabel>
              <Input id="settings-name" name="name" defaultValue={table.name} required maxLength={60} />
              <FieldError>{state.fieldErrors?.name}</FieldError>
            </Field>

            <Field>
              <FieldLabel>Código</FieldLabel>
              <CopyInvite code={table.inviteCode} link={inviteLink} />
            </Field>

            <Field>
              <FieldLabel htmlFor="settings-description">Descrição</FieldLabel>
              <Textarea
                id="settings-description"
                name="description"
                defaultValue={table.description ?? ""}
                maxLength={300}
                rows={3}
              />
              <FieldError>{state.fieldErrors?.description}</FieldError>
            </Field>
          </FieldGroup>
        </form>

        <form id={DELETE_FORM_ID} action={deleteMesaAction} className="hidden">
          <input type="hidden" name="tableId" value={table.id} />
        </form>

        <div className="mt-2 flex items-center justify-between">
          <Button
            type="submit"
            form={DELETE_FORM_ID}
            variant="ghost"
            size="icon"
            aria-label="Excluir mesa"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(event) => {
              if (!window.confirm(`Excluir a mesa "${table.name}" para todos os participantes? Não dá para desfazer.`)) {
                event.preventDefault();
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>

          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" form={EDIT_FORM_ID} disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
