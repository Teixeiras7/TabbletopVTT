import type { AuthError } from "@supabase/supabase-js";

const messagesByCode: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
  user_already_exists: "Já existe uma conta com este e-mail.",
  email_exists: "Já existe uma conta com este e-mail.",
  weak_password: "Senha muito fraca. Use pelo menos 8 caracteres com letra e número.",
  over_email_send_rate_limit: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
  over_request_rate_limit: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
  signup_disabled: "Novos cadastros estão desativados no momento.",
  email_address_invalid: "E-mail inválido.",
  session_expired: "Sua sessão expirou. Entre novamente.",
  refresh_token_not_found: "Sua sessão expirou. Entre novamente.",
  refresh_token_already_used: "Sua sessão expirou. Entre novamente.",
};

/** Converte um erro do Supabase Auth em uma mensagem em português segura para exibir ao usuário. */
export function mapAuthError(error: AuthError): string {
  const mapped = error.code ? messagesByCode[error.code] : undefined;
  return mapped ?? "Não foi possível concluir a operação. Tente novamente.";
}
