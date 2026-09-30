import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const { getCurrentUser, requireUser } = await import("./session");

beforeEach(() => {
  getUserMock.mockReset();
  redirectMock.mockClear();
});

describe("getCurrentUser", () => {
  it("retorna o usuário quando a sessão é válida", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    await expect(getCurrentUser()).resolves.toEqual({ id: "u1" });
  });

  it("retorna null quando não há sessão (ausente ou expirada)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe("requireUser", () => {
  it("retorna o usuário sem redirecionar quando autenticado", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    await expect(requireUser()).resolves.toEqual({ id: "u1" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redireciona para /login quando não autenticado", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });
});
