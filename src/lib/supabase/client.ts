import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env.client";

/** Cliente Supabase para uso em Client Components (Auth, Realtime). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
