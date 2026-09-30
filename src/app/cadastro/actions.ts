"use server";

import { redirect } from "next/navigation";
import { signUpSchema } from "@/lib/auth/schemas";
import { mapAuthError } from "@/lib/auth/errors";
import { fieldErrorsOf } from "@/lib/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/db/profiles";
import { getOrigin } from "@/lib/site-url";

export type SignUpState = {
  status: "idle" | "error" | "confirm_email";
  message?: string;
  fieldErrors?: Partial<Record<"displayName" | "email" | "password", string>>;
};

export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { displayName, email, password } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    return { status: "error", message: mapAuthError(error) };
  }

  if (!data.user) {
    return { status: "error", message: "Não foi possível criar a conta. Tente novamente." };
  }

  // Quando o e-mail já está cadastrado, o Supabase não retorna erro (para
  // não revelar quais e-mails já existem) — devolve um usuário "fake", com
  // id diferente do real e identities: []. Nesse caso não criamos perfil
  // (o id não corresponde a ninguém em auth.users) e mostramos a mesma
  // mensagem de "confirme seu e-mail", preservando a mesma proteção contra
  // enumeração de contas que o próprio Supabase já aplica.
  const isExistingUser = data.user.identities?.length === 0;

  if (!isExistingUser) {
    // O id vem do Supabase Auth: é a mesma identidade usada no banco da
    // aplicação, nunca um id gerado à parte. Criado mesmo sem confirmação
    // de e-mail ainda, para não haver usuário autenticável sem perfil.
    await ensureProfile(data.user.id, displayName);
  }

  if (!data.session) {
    return { status: "confirm_email" };
  }

  redirect("/mesas");
}
