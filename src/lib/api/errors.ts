import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Erro esperado de domínio/validação, com status HTTP explícito. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = "bad_request",
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Converte qualquer erro lançado por um Route Handler em uma resposta JSON
 * consistente. Erros inesperados (não-AppError, não-ZodError) são logados e
 * respondidos como 500 genérico, sem vazar detalhes internos ao cliente.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Dados inválidos.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 422 },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Erro interno." } },
    { status: 500 },
  );
}
