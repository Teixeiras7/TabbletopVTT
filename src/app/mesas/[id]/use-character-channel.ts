"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Canal de aviso dos personagens da mesa (`characters:<mesa>`). Só leva "mudou"; ninguém recebe dado da ficha
 * por aqui (a ficha só é entregue pelo servidor, a quem pode vê-la). Quem mudou algo chama `notify`; os outros
 * participantes (e a janela separada da ficha) recebem `onRemoteChange` e buscam de novo.
 */
export function useCharacterChannel(tableId: string, onRemoteChange: () => void) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const handlerRef = useRef(onRemoteChange);
  useEffect(() => {
    handlerRef.current = onRemoteChange;
  }, [onRemoteChange]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`characters:${tableId}`)
      .on("broadcast", { event: "changed" }, () => handlerRef.current())
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [tableId]);

  return useCallback(() => {
    void channelRef.current?.send({ type: "broadcast", event: "changed", payload: {} });
  }, []);
}
