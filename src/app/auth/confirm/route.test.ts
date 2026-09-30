import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyOtpMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { verifyOtp: verifyOtpMock } }),
}));

const { GET } = await import("./route");

const call = (query: string) => GET(new NextRequest(`http://localhost:3000/auth/confirm?${query}`));

beforeEach(() => verifyOtpMock.mockReset());

describe("GET /auth/confirm", () => {
  it("confirma e vai para /mesas por padrão", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    const res = await call("token_hash=abc&type=signup");
    expect(res.headers.get("location")).toBe("http://localhost:3000/mesas");
    expect(verifyOtpMock).toHaveBeenCalledWith({ type: "signup", token_hash: "abc" });
  });

  it("ignora `next` externo (sem open redirect)", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    for (const next of ["https://evil.example", "//evil.example", "/\\evil.example"]) {
      const res = await call(`token_hash=abc&type=signup&next=${encodeURIComponent(next)}`);
      expect(res.headers.get("location")).toBe("http://localhost:3000/mesas");
    }
  });

  it("respeita `next` interno", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    const res = await call("token_hash=abc&type=email&next=%2Fmesas%3Fcodigo%3DABCD2345");
    expect(res.headers.get("location")).toBe("http://localhost:3000/mesas?codigo=ABCD2345");
  });

  it("volta ao login quando o token é inválido, o tipo não é permitido ou faltam parâmetros", async () => {
    verifyOtpMock.mockResolvedValue({ error: { message: "expired" } });
    for (const query of ["token_hash=abc&type=signup", "token_hash=abc&type=recovery", "type=signup", ""]) {
      const res = await call(query);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=confirm_failed");
    }
    expect(verifyOtpMock).toHaveBeenCalledTimes(1);
  });
});
