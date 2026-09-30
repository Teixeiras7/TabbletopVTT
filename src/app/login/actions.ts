"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/lib/auth/schemas";
import { mapAuthError } from "@/lib/auth/errors";
import { safeRedirectTarget } from "@/lib/auth/redirect";
import { fieldErrorsOf } from "@/lib/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", message: mapAuthError(error) };
  }

  redirect(safeRedirectTarget(formData.get("redirectTo")));
}
