// Regras da aba Infos. Sem "server-only" de propósito: o backend decide, e a
// tela usa as mesmas funções só para mostrar ou esconder botões.

export type InfoKind = "image" | "note";

export type InfoView = {
  id: string;
  kind: InfoKind;
  name: string;
  description: string | null;
  imageUrl: string | null;
  createdBy: string;
  hidden: boolean;
};

/** Imagem: só o Mestre. Nota: qualquer participante. */
export function canCreateInfo(kind: InfoKind, userId: string, ownerId: string) {
  return kind === "note" || userId === ownerId;
}

/** Info criada pelo Mestre: só ele edita/exclui. Criada por jogador: qualquer participante. */
export function canEditInfo(info: { createdBy: string }, userId: string, ownerId: string) {
  return info.createdBy === ownerId ? userId === ownerId : true;
}

/** Só o Mestre oculta/mostra, e só o que ele mesmo criou. */
export function canHideInfo(info: { createdBy: string }, userId: string, ownerId: string) {
  return userId === ownerId && info.createdBy === ownerId;
}
