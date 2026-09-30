"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type SignUpState } from "./actions";
import { inputClass, primaryButtonClass } from "@/components/form-styles";

const initialState: SignUpState = { status: "idle" };

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);

  if (state.status === "confirm_email") {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-200">
        <p>Conta criada. Enviamos um e-mail de confirmação — verifique sua caixa de entrada para poder entrar.</p>
        <Link href="/login" className="underline underline-offset-2">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {state.message}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="displayName" className="text-sm text-neutral-300">
          Nome de exibição
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          minLength={2}
          maxLength={60}
          autoComplete="name"
          className={inputClass}
        />
        {state.fieldErrors?.displayName && (
          <p className="text-xs text-red-400">{state.fieldErrors.displayName}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm text-neutral-300">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
        />
        {state.fieldErrors?.email && <p className="text-xs text-red-400">{state.fieldErrors.email}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm text-neutral-300">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
        {state.fieldErrors?.password && (
          <p className="text-xs text-red-400">{state.fieldErrors.password}</p>
        )}
        <p className="text-xs text-neutral-500">Mínimo 8 caracteres, com letra e número.</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={primaryButtonClass}
      >
        {isPending ? "Criando conta…" : "Criar conta"}
      </button>

      <p className="text-center text-sm text-neutral-400">
        Já tem conta?{" "}
        <Link href="/login" className="underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </form>
  );
}
