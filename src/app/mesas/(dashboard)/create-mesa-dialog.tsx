"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createMesaAction, type CreateMesaState } from "../actions";

const initialState: CreateMesaState = { status: "idle" };

export function CreateMesaDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createMesaAction, initialState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">Criar mesa</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar mesa</DialogTitle>
          <DialogDescription>Você vira o Mestre desta mesa.</DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <FieldGroup>
            {state.status === "error" && state.message && (
              <p role="alert" className="text-sm text-destructive">
                {state.message}
              </p>
            )}

            <Field>
              <FieldLabel htmlFor="name">Nome da mesa</FieldLabel>
              <Input id="name" name="name" required maxLength={60} placeholder="Mesa de sexta" autoFocus />
              <FieldError>{state.fieldErrors?.name}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="system">Sistema</FieldLabel>
              <Input id="system" value="Reinos de Ferro" disabled readOnly />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Descrição</FieldLabel>
              <Textarea id="description" name="description" maxLength={300} rows={3} />
              <FieldError>{state.fieldErrors?.description}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Criando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
