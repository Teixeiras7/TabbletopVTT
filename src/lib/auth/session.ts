import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * `getUser()` revalida contra o servidor de Auth (diferente de ler o JWT
 * local), então também cobre sessão expirada/refresh token inválido —
 * nesses casos retorna null em vez de lançar. `cache` evita repetir a
 * chamada de rede quando layout e página pedem o usuário na mesma requisição.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Para Server Components de páginas protegidas: redireciona para /login se não houver sessão válida. */
export async function requireUser(redirectTo = "/login") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}
