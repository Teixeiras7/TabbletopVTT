import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, toErrorResponse } from "@/lib/api/errors";

const querySchema = z.object({
  verbose: z.enum(["true", "false"]).optional().default("false"),
});

/**
 * Endpoint de verificação simples. Serve de referência para o padrão de
 * rota usado no restante da API: validar entrada com zod, lançar `AppError`
 * para erros de domínio e converter qualquer exceção com `toErrorResponse`.
 */
export function GET(request: NextRequest) {
  try {
    const { verbose } = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    if (request.nextUrl.searchParams.has("fail")) {
      throw new AppError("Falha solicitada explicitamente.", 400, "health_check_failed");
    }

    return NextResponse.json({
      status: "ok",
      ...(verbose === "true" && { timestamp: new Date().toISOString() }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
