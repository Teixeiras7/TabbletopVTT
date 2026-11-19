import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .email("E-mail inválido.");

/**
 * Mínimo de 8 caracteres com letra e número. Precisa ser igual ou mais
 * rígido que o mínimo configurado no projeto Supabase (padrão: 6), senão o
 * formulário aceitaria senhas que a API rejeitaria.
 */
export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .regex(/[a-zA-Z]/, "A senha precisa ter pelo menos uma letra.")
  .regex(/[0-9]/, "A senha precisa ter pelo menos um número.");

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Informe um nome com pelo menos 2 caracteres.")
    .max(60, "Nome muito longo."),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha."),
});

