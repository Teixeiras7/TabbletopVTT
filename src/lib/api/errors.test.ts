import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, toErrorResponse } from "./errors";

describe("toErrorResponse", () => {
  it("usa o status e código de um AppError", async () => {
    const response = toErrorResponse(new AppError("não encontrado", 404, "not_found"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "not_found", message: "não encontrado" },
    });
  });

  it("responde 422 para erros de validação do zod", async () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({});
    const response = toErrorResponse(result.error);
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
    expect(body.error.issues.length).toBeGreaterThan(0);
  });

  it("responde 500 para erros inesperados", async () => {
    const response = toErrorResponse(new Error("boom"));
    expect(response.status).toBe(500);
  });
});
