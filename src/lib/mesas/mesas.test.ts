import { describe, expect, it } from "vitest";
import { generateInviteCode, INVITE_CODE_LENGTH, normalizeInviteCode } from "./invite-code";
import { roleOf } from "./roles";
import { MAX_CELLS } from "./map";
import {
  createMesaSchema,
  createTokenSchema,
  gridSizeSchema,
  joinMesaSchema,
  mesaIdSchema,
  moveTokenSchema,
} from "./schemas";

describe("roleOf", () => {
  it("criador é Mestre e os demais são Jogadores", () => {
    expect(roleOf("dono", "dono")).toBe("master");
    expect(roleOf("dono", "outro")).toBe("player");
  });
});

describe("código de convite", () => {
  it("gera 8 caracteres sem símbolos ambíguos (0, O, 1, I, L)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]+$/);
    }
  });

  it("normaliza o que o usuário digita", () => {
    expect(normalizeInviteCode(" ab3d-ef4h ")).toBe("AB3DEF4H");
  });
});

describe("createMesaSchema", () => {
  it("aceita nome válido e transforma descrição vazia em null", () => {
    const result = createMesaSchema.parse({ name: "  Mesa do Norte ", description: "  " });
    expect(result).toEqual({ name: "Mesa do Norte", description: null });
  });

  it("rejeita nome curto ou longo demais e descrição enorme", () => {
    expect(createMesaSchema.safeParse({ name: "ab", description: "" }).success).toBe(false);
    expect(createMesaSchema.safeParse({ name: "x".repeat(61), description: "" }).success).toBe(false);
    expect(createMesaSchema.safeParse({ name: "Mesa", description: "x".repeat(301) }).success).toBe(false);
  });
});

describe("joinMesaSchema", () => {
  it("normaliza e valida o tamanho do código", () => {
    expect(joinMesaSchema.parse({ code: "abcd-2345" }).code).toBe("ABCD2345");
    expect(joinMesaSchema.safeParse({ code: "ABC" }).success).toBe(false);
  });
});

describe("mesaIdSchema", () => {
  it("só aceita uuid", () => {
    expect(mesaIdSchema.safeParse("nao-e-uuid").success).toBe(false);
    expect(mesaIdSchema.safeParse("cb24a48a-18a5-4382-b268-391e75354708").success).toBe(true);
  });
});

describe("createTokenSchema", () => {
  it("aceita nome e cor válidos, com padrão de cor e posição", () => {
    const result = createTokenSchema.parse({ label: " Orc #1 " });
    expect(result).toEqual({ label: "Orc #1", color: "#6366f1", x: 0, y: 0 });
  });

  it("rejeita nome vazio e cor fora do formato hex", () => {
    expect(createTokenSchema.safeParse({ label: "" }).success).toBe(false);
    expect(createTokenSchema.safeParse({ label: "Orc", color: "red" }).success).toBe(false);
  });

  it("rejeita casa fora do mapa (o máximo é a última casa do menor quadrado)", () => {
    expect(createTokenSchema.safeParse({ label: "Orc", x: 5000 }).success).toBe(false);
    expect(createTokenSchema.safeParse({ label: "Orc", x: -1 }).success).toBe(false);
    expect(createTokenSchema.safeParse({ label: "Orc", x: MAX_CELLS }).success).toBe(false);
    expect(createTokenSchema.safeParse({ label: "Orc", x: MAX_CELLS - 1, y: 0 }).success).toBe(true);
  });
});

describe("gridSizeSchema", () => {
  it("só aceita tamanhos que fecham o mapa sem casa cortada", () => {
    expect(gridSizeSchema.safeParse(40).success).toBe(true);
    expect(gridSizeSchema.safeParse(160).success).toBe(true);
    expect(gridSizeSchema.safeParse(44).success).toBe(false);
    expect(gridSizeSchema.safeParse(8).success).toBe(false);
    expect(gridSizeSchema.safeParse(999).success).toBe(false);
  });
});

describe("moveTokenSchema", () => {
  it("exige um uuid de token e coordenadas inteiras", () => {
    expect(
      moveTokenSchema.safeParse({ tokenId: "cb24a48a-18a5-4382-b268-391e75354708", x: 3, y: 4 }).success,
    ).toBe(true);
    expect(moveTokenSchema.safeParse({ tokenId: "x", x: 3, y: 4 }).success).toBe(false);
    expect(
      moveTokenSchema.safeParse({ tokenId: "cb24a48a-18a5-4382-b268-391e75354708", x: 1.5, y: 4 }).success,
    ).toBe(false);
  });
});
