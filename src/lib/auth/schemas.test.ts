import { describe, expect, it } from "vitest";
import { loginSchema, signUpSchema } from "./schemas";

describe("signUpSchema", () => {
  it("aceita um cadastro válido", () => {
    const result = signUpSchema.safeParse({
      displayName: "Fulano",
      email: "fulano@example.com",
      password: "senha1234",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = signUpSchema.safeParse({
      displayName: "Fulano",
      email: "não-é-email",
      password: "senha1234",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha curta", () => {
    const result = signUpSchema.safeParse({
      displayName: "Fulano",
      email: "fulano@example.com",
      password: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha sem número", () => {
    const result = signUpSchema.safeParse({
      displayName: "Fulano",
      email: "fulano@example.com",
      password: "somenteletras",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita nome vazio", () => {
    const result = signUpSchema.safeParse({
      displayName: "  ",
      email: "fulano@example.com",
      password: "senha1234",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("aceita e-mail e senha presentes", () => {
    const result = loginSchema.safeParse({ email: "fulano@example.com", password: "qualquer" });
    expect(result.success).toBe(true);
  });

  it("rejeita senha vazia", () => {
    const result = loginSchema.safeParse({ email: "fulano@example.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    const result = loginSchema.safeParse({ email: "invalido", password: "qualquer" });
    expect(result.success).toBe(false);
  });
});
