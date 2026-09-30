"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MesaMember } from "@/lib/mesas/queries";
import { RoleBadge } from "@/components/role-badge";

// Presence é efêmero (quem está com a mesa aberta agora) — nunca gravado no
// banco, nunca passa pelo backend (docs/arquitetura.md §7.1). O restante
// (nome, papel, data de entrada) vem do roster já carregado no servidor.
export function OnlinePanel({
  tableId,
  members,
  currentUserId,
  displayName,
}: {
  tableId: string;
  members: MesaMember[];
  currentUserId: string;
  displayName: string;
}) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set([currentUserId]));

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`presence:mesa:${tableId}`, {
      config: { presence: { key: currentUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ name: displayName });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, currentUserId, displayName]);

  return (
    <ul className="space-y-3">
      {members.map((member) => (
        <li key={member.userId} className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`size-2 shrink-0 rounded-full ${
                onlineIds.has(member.userId) ? "bg-emerald-500" : "bg-muted-foreground/30"
              }`}
              aria-hidden
            />
            <span className="truncate text-sm">
              {member.displayName}
              {member.userId === currentUserId && <span className="text-muted-foreground"> (você)</span>}
            </span>
          </div>
          <RoleBadge role={member.role} />
        </li>
      ))}
    </ul>
  );
}
