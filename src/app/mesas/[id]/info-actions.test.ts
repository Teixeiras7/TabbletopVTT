import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const createInfoMock = vi.fn();
const deleteInfoMock = vi.fn();
const getEditableInfoMock = vi.fn();
const listInfosMock = vi.fn();
const setInfoHiddenMock = vi.fn();
const updateInfoMock = vi.fn();
const uploadMock = vi.fn();
const removeMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireUser: () => requireUserMock() }));
vi.mock("@/lib/mesas/infos", () => ({
  createInfo: (...a: unknown[]) => createInfoMock(...a),
  deleteInfo: (...a: unknown[]) => deleteInfoMock(...a),
  getEditableInfo: (...a: unknown[]) => getEditableInfoMock(...a),
  listInfosForMember: (...a: unknown[]) => listInfosMock(...a),
  setInfoHidden: (...a: unknown[]) => setInfoHiddenMock(...a),
  updateInfo: (...a: unknown[]) => updateInfoMock(...a),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => uploadMock(...a),
        remove: (...a: unknown[]) => removeMock(...a),
        getPublicUrl: () => ({ data: { publicUrl: "https://x.test/info-images/img" } }),
      }),
    },
  }),
}));

const {
  createImageInfoAction,
  createNoteInfoAction,
  deleteInfoAction,
  setInfoHiddenAction,
  updateImageInfoAction,
  updateNoteInfoAction,
} = await import("./info-actions");

const TABLE_ID = "1bdaf5f1-4751-476b-880d-cfb2b6d03c72";
const INFO_ID = "cb24a48a-18a5-4382-b268-391e75354708";
const LIST = [{ id: INFO_ID, name: "Taverna" }];

function imageForm(name: string, file?: File) {
  const data = new FormData();
  data.set("name", name);
  if (file) data.set("file", file);
  return data;
}
const png = () => new File(["conteudo"], "mapa.png", { type: "image/png" });

beforeEach(() => {
  for (const mock of [
    createInfoMock,
    deleteInfoMock,
    getEditableInfoMock,
    listInfosMock,
    setInfoHiddenMock,
    updateInfoMock,
    uploadMock,
    removeMock,
  ]) {
    mock.mockReset();
  }
  requireUserMock.mockReset().mockResolvedValue({ id: "user-1" });
  listInfosMock.mockResolvedValue(LIST);
  uploadMock.mockResolvedValue({ error: null });
  removeMock.mockResolvedValue({});
});

describe("notas", () => {
  it("rejeita nome ou descrição vazios sem consultar o banco", async () => {
    expect((await createNoteInfoAction(TABLE_ID, { name: "  ", description: "x" })).ok).toBe(false);
    expect((await createNoteInfoAction(TABLE_ID, { name: "x", description: "" })).ok).toBe(false);
    expect(createInfoMock).not.toHaveBeenCalled();
  });

  it("cria com o usuário da sessão e devolve a lista atualizada", async () => {
    createInfoMock.mockResolvedValue({ id: INFO_ID });
    const result = await createNoteInfoAction(TABLE_ID, { name: " Vilão ", description: " É o rei. " });
    expect(result).toEqual({ ok: true, infos: LIST });
    expect(createInfoMock).toHaveBeenCalledWith(TABLE_ID, "user-1", {
      kind: "note",
      name: "Vilão",
      description: "É o rei.",
      imageUrl: null,
    });
  });

  it("recusa quando o backend nega (ex.: não participa)", async () => {
    createInfoMock.mockResolvedValue(null);
    expect((await createNoteInfoAction(TABLE_ID, { name: "x", description: "y" })).ok).toBe(false);
  });

  it("editar exige poder editar e que seja uma nota", async () => {
    getEditableInfoMock.mockResolvedValue(null);
    expect((await updateNoteInfoAction(INFO_ID, { name: "x", description: "y" })).ok).toBe(false);
    getEditableInfoMock.mockResolvedValue({ id: INFO_ID, kind: "image", tableId: TABLE_ID });
    expect((await updateNoteInfoAction(INFO_ID, { name: "x", description: "y" })).ok).toBe(false);
    expect(updateInfoMock).not.toHaveBeenCalled();
  });
});

describe("imagens", () => {
  it("rejeita nome vazio, arquivo ausente, tipo errado e arquivo grande sem enviar ao Storage", async () => {
    expect((await createImageInfoAction(TABLE_ID, imageForm(" ", png()))).ok).toBe(false);
    expect((await createImageInfoAction(TABLE_ID, imageForm("Mapa"))).ok).toBe(false);
    expect((await createImageInfoAction(TABLE_ID, imageForm("Mapa", new File(["x"], "a.pdf", { type: "application/pdf" })))).ok).toBe(false);
    const big = new File([new Uint8Array(5 * 1024 * 1024)], "grande.png", { type: "image/png" });
    expect((await createImageInfoAction(TABLE_ID, imageForm("Mapa", big))).ok).toBe(false);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("envia para <mesa>/<id da info> e grava a info com o mesmo id", async () => {
    createInfoMock.mockResolvedValue({ id: "novo" });
    const result = await createImageInfoAction(TABLE_ID, imageForm("Taverna", png()));
    expect(result.ok).toBe(true);

    const [path] = uploadMock.mock.calls[0] as [string];
    const [tableInPath, infoId] = path.split("/");
    expect(tableInPath).toBe(TABLE_ID);
    expect(createInfoMock).toHaveBeenCalledWith(
      TABLE_ID,
      "user-1",
      expect.objectContaining({ id: infoId, kind: "image", name: "Taverna" }),
    );
  });

  it("apaga a imagem enviada se a info não puder ser criada (não deixa arquivo órfão)", async () => {
    createInfoMock.mockResolvedValue(null);
    const result = await createImageInfoAction(TABLE_ID, imageForm("Taverna", png()));
    expect(result.ok).toBe(false);
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it("falha do Storage (ex.: não é o Mestre) não cria a info", async () => {
    uploadMock.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });
    const result = await createImageInfoAction(TABLE_ID, imageForm("Taverna", png()));
    expect(result.ok).toBe(false);
    expect(createInfoMock).not.toHaveBeenCalled();
  });

  it("editar só o nome não reenvia a imagem; com arquivo novo, sobrescreve no mesmo caminho", async () => {
    getEditableInfoMock.mockResolvedValue({ id: INFO_ID, kind: "image", tableId: TABLE_ID });
    updateInfoMock.mockResolvedValue({ id: INFO_ID });

    expect((await updateImageInfoAction(INFO_ID, imageForm("Novo nome"))).ok).toBe(true);
    expect(uploadMock).not.toHaveBeenCalled();
    expect(updateInfoMock).toHaveBeenCalledWith(INFO_ID, "user-1", { name: "Novo nome", imageUrl: undefined });

    expect((await updateImageInfoAction(INFO_ID, imageForm("Novo nome", png()))).ok).toBe(true);
    expect(uploadMock.mock.calls[0]?.[0]).toBe(`${TABLE_ID}/${INFO_ID}`);
  });
});

describe("ocultar e excluir", () => {
  it("ocultar passa pelo backend, que só aceita o Mestre e o que ele criou", async () => {
    getEditableInfoMock.mockResolvedValue({ id: INFO_ID, kind: "note", tableId: TABLE_ID });
    setInfoHiddenMock.mockResolvedValue(null);
    expect((await setInfoHiddenAction(INFO_ID, false)).ok).toBe(false);
    setInfoHiddenMock.mockResolvedValue({ id: INFO_ID });
    expect((await setInfoHiddenAction(INFO_ID, false)).ok).toBe(true);
    expect(setInfoHiddenMock).toHaveBeenCalledWith(INFO_ID, "user-1", false);
  });

  it("excluir imagem também remove o arquivo do Storage; nota não", async () => {
    deleteInfoMock.mockResolvedValue({ id: INFO_ID, kind: "image", tableId: TABLE_ID });
    expect((await deleteInfoAction(INFO_ID)).ok).toBe(true);
    expect(removeMock).toHaveBeenCalledWith([`${TABLE_ID}/${INFO_ID}`]);

    removeMock.mockClear();
    deleteInfoMock.mockResolvedValue({ id: INFO_ID, kind: "note", tableId: TABLE_ID });
    expect((await deleteInfoAction(INFO_ID)).ok).toBe(true);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("id inválido ou sem permissão não faz nada", async () => {
    expect((await deleteInfoAction("nao-e-uuid")).ok).toBe(false);
    deleteInfoMock.mockResolvedValue(null);
    expect((await deleteInfoAction(INFO_ID)).ok).toBe(false);
    expect(removeMock).not.toHaveBeenCalled();
  });
});
