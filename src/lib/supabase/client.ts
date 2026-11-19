import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env.client";

/** Cliente Supabase para uso em Client Components (Auth, Realtime). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Cliente com o login do usuário já aplicado ao Realtime. Sem isso o canal pode ser assinado antes de a
 * sessão carregar e entrar como anônimo: a RLS esconde os eventos sem erro nenhum (o chat só aparecia com F5).
 */
export async function createAuthedRealtimeClient() {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(data.session?.access_token ?? null);
  return supabase;
}
