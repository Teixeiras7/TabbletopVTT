"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SHEETS_CHANGED_EVENT } from "@/lib/mesas/map";
import type { CharacterSummary } from "@/lib/mesas/characters";
import { listCharactersAction } from "./character-actions";
import { useCharacterChannel } from "./use-character-channel";

/**
 * Lista de personagens da mesa e janelas de ficha abertas. Fica no sidebar (sempre montado) para não perder
 * avisos com a aba fechada. `changeCount` sobe a cada mudança feita por outra pessoa, para modais abertos
 * buscarem de novo.
 */
export function useCharacters({ tableId, initialCharacters }: { tableId: string; initialCharacters: CharacterSummary[] }) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [changeCount, setChangeCount] = useState(0);
  const windowsRef = useRef(new Map<string, Window>());

  const refresh = useCallback(async () => {
    const list = await listCharactersAction(tableId);
    if (list) setCharacters(list);
  }, [tableId]);

  const notify = useCharacterChannel(tableId, () => {
    void refresh();
    setChangeCount((n) => n + 1);
  });

  // Mudança que veio do mapa (combate: as ações do personagem da vez zeram) chega a todos pela cena: busca as fichas.
  useEffect(() => {
    const onChange = () => setChangeCount((n) => n + 1);
    window.addEventListener(SHEETS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SHEETS_CHANGED_EVENT, onChange);
  }, []);

  /** Chamar depois de criar/alterar: atualiza a própria lista e avisa os outros participantes. */
  const afterChange = useCallback(async () => {
    await refresh();
    notify();
  }, [refresh, notify]);

  /** Se a ficha já está aberta numa janela separada, traz essa janela para a frente. */
  const focusWindow = useCallback((id: string) => {
    const w = windowsRef.current.get(id);
    if (w && !w.closed) {
      w.focus();
      return true;
    }
    windowsRef.current.delete(id);
    return false;
  }, []);

  /** Abre a ficha numa janela separada (mesmo nome de janela por personagem: nunca duplica). */
  const openWindow = useCallback(
    (id: string) => {
      const w = window.open(`/mesas/${tableId}/fichas/${id}`, `ficha-${id}`, "popup=yes,width=1040,height=860");
      if (w) windowsRef.current.set(id, w);
      return !!w;
    },
    [tableId],
  );

  return { characters, changeCount, afterChange, notify, focusWindow, openWindow };
}

export type CharactersApi = ReturnType<typeof useCharacters>;
