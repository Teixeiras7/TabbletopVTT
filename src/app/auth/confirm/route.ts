import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeRedirectTarget } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Só os tipos que o cadastro por e-mail gera; qualquer outro é ignorado.
const CONFIRM_TYPES: readonly string[] = ["signup", "email"];

/** Link de confirmação de e-mail do Supabase Auth aponta para cá (ver emailRedirectTo em cadastro/actions.ts). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeRedirectTarget(searchParams.get("next"));

  if (tokenHash && type && CONFIRM_TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "confirm_failed");
  return NextResponse.redirect(loginUrl);
}
