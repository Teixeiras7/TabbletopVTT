export type MesaRole = "master" | "player";

/** Criador da mesa é o Mestre; qualquer outro participante é Jogador (CLAUDE.md §17). */
export function roleOf(ownerId: string, userId: string): MesaRole {
  return ownerId === userId ? "master" : "player";
}
