import { describe, expect, it } from "vitest";
import { AuthApiError } from "@supabase/supabase-js";
import { mapAuthError } from "./errors";

function authError(code: string) {
  return new AuthApiError("mensagem original em inglês", 400, code);
}

describe("mapAuthError", () => {
  it("traduz credenciais inválidas", () => {
    expect(mapAuthError(authError("invalid_credentials"))).toBe("E-mail ou senha incorretos.");
  });

  it("traduz e-mail já cadastrado", () => {
    expect(mapAuthError(authError("user_already_exists"))).toBe(
      "Já existe uma conta com este e-mail.",
    );
  });

  it("usa mensagem genérica para códigos desconhecidos", () => {
    expect(mapAuthError(authError("algo_nao_mapeado"))).toBe(
      "Não foi possível concluir a operação. Tente novamente.",
    );
  });
});
