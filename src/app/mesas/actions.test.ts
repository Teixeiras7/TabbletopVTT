import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const createTableMock = vi.fn();
const joinTableByCodeMock = vi.fn();
const leaveTableMock = vi.fn();
const deleteTableMock = vi.fn();
const updateTableMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock() }));
vi.mock("@/lib/mesas/queries", () => ({
  createTable: (...a: unknown[]) => createTableMock(...a),
  joinTableByCode: (...a: unknown[]) => joinTableByCodeMock(...a),
  leaveTable: (...a: unknown[]) => leaveTableMock(...a),
  deleteTable: (...a: unknown[]) => deleteTableMock(...a),
  updateTable: (...a: unknown[]) => updateTableMock(...a),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const { createMesaAction, joinMesaAction, leaveMesaAction, deleteMesaAction, updateMesaAction } =
  await import("./actions");

const TABLE_ID = "cb24a48a-18a5-4382-b268-391e75354708";

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  for (const m of [createTableMock, joinTableByCodeMock, leaveTableMock, deleteTableMock, updateTableMock])
    m.mockReset();
  requireUserMock.mockReset().mockResolvedValue({ id: "user-1" });
});

describe("createMesaAction", () => {
  it("retorna erro de campo e não cria nada com nome inválido", async () => {
    const state = await createMesaAction({ status: "idle" }, formData({ name: "ab", description: "" }));
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.name).toBeDefined();
    expect(createTableMock).not.toHaveBeenCalled();
  });

  it("cria a mesa para o usuário autenticado e vai para o lobby", async () => {
    createTableMock.mockResolvedValue({ id: TABLE_ID });
    await expect(
      createMesaAction({ status: "idle" }, formData({ name: "Mesa do Norte", description: "" })),
    ).rejects.toThrow(`REDIRECT:/mesas/${TABLE_ID}`);
    expect(createTableMock).toHaveBeenCalledWith("user-1", { name: "Mesa do Norte", description: null });
  });
});

describe("joinMesaAction", () => {
  it("rejeita código com tamanho errado sem consultar o banco", async () => {
    const state = await joinMesaAction({ status: "idle" }, formData({ code: "ABC" }));
    expect(state.fieldErrors?.code).toBeDefined();
    expect(joinTableByCodeMock).not.toHaveBeenCalled();
  });

  it("avisa quando nenhuma mesa tem o código", async () => {
    joinTableByCodeMock.mockResolvedValue(null);
    const state = await joinMesaAction({ status: "idle" }, formData({ code: "abcd2345" }));
    expect(state.message).toBe("Nenhuma mesa encontrada com esse código.");
  });

  it("normaliza o código e entra na mesa", async () => {
    joinTableByCodeMock.mockResolvedValue(TABLE_ID);
    await expect(
      joinMesaAction({ status: "idle" }, formData({ code: "abcd-2345" })),
    ).rejects.toThrow(`REDIRECT:/mesas/${TABLE_ID}`);
    expect(joinTableByCodeMock).toHaveBeenCalledWith("user-1", "ABCD2345");
  });
});

describe("updateMesaAction", () => {
  it("ignora id que não é uuid", async () => {
    await expect(
      updateMesaAction("x", { status: "idle" }, formData({ name: "Mesa", description: "" })),
    ).rejects.toThrow("NOT_FOUND");
    expect(updateTableMock).not.toHaveBeenCalled();
  });

  it("retorna erro de campo sem consultar o banco", async () => {
    const state = await updateMesaAction(TABLE_ID, { status: "idle" }, formData({ name: "ab", description: "" }));
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.name).toBeDefined();
    expect(updateTableMock).not.toHaveBeenCalled();
  });

  it("avisa quando a query nega (não é Mestre) sem redirecionar", async () => {
    updateTableMock.mockResolvedValue(null);
    const state = await updateMesaAction(
      TABLE_ID,
      { status: "idle" },
      formData({ name: "Mesa Nova", description: "" }),
    );
    expect(state.status).toBe("error");
  });

  it("salva e retorna sucesso, sempre com o usuário da sessão", async () => {
    updateTableMock.mockResolvedValue({ id: TABLE_ID, name: "Mesa Nova" });
    const state = await updateMesaAction(
      TABLE_ID,
      { status: "idle" },
      formData({ name: "Mesa Nova", description: "" }),
    );
    expect(state).toEqual({ status: "success" });
    expect(updateTableMock).toHaveBeenCalledWith(TABLE_ID, "user-1", { name: "Mesa Nova", description: null });
  });
});

describe("leaveMesaAction / deleteMesaAction", () => {
  it("ignoram id que não é uuid", async () => {
    await expect(leaveMesaAction(formData({ tableId: "x" }))).rejects.toThrow("NOT_FOUND");
    await expect(deleteMesaAction(formData({ tableId: "x" }))).rejects.toThrow("NOT_FOUND");
    expect(leaveTableMock).not.toHaveBeenCalled();
    expect(deleteTableMock).not.toHaveBeenCalled();
  });

  it("sempre passam o usuário da sessão, nunca um id vindo do formulário", async () => {
    await expect(leaveMesaAction(formData({ tableId: TABLE_ID, userId: "hacker" }))).rejects.toThrow("REDIRECT:/mesas");
    await expect(deleteMesaAction(formData({ tableId: TABLE_ID, userId: "hacker" }))).rejects.toThrow("REDIRECT:/mesas");
    expect(leaveTableMock).toHaveBeenCalledWith(TABLE_ID, "user-1");
    expect(deleteTableMock).toHaveBeenCalledWith(TABLE_ID, "user-1");
  });
});
