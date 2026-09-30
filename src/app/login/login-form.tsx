"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({
  redirectTo,
  notice,
}: {
  redirectTo: string;
  notice?: string;
}) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <FieldGroup>
        {notice && <FieldDescription className="rounded-md border border-border bg-muted p-3">{notice}</FieldDescription>}

        {state.status === "error" && state.message && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {state.message}
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input id="email" name="email" type="email" required autoComplete="email" />
          <FieldError>{state.fieldErrors?.email}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
          <FieldError>{state.fieldErrors?.password}</FieldError>
        </Field>

        <Field>
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Entrando…" : "Entrar"}
          </Button>
          <FieldDescription className="text-center">
            Ainda não tem conta? <Link href="/cadastro">Criar conta</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
