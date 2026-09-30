"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InfoView } from "@/lib/mesas/info-rules";
import {
  createImageInfoAction,
  createNoteInfoAction,
  deleteInfoAction,
  listInfosAction,
  setInfoHiddenAction,
  updateImageInfoAction,
  updateNoteInfoAction,
  type InfoActionResult,
} from "./info-actions";

/**
 * Infos podem estar ocultas para jogadores, então o conteúdo nunca vai por um
 * canal em tempo real (ele entregaria o mesmo dado a todos). O canal só leva
 * um aviso "mudou"; cada cliente busca a própria lista no servidor, já
 * filtrada para o papel dele. Fica no sidebar (sempre montado) para não
 * perder avisos com a aba fechada.
 */
export function useInfos({ tableId, initialInfos }: { tableId: string; initialInfos: InfoView[] }) {
  const [infos, setInfos] = useState(initialInfos);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`infos:${tableId}`)
      .on("broadcast", { event: "changed" }, async () => {
        const list = await listInfosAction(tableId);
        if (list) setInfos(list);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [tableId]);

  const run = useCallback(async (action: () => Promise<InfoActionResult>) => {
    const result = await action();
    if (result.ok) {
      setInfos(result.infos);
      // O autor não recebe o próprio aviso (padrão do canal); só os outros.
      void channelRef.current?.send({ type: "broadcast", event: "changed", payload: {} });
    }
    return result;
  }, []);

  const actions = {
    createNote: (input: { name: string; description: string }) => run(() => createNoteInfoAction(tableId, input)),
    createImage: (formData: FormData) => run(() => createImageInfoAction(tableId, formData)),
    updateNote: (infoId: string, input: { name: string; description: string }) =>
      run(() => updateNoteInfoAction(infoId, input)),
    updateImage: (infoId: string, formData: FormData) => run(() => updateImageInfoAction(infoId, formData)),
    setHidden: (infoId: string, hidden: boolean) => run(() => setInfoHiddenAction(infoId, hidden)),
    remove: (infoId: string) => run(() => deleteInfoAction(infoId)),
  };

  return { infos, actions };
}

export type InfoActions = ReturnType<typeof useInfos>["actions"];
