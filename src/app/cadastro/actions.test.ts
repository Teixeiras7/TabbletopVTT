import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpMock = vi.fn();
const ensureProfileMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signUp: signUpMock },
  }),
}));

vi.mock("@/lib/db/profiles", () => ({
  ensureProfile: (...args: unknown[]) => ensureProfileMock(...args),
}));

vi.mock("@/lib/site-url", () => ({
  getOrigin: async () => "http://localhost:3000",
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const { signUpAction } = await import("./actions");

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  signUpMock.mockReset();
  ensureProfileMock.mockReset();
  redirectMock.mockClear();
});

describe("signUpAction", () => {
  it("retorna erros de campo para entrada inválida, sem chamar o Supabase", async () => {
    const state = await signUpAction(
      { status: "idle" },
      formData({ displayName: "", email: "invalido", password: "123" }),
    );
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.displayName).toBeDefined();
    expect(state.fieldErrors?.email).toBeDefined();
    expect(state.fieldErrors?.password).toBeDefined();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("mapeia e-mail já cadastrado", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "user_already_exists", message: "User already registered" },
    });
    const state = await signUpAction(
      { status: "idle" },
      formData({ displayName: "Fulano", email: "existente@example.com", password: "senha1234" }),
    );
    expect(state.status).toBe("error");
    expect(state.message).toBe("Já existe uma conta com este e-mail.");
    expect(ensureProfileMock).not.toHaveBeenCalled();
  });

  it("cria o perfil com o id do Auth e mostra confirmação de e-mail quando não há sessão imediata", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-123" }, session: null },
      error: null,
    });
    const state = await signUpAction(
      { status: "idle" },
      formData({ displayName: "Fulano", email: "novo@example.com", password: "senha1234" }),
    );
    expect(state.status).toBe("confirm_email");
    expect(ensureProfileMock).toHaveBeenCalledWith("user-123", "Fulano");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("não cria perfil quando o Supabase devolve um usuário 'fantasma' (e-mail já existe, sem erro)", async () => {
    // Comportamento real do Supabase: para não revelar quais e-mails já
    // existem, signUp() para um e-mail já cadastrado não retorna erro — só
    // um usuário com id diferente do real e identities: [].
    signUpMock.mockResolvedValue({
      data: { user: { id: "id-fantasma-nao-existe", identities: [] }, session: null },
      error: null,
    });
    const state = await signUpAction(
      { status: "idle" },
      formData({ displayName: "Fulano", email: "ja-existe@example.com", password: "senha1234" }),
    );
    expect(state.status).toBe("confirm_email");
    expect(ensureProfileMock).not.toHaveBeenCalled();
  });

  it("redireciona para /mesas quando a sessão já vem criada", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "user-456" }, session: { access_token: "t" } },
      error: null,
    });
    await expect(
      signUpAction(
        { status: "idle" },
        formData({ displayName: "Fulano", email: "novo2@example.com", password: "senha1234" }),
      ),
    ).rejects.toThrow("REDIRECT:/mesas");
    expect(ensureProfileMock).toHaveBeenCalledWith("user-456", "Fulano");
  });

  it("usa emailRedirectTo apontando para /auth/confirm", async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: "u" }, session: null }, error: null });
    await signUpAction(
      { status: "idle" },
      formData({ displayName: "Fulano", email: "novo3@example.com", password: "senha1234" }),
    );
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "http://localhost:3000/auth/confirm",
        }),
      }),
    );
  });
});
