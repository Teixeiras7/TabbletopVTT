"use client";

import { useState } from "react";
import { ChevronDown, Swords } from "lucide-react";
import { confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import type { CombatState } from "@/lib/engine/combat";
import type { TokenView } from "@/lib/mesas/tokens";
import { cn } from "@/lib/utils";
import { combatAction } from "./actions";

/**
 * Lista de turnos no canto do mapa, enquanto há combate (o Mestre inicia pela aba Mestre). Cada um pode recolher a
 * lista na própria tela. O dono do personagem da vez (ou o Mestre) encerra o turno; o Mestre encerra o combate.
 */
export function CombatTracker({
  sceneId,
  combat,
  tokens,
  currentUserId,
  isMaster,
}: {
  sceneId: string;
  combat: CombatState | null;
  tokens: TokenView[];
  currentUserId: string;
  isMaster: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  async function run(action: "end-turn" | "end") {
    if (action === "end" && !(await confirm("Encerrar o combate?", { confirmLabel: "Encerrar" }))) return;
    setBusy(true);
    const result = await combatAction(sceneId, action);
    setBusy(false);
    setError(result.ok ? null : result.error);
  }

  if (!combat) return null;

  const current = combat.order[combat.turn];
  const owner = tokens.find((t) => t.characterId === current?.characterId)?.ownerId;
  const canEnd = isMaster || owner === currentUserId;

  return (
    <section
      aria-label="Combate"
      className="absolute top-3 left-3 z-10 w-60 rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur-sm"
    >
      <header className={cn("flex items-center justify-between gap-2 px-3 py-2", !collapsed && "border-b border-border")}>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Mostrar a lista" : "Recolher a lista"}
          className="flex min-w-0 items-center gap-1.5 text-sm font-semibold hover:text-primary"
        >
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", collapsed && "-rotate-90")} />
          <Swords className="size-4 shrink-0 text-primary" /> Rodada {combat.round}
          {collapsed && current && <span className="truncate font-normal text-muted-foreground">· {current.name}</span>}
        </button>
        {isMaster && !collapsed && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run("end")}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Encerrar combate
          </button>
        )}
      </header>
      {!collapsed && (
        <>
          <ol className="max-h-72 overflow-y-auto py-1">
            {combat.order.map((i, n) => (
              <li
                key={i.characterId}
                aria-current={n === combat.turn ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm",
                  n === combat.turn
                    ? "bg-primary/15 font-semibold text-foreground"
                    : n < combat.turn
                      ? "text-muted-foreground"
                      : "",
                )}
              >
                <span className="w-6 text-right font-serif tabular-nums" title={`2d6 (${i.rolls.join(" + ")}) + ${i.bonus}`}>
                  {i.total}
                </span>
                <span className="min-w-0 flex-1 truncate">{i.name}</span>
                {n === combat.turn && <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
              </li>
            ))}
          </ol>
          {canEnd && (
            <div className="border-t border-border p-2">
              <Button type="button" size="sm" className="w-full" disabled={busy} onClick={() => run("end-turn")}>
                Encerrar turno{current && owner !== currentUserId ? ` de ${current.name}` : ""}
              </Button>
            </div>
          )}
        </>
      )}
      {error && <p className="px-3 pb-2 text-xs text-destructive">{error}</p>}
    </section>
  );
}
