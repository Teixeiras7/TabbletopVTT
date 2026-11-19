"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAuthedRealtimeClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/mesas/chat";
import { clearAllChatAction, clearMyChatAction, sendChatMessageAction } from "./actions";

const CHAT_LIMIT = 100; // o mesmo que o banco guarda (src/lib/mesas/chat.ts)

// Colunas como estão no Postgres — é o que o Realtime entrega.
type ChatRow = {
  id: string;
  mesa_id: string;
  rolagem: ChatMessage["roll"];
  autor_id: string;
  autor_nome: string;
  texto: string;
  criado_em: string;
};

function addMessage(prev: ChatMessage[], message: ChatMessage) {
  if (prev.some((m) => m.id === message.id)) return prev;
  return [...prev, message].slice(-CHAT_LIMIT);
}

/**
 * O estado do chat vive no sidebar (sempre montado), não no painel: senão
 * mensagens que chegam com o painel fechado ou em outra aba se perderiam.
 */
export function useChat({
  tableId,
  currentUserId,
  initialMessages,
}: {
  tableId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(false);

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    void createAuthedRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const channel = supabase
        .channel(`chat:${tableId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "mensagens",
          },
          (payload) => {
            const row = payload.new as ChatRow;
            // Filtrado aqui, não no Realtime: o filtro do servidor parou de casar depois da renomeação das colunas.
            if (row.mesa_id !== tableId) return;
            setMessages((prev) =>
              addMessage(prev, {
                id: row.id,
                authorId: row.autor_id,
                authorName: row.autor_nome,
                content: row.texto,
                roll: row.rolagem ?? null,
                createdAt: row.criado_em,
              }),
            );
            if (row.autor_id !== currentUserId && !openRef.current) setUnread((n) => n + 1);
          },
        )
        // O Realtime não filtra DELETE (nem entrega mais que o id com RLS ligado):
        // ids de outras mesas simplesmente não casam com nada na lista local.
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "mensagens" }, (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setMessages((prev) => prev.filter((m) => m.id !== id));
        })
        .subscribe();
      cleanup = () => void supabase.removeChannel(channel);
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [tableId, currentUserId]);

  const send = useCallback(
    async (content: string) => {
      const result = await sendChatMessageAction(tableId, content);
      if (!result.ok) return false;
      // Mostra na hora, sem esperar o Realtime devolver (addMessage ignora o duplicado que chegar depois).
      setMessages((prev) => addMessage(prev, result.message));
      return true;
    },
    [tableId],
  );

  const clearMine = useCallback(async () => {
    const result = await clearMyChatAction(tableId);
    if (result.ok) setMessages([]);
    return result.ok;
  }, [tableId]);

  const clearAll = useCallback(async () => {
    const result = await clearAllChatAction(tableId);
    if (result.ok) setMessages([]);
    return result.ok;
  }, [tableId]);

  /** Chamado pelo sidebar ao abrir/fechar a aba do chat, para contar só o que chega com ela fechada. */
  const setOpen = useCallback((open: boolean) => {
    openRef.current = open;
    if (open) setUnread(0);
  }, []);

  return { messages, unread, send, clearMine, clearAll, setOpen };
}
