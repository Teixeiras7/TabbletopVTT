import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const createTokenMock = vi.fn();
const moveTokenMock = vi.fn();
const deleteTokenMock = vi.fn();
const updateSceneGridSizeMock = vi.fn();
const updateSceneBackgroundMock = vi.fn();
const sendChatMessageMock = vi.fn();
const clearMyChatMock = vi.fn();
const clearAllChatMock = vi.fn();
const uploadMock = vi.fn();
const getPublicUrlMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock() }));
vi.mock("@/lib/mesas/queries", () => ({
  createToken: (...a: unknown[]) => createTokenMock(...a),
  moveToken: (...a: unknown[]) => moveTokenMock(...a),
  deleteToken: (...a: unknown[]) => deleteTokenMock(...a),
  updateSceneGridSize: (...a: unknown[]) => updateSceneGridSizeMock(...a),
  updateSceneBackground: (...a: unknown[]) => updateSceneBackgroundMock(...a),
}));
vi.mock("@/lib/mesas/chat", () => ({
  sendChatMessage: (...a: unknown[]) => sendChatMessageMock(...a),
  clearMyChat: (...a: unknown[]) => clearMyChatMock(...a),
  clearAllChat: (...a: unknown[]) => clearAllChatMock(...a),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => uploadMock(...a),
        getPublicUrl: (...a: unknown[]) => getPublicUrlMock(...a),
      }),
    },
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const {
  clearAllChatAction,
  clearMyChatAction,
  createTokenAction,
  deleteTokenAction,
  moveTokenAction,
  sendChatMessageAction,
  updateGridSizeAction,
  uploadSceneBackgroundAction,
} = await import("./actions");

const SCENE_ID = "cb24a48a-18a5-4382-b268-391e75354708";
const TOKEN_ID = "a70c77ec-ae43-40b0-b8c4-790592c4e2f7";
const TABLE_ID = "1bdaf5f1-4751-476b-880d-cfb2b6d03c72";

beforeEach(() => {
  requireUserMock.mockReset().mockResolvedValue({ id: "user-1" });
  createTokenMock.mockReset();
  moveTokenMock.mockReset();
  deleteTokenMock.mockReset();
  updateSceneGridSizeMock.mockReset();
  updateSceneBackgroundMock.mockReset();
  sendChatMessageMock.mockReset();
  clearMyChatMock.mockReset();
  clearAllChatMock.mockReset();
  uploadMock.mockReset();
  getPublicUrlMock.mockReset().mockReturnValue({ data: { publicUrl: "https://x.test/scene-backgrounds/img" } });
});

describe("createTokenAction", () => {
  it("rejeita entrada inválida sem consultar o banco", async () => {
    await expect(createTokenAction(SCENE_ID, { label: "" })).rejects.toThrow("NOT_FOUND");
    expect(createTokenMock).not.toHaveBeenCalled();
  });

  it("delega ao query layer, que decide se o usuário pode criar (só Mestre)", async () => {
    createTokenMock.mockResolvedValue({ id: TOKEN_ID });
    const result = await createTokenAction(SCENE_ID, { label: "Orc #1" });
    expect(result).toEqual({ ok: true });
    expect(createTokenMock).toHaveBeenCalledWith(SCENE_ID, "user-1", {
      label: "Orc #1",
      color: "#6366f1",
      x: 0,
      y: 0,
    });
  });

  it("retorna ok:false quando a query nega (não é Mestre)", async () => {
    createTokenMock.mockResolvedValue(null);
    const result = await createTokenAction(SCENE_ID, { label: "Orc #1" });
    expect(result).toEqual({ ok: false });
  });
});

describe("moveTokenAction", () => {
  it("rejeita coordenadas inválidas sem consultar o banco", async () => {
    await expect(moveTokenAction({ tokenId: TOKEN_ID, x: 1.5, y: 0 })).rejects.toThrow("NOT_FOUND");
    expect(moveTokenMock).not.toHaveBeenCalled();
  });

  it("usa sempre o usuário da sessão, nunca um id vindo do chamador", async () => {
    moveTokenMock.mockResolvedValue(true);
    const result = await moveTokenAction({ tokenId: TOKEN_ID, x: 3, y: 4 });
    expect(result).toEqual({ ok: true });
    expect(moveTokenMock).toHaveBeenCalledWith(TOKEN_ID, "user-1", 3, 4);
  });
});

describe("deleteTokenAction", () => {
  it("rejeita id que não é uuid", async () => {
    await expect(deleteTokenAction("nao-e-uuid")).rejects.toThrow("NOT_FOUND");
    expect(deleteTokenMock).not.toHaveBeenCalled();
  });

  it("delega ao query layer", async () => {
    deleteTokenMock.mockResolvedValue(true);
    expect(await deleteTokenAction(TOKEN_ID)).toEqual({ ok: true });
    expect(deleteTokenMock).toHaveBeenCalledWith(TOKEN_ID, "user-1");
  });
});

describe("chat", () => {
  it("rejeita mensagem vazia ou longa demais sem consultar o banco", async () => {
    expect(await sendChatMessageAction(TABLE_ID, "   ")).toEqual({ ok: false });
    expect(await sendChatMessageAction(TABLE_ID, "x".repeat(1001))).toEqual({ ok: false });
    expect(await sendChatMessageAction("nao-e-uuid", "oi")).toEqual({ ok: false });
    expect(sendChatMessageMock).not.toHaveBeenCalled();
  });

  it("envia com o usuário da sessão e o texto já aparado", async () => {
    const message = { id: "m1", content: "oi" };
    sendChatMessageMock.mockResolvedValue(message);
    expect(await sendChatMessageAction(TABLE_ID, "  oi  ")).toEqual({ ok: true, message });
    expect(sendChatMessageMock).toHaveBeenCalledWith(TABLE_ID, "user-1", "oi");
  });

  it("retorna ok:false quando não participa da mesa", async () => {
    sendChatMessageMock.mockResolvedValue(null);
    expect(await sendChatMessageAction(TABLE_ID, "oi")).toEqual({ ok: false });
  });

  it("limpar meu chat usa o usuário da sessão", async () => {
    clearMyChatMock.mockResolvedValue("2026-09-29T00:00:00.000Z");
    expect(await clearMyChatAction(TABLE_ID)).toEqual({ ok: true, clearedAt: "2026-09-29T00:00:00.000Z" });
    expect(clearMyChatMock).toHaveBeenCalledWith(TABLE_ID, "user-1");
    expect(await clearMyChatAction("nao-e-uuid")).toEqual({ ok: false });
  });

  it("limpar chat de todos delega ao query layer, que só aceita o Mestre", async () => {
    clearAllChatMock.mockResolvedValue(false);
    expect(await clearAllChatAction(TABLE_ID)).toEqual({ ok: false });
    clearAllChatMock.mockResolvedValue(true);
    expect(await clearAllChatAction(TABLE_ID)).toEqual({ ok: true });
    expect(clearAllChatMock).toHaveBeenCalledWith(TABLE_ID, "user-1");
  });
});

describe("updateGridSizeAction", () => {
  it("rejeita tamanho fora do intervalo sem consultar o banco", async () => {
    expect(await updateGridSizeAction(SCENE_ID, 5)).toEqual({ ok: false });
    expect(await updateGridSizeAction(SCENE_ID, 999)).toEqual({ ok: false });
    expect(updateSceneGridSizeMock).not.toHaveBeenCalled();
  });

  it("delega ao query layer, que decide se o usuário pode mudar (só Mestre)", async () => {
    updateSceneGridSizeMock.mockResolvedValue(true);
    expect(await updateGridSizeAction(SCENE_ID, 60)).toEqual({ ok: true });
    expect(updateSceneGridSizeMock).toHaveBeenCalledWith(SCENE_ID, "user-1", 60);
  });
});

describe("uploadSceneBackgroundAction", () => {
  function formDataWith(file: File | null) {
    const data = new FormData();
    if (file) data.set("file", file);
    return data;
  }

  it("rejeita quando não há arquivo, sem enviar nada ao storage", async () => {
    const result = await uploadSceneBackgroundAction(SCENE_ID, TABLE_ID, formDataWith(null));
    expect(result.ok).toBe(false);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejeita tipo de arquivo não permitido", async () => {
    const file = new File(["conteudo"], "arquivo.txt", { type: "text/plain" });
    const result = await uploadSceneBackgroundAction(SCENE_ID, TABLE_ID, formDataWith(file));
    expect(result.ok).toBe(false);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejeita arquivo grande demais", async () => {
    const big = new File([new Uint8Array(9 * 1024 * 1024)], "mapa.png", { type: "image/png" });
    const result = await uploadSceneBackgroundAction(SCENE_ID, TABLE_ID, formDataWith(big));
    expect(result.ok).toBe(false);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("envia, gera a URL pública e salva na cena, sempre com o usuário da sessão", async () => {
    uploadMock.mockResolvedValue({ error: null });
    updateSceneBackgroundMock.mockResolvedValue(true);
    const file = new File(["conteudo"], "mapa.png", { type: "image/png" });

    const result = await uploadSceneBackgroundAction(SCENE_ID, TABLE_ID, formDataWith(file));

    expect(result.ok).toBe(true);
    expect(result.url).toContain("https://x.test/scene-backgrounds/img?v=");
    expect(uploadMock).toHaveBeenCalledWith(
      `${TABLE_ID}/background`,
      file,
      expect.objectContaining({ upsert: true }),
    );
    expect(updateSceneBackgroundMock).toHaveBeenCalledWith(SCENE_ID, "user-1", result.url);
  });

  it("retorna erro quando o storage recusa o envio (RLS: não é Mestre)", async () => {
    uploadMock.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });
    const file = new File(["conteudo"], "mapa.png", { type: "image/png" });

    const result = await uploadSceneBackgroundAction(SCENE_ID, TABLE_ID, formDataWith(file));

    expect(result.ok).toBe(false);
    expect(updateSceneBackgroundMock).not.toHaveBeenCalled();
  });
});
