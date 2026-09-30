"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/mesas/chat";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  messages,
  currentUserId,
  masterId,
  onSend,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  masterId: string;
  onSend: (content: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    const ok = await onSend(content);
    setSending(false);
    if (ok) setDraft("");
    else setError("Não foi possível enviar. Tente de novo.");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
        ) : (
          messages.map((message) => {
            const mine = message.authorId === currentUserId;
            return (
              <div key={message.id} className={cn("space-y-0.5", mine && "text-right")}>
                <div className={cn("flex items-baseline gap-2 text-xs", mine && "justify-end")}>
                  <span
                    className={cn(
                      "font-medium",
                      message.authorId === masterId ? "text-primary" : "text-foreground",
                    )}
                  >
                    {mine ? "Você" : message.authorName}
                    {message.authorId === masterId && " · Mestre"}
                  </span>
                  <span className="text-muted-foreground">{formatTime(message.createdAt)}</span>
                </div>
                <p
                  className={cn(
                    "inline-block max-w-full rounded-lg px-3 py-1.5 text-left text-sm break-words whitespace-pre-wrap",
                    mine ? "bg-primary/15" : "bg-muted",
                  )}
                >
                  {message.content}
                </p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-border p-3">
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escreva uma mensagem…"
            maxLength={1000}
            autoComplete="off"
            aria-label="Mensagem"
          />
          <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label="Enviar">
            <SendHorizontal className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
