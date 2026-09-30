import { describe, expect, it } from "vitest";
import { safeRedirectTarget } from "./redirect";

describe("safeRedirectTarget", () => {
  it("aceita caminhos internos, com query", () => {
    expect(safeRedirectTarget("/mesas")).toBe("/mesas");
    expect(safeRedirectTarget("/mesas?codigo=ABCD2345")).toBe("/mesas?codigo=ABCD2345");
    expect(safeRedirectTarget(["/mesas/1", "/outro"])).toBe("/mesas/1");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\evil.example",
    "javascript:alert(1)",
    "mesas",
    "/mesas\n//evil.example",
    "",
  ])("rejeita %j", (value) => {
    expect(safeRedirectTarget(value)).toBe("/mesas");
  });

  it("rejeita valores que não são texto e respeita o destino padrão informado", () => {
    expect(safeRedirectTarget(null)).toBe("/mesas");
    expect(safeRedirectTarget(undefined, "/login")).toBe("/login");
  });
});
