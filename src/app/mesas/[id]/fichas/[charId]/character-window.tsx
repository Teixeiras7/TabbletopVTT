"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CharacterView } from "@/lib/mesas/characters";
import { SHEETS_CHANNEL } from "@/lib/mesas/map";
import { CharacterSheetView } from "../../character-sheet";
import { useCharacterChannel } from "../../use-character-channel";

/**
 * Ficha numa janela separada. Quando outra pessoa (o dono ou o Mestre) muda algo, a janela recebe o aviso do
 * canal da mesa e busca a ficha de novo; quando a própria janela muda algo, avisa os outros.
 */
export function CharacterWindow({ tableId, view }: { tableId: string; view: CharacterView }) {
  const router = useRouter();
  const [tab, setTab] = useState("ficha");
  const notify = useCharacterChannel(tableId, () => router.refresh());
  // Combate na mesa (outra janela): as ações do personagem da vez zeraram; busca a ficha de novo.
  useEffect(() => {
    const channel = new BroadcastChannel(SHEETS_CHANNEL);
    channel.onmessage = () => router.refresh();
    return () => channel.close();
  }, [router]);
  const signature = JSON.stringify([view.name, view.imageUrl, view.marks, view.actionsUsed, view.notes, view.sheet?.details]);

  return (
    // Fundo igual ao do modal: as abas fixas no topo usam a mesma cor.
    <main className="min-h-dvh bg-card"><div className="mx-auto max-w-4xl p-5 sm:p-8">
      <CharacterSheetView key={signature} view={view} tab={tab} onTabChange={setTab} onChanged={notify} onDeleted={() => window.close()} />
    </div></main>
  );
}
