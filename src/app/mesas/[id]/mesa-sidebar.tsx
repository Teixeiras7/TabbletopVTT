"use client";

import { useState } from "react";
import {
  BookOpen,
  Info,
  MessageSquare,
  ScrollText,
  Settings,
  Crown,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MesaRole } from "@/lib/mesas/roles";
import type { MesaMember } from "@/lib/mesas/queries";
import type { ChatMessage } from "@/lib/mesas/chat";
import type { InfoView } from "@/lib/mesas/info-rules";
import { OnlinePanel } from "./online-panel";
import { ConfigPanel } from "./config-panel";
import { ChatPanel } from "./chat-panel";
import type { CharacterSummary } from "@/lib/mesas/characters";
import { FichasPanel } from "./fichas-panel";
import { InfosPanel } from "./infos-panel";
import { LojaPanel } from "./loja-panel";
import { RegrasPanel } from "./regras-panel";
import { MestrePanel } from "./mestre-panel";
import { useChat } from "./use-chat";
import { useCharacters } from "./use-characters";
import { useInfos } from "./use-infos";

type TabId = "chat" | "infos" | "regras" | "mestre" | "loja" | "fichas" | "online" | "config";

type Tab = { id: TabId; label: string; icon: LucideIcon; masterOnly?: boolean };

const TABS: Tab[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "infos", label: "Infos", icon: Info },
  { id: "regras", label: "Regras", icon: BookOpen },
  { id: "mestre", label: "Mestre", icon: Crown, masterOnly: true },
  { id: "loja", label: "Loja", icon: Store },
  { id: "fichas", label: "Fichas", icon: ScrollText },
  { id: "online", label: "Jogadores online", icon: Users },
  { id: "config", label: "Configuração", icon: Settings },
];

export function MesaSidebar({
  table,
  role,
  members,
  currentUserId,
  displayName,
  inviteLink,
  scene,
  initialMessages,
  initialInfos,
  initialCharacters,
}: {
  table: { id: string; name: string; description: string | null; inviteCode: string; ownerId: string };
  role: MesaRole;
  members: MesaMember[];
  currentUserId: string;
  displayName: string;
  inviteLink: string;
  scene: { id: string; gridSize: number; backgroundUrl: string | null };
  initialMessages: ChatMessage[];
  initialInfos: InfoView[];
  initialCharacters: CharacterSummary[];
}) {
  const isMaster = role === "master";
  const tabs = TABS.filter((tab) => !tab.masterOnly || isMaster);
  // null = painel fechado. Clicar no ícone já ativo fecha; clicar em outro troca.
  const [active, setActive] = useState<TabId | null>(null);
  const chat = useChat({ tableId: table.id, currentUserId, initialMessages });
  const infos = useInfos({ tableId: table.id, initialInfos });
  const characters = useCharacters({ tableId: table.id, initialCharacters });

  function handleTabClick(id: TabId) {
    const next = active === id ? null : id;
    setActive(next);
    chat.setOpen(next === "chat");
  }

  const activeTab = tabs.find((tab) => tab.id === active) ?? null;

  return (
    <div className="flex shrink-0">
      <div className="flex w-14 flex-col items-center gap-1 border-l border-border bg-card py-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.label}
            aria-pressed={active === tab.id}
            title={tab.label}
            className={cn(
              "relative flex h-11 w-11 items-center justify-center rounded-md transition-colors",
              active === tab.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <tab.icon className="size-5" />
            {tab.id === "chat" && chat.unread > 0 && (
              <span
                aria-label={`${chat.unread} mensagens não lidas`}
                className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
              />
            )}
          </button>
        ))}
      </div>

      {/* Os painéis ficam montados (só escondidos): as janelas flutuantes que eles abrem (Loja, Magias, XP, Ficha…)
          continuam abertas ao trocar de aba ou fechar o painel. */}
      <div className={cn("flex w-72 flex-col border-l border-border bg-card sm:w-80", !activeTab && "hidden")}>
        <div className="shrink-0 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{activeTab?.label}</h2>
        </div>
        <div className="min-h-0 flex-1">
          <Panel id="chat" active={active} className="overflow-hidden p-0">
            <ChatPanel messages={chat.messages} currentUserId={currentUserId} masterId={table.ownerId} onSend={chat.send} />
          </Panel>
          <Panel id="infos" active={active}>
            <InfosPanel infos={infos.infos} actions={infos.actions} currentUserId={currentUserId} ownerId={table.ownerId} />
          </Panel>
          <Panel id="regras" active={active}>
            <RegrasPanel tableId={table.id} />
          </Panel>
          {isMaster && (
            <Panel id="mestre" active={active}>
              <MestrePanel tableId={table.id} sceneId={scene?.id ?? null} onCharactersChanged={() => void characters.afterChange()} />
            </Panel>
          )}
          <Panel id="loja" active={active}>
            <LojaPanel tableId={table.id} />
          </Panel>
          <Panel id="fichas" active={active}>
            <FichasPanel api={characters} tableId={table.id} currentUserId={currentUserId} isMaster={isMaster} />
          </Panel>
          <Panel id="online" active={active}>
            <OnlinePanel tableId={table.id} members={members} currentUserId={currentUserId} displayName={displayName} />
          </Panel>
          <Panel id="config" active={active}>
            <ConfigPanel
              table={table}
              role={role}
              inviteLink={inviteLink}
              scene={scene}
              onClearMyChat={chat.clearMine}
              onClearAllChat={chat.clearAll}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ id, active, className, children }: { id: TabId; active: TabId | null; className?: string; children: React.ReactNode }) {
  return (
    <div hidden={active !== id} className={cn("h-full overflow-y-auto p-4", className)}>
      {children}
    </div>
  );
}
