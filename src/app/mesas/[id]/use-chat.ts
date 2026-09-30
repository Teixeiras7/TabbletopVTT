"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/mesas/chat";
import { clearAllChatAction, clearMyChatAction, sendChatMessageAction } from "./actions";

const MAX_IN_MEMORY = 300;

// Colunas como estão no Postgres (snake_case) — é o que o Realtime entrega.
type ChatRow = {
  id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

function addMessage(prev: ChatMessage[], message: ChatMessage) {
  if (prev.some((m) => m.id === message.id)) return prev;
  return [...prev, message].slice(-MAX_IN_MEMORY);
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
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`chat:${tableId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `table_id=eq.${tableId}` },
        (payload) => {
          const row = payload.new as ChatRow;
          setMessages((prev) =>
            addMessage(prev, {
              id: row.id,
              authorId: row.author_id,
              authorName: row.author_name,
              content: row.content,
              createdAt: row.created_at,
            }),
          );
          if (row.author_id !== currentUserId && !openRef.current) setUnread((n) => n + 1);
        },
      )
      // O Realtime não filtra DELETE (nem entrega mais que o id com RLS ligado):
      // ids de outras mesas simplesmente não casam com nada na lista local.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) setMessages((prev) => prev.filter((m) => m.id !== id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
