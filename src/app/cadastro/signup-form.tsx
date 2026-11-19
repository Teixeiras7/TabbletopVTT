"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signUpAction, type SignUpState } from "./actions";

const initialState: SignUpState = { status: "idle" };

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);

  if (state.status === "confirm_email") {
    return (
      <div className="space-y-3 rounded-md border border-border bg-muted p-4 text-sm">
        <p>Conta criada. Enviamos um e-mail de confirmação — verifique sua caixa de entrada para poder entrar.</p>
        <Link href="/login" className="underline underline-offset-4">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate>
      <FieldGroup>
        {state.status === "error" && state.message && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {state.message}
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="displayName">Nome de exibição</FieldLabel>
          <Input id="displayName" name="displayName" type="text" required minLength={2} maxLength={60} autoComplete="name" />
          <FieldError>{state.fieldErrors?.displayName}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input id="email" name="email" type="email" required autoComplete="email" />
          <FieldError>{state.fieldErrors?.email}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          <FieldDescription>Mínimo 8 caracteres, com letra e número.</FieldDescription>
          <FieldError>{state.fieldErrors?.password}</FieldError>
        </Field>

        <Field>
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Criando conta…" : "Criar conta"}
          </Button>
          <FieldDescription className="text-center">
            Já tem conta? <Link href="/login">Entrar</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
