import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCharacter } from "@/lib/mesas/characters";
import { characterIdSchema } from "@/lib/mesas/character-schemas";
import { mesaIdSchema } from "@/lib/mesas/schemas";
import { CharacterWindow } from "./character-window";

export const metadata = { title: "Ficha" };

// Ficha numa janela separada (aberta pelo botão do modal). Mesma ficha do modal, só leitura para
// quem não é o dono; se alguém muda algo, a janela se atualiza sozinha (aviso do canal da mesa).
export default async function FichaWindowPage({ params }: { params: Promise<{ id: string; charId: string }> }) {
  const user = await requireUser();
  const { id, charId } = await params;
  if (!mesaIdSchema.safeParse(id).success || !characterIdSchema.safeParse(charId).success) notFound();

  const view = await getCharacter(charId, user.id);
  if (!view || view.tableId !== id) notFound();

  return <CharacterWindow tableId={id} view={view} />;
}
