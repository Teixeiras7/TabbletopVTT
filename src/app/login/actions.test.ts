import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPasswordMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: signInWithPasswordMock },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const { loginAction } = await import("./actions");

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  signInWithPasswordMock.mockReset();
  redirectMock.mockClear();
});

describe("loginAction", () => {
  it("retorna erros de campo para entrada inválida, sem chamar o Supabase", async () => {
    const state = await loginAction(
      { status: "idle" },
      formData({ email: "invalido", password: "" }),
    );
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.email).toBeDefined();
    expect(state.fieldErrors?.password).toBeDefined();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("mapeia erro de credenciais inválidas do Supabase", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });
    const state = await loginAction(
      { status: "idle" },
      formData({ email: "user@example.com", password: "senhaerrada" }),
    );
    expect(state.status).toBe("error");
    expect(state.message).toBe("E-mail ou senha incorretos.");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redireciona para /mesas em login válido sem redirectTo", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    await expect(
      loginAction({ status: "idle" }, formData({ email: "user@example.com", password: "senha1234" })),
    ).rejects.toThrow("REDIRECT:/mesas");
  });

  it("ignora redirectTo externo (evita open redirect)", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    await expect(
      loginAction(
        { status: "idle" },
        formData({ email: "user@example.com", password: "senha1234", redirectTo: "https://evil.example" }),
      ),
    ).rejects.toThrow("REDIRECT:/mesas");
  });

  it("respeita redirectTo interno válido", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    await expect(
      loginAction(
        { status: "idle" },
        formData({ email: "user@example.com", password: "senha1234", redirectTo: "/mesas/42" }),
      ),
    ).rejects.toThrow("REDIRECT:/mesas/42");
  });
});
