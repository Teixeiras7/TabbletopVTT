import { z } from "zod";
import { INVITE_CODE_LENGTH, normalizeInviteCode } from "./invite-code";
import { BACKGROUND_TOO_BIG_MESSAGE, GRID_SIZES, MAX_BACKGROUND_BYTES, MAX_CELLS } from "./map";

export const createMesaSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "O nome precisa ter pelo menos 3 caracteres.")
    .max(60, "Nome muito longo (máximo 60 caracteres)."),
  description: z
    .string()
    .trim()
    .max(300, "Descrição muito longa (máximo 300 caracteres).")
    .transform((value) => (value === "" ? null : value)),
});

export const updateMesaSchema = createMesaSchema;

export const joinMesaSchema = z.object({
  code: z
    .string()
    .transform(normalizeInviteCode)
    .pipe(
      z
        .string()
        .length(INVITE_CODE_LENGTH, `O código tem ${INVITE_CODE_LENGTH} caracteres.`),
    ),
});

export const mesaIdSchema = z.uuid();

// Posição do token em casas (0 = primeira). O teto é o do menor quadrado
// (mais casas); sem limite, um clique malicioso poderia gravar coordenadas absurdas.
const mapCoord = z.coerce.number().int().min(0).max(MAX_CELLS - 1);

export const createTokenSchema = z.object({
  label: z.string().trim().min(1, "Dê um nome ao token.").max(30, "Nome muito longo."),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.")
    .default("#6366f1"),
  x: mapCoord.default(0),
  y: mapCoord.default(0),
});

export const moveTokenSchema = z.object({
  tokenId: z.uuid(),
  x: mapCoord,
  y: mapCoord,
});

export const chatMessageSchema = z
  .string()
  .trim()
  .min(1, "Escreva uma mensagem.")
  .max(1000, "Mensagem muito longa (máximo 1000 caracteres).");

export const gridSizeSchema = z.coerce
  .number()
  .int()
  .refine((size) => (GRID_SIZES as readonly number[]).includes(size), "Tamanho de quadrado inválido.");

export const infoNameSchema = z
  .string()
  .trim()
  .min(1, "Dê um nome.")
  .max(60, "Nome muito longo (máximo 60 caracteres).");

export const infoDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Escreva a descrição.")
  .max(5000, "Descrição muito longa (máximo 5000 caracteres).");

// Validado de novo no servidor — o atributo `accept` do input só orienta o
// seletor de arquivos do navegador, não impede um upload forjado. Vale para o
// fundo do mapa e para as imagens das Infos (mesmos formatos e limite).
export { BACKGROUND_TOO_BIG_MESSAGE, MAX_BACKGROUND_BYTES };
export const ALLOWED_BACKGROUND_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Mensagem de erro se o arquivo não pode ser aceito como imagem; null se está ok. */
export function imageFileError(file: File): string | null {
  if (!ALLOWED_BACKGROUND_TYPES.includes(file.type)) return "Envie uma imagem PNG, JPEG ou WEBP.";
  if (file.size > MAX_BACKGROUND_BYTES) return BACKGROUND_TOO_BIG_MESSAGE;
  return null;
}
