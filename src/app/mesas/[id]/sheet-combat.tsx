"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionCost } from "@/lib/catalog/schemas";
import {
  ATTRIBUTE_LABELS,
  WEAKENED_EFFECT,
  canSpend,
  spiralBranches,
  spiralStatus,
  validActionsUsed,
  type ActionRow,
  type CharacterSheet,
} from "@/lib/engine/character";
import { cn } from "@/lib/utils";
import { Section } from "./sheet-ficha";
import { VitalitySpiral } from "./vitality-spiral";

type Kind = ActionCost | "free";
const KINDS: { kind: Kind; label: string }[] = [
  { kind: "attack", label: "Ataque" },
  { kind: "quick", label: "Rápida" },
  { kind: "full", label: "Completa" },
  { kind: "free", label: "Sem custo" },
];

/**
 * Combate: espiral vital pequena (marca o dano aqui também), efeitos, armas e ações. A vez de cada um fica na lista
 * de turnos do mapa; ao chegar a vez, as ações zeram. "Usar" segue o livro (p. 201): 2 rápidas, ou 1 rápida + 1 ataque,
 * ou 1 completa.
 */
export function CombatTab({
  sheet,
  actions,
  marks,
  onMarks,
  actionsUsed,
  onActionsUsed,
}: {
  sheet: CharacterSheet;
  actions: ActionRow[];
  marks: number[];
  onMarks: (next: number[]) => void;
  actionsUsed: ActionCost[];
  onActionsUsed: (next: ActionCost[]) => void;
}) {
  const [kind, setKind] = useState<Kind>("quick");
  const [open, setOpen] = useState<string | null>(null);
  const status = spiralStatus(spiralBranches(sheet.vitality), marks);
  const baseRule = sheet.archetype.rules.find((r) => r.startsWith("Base:"))?.replace(/^Base:\s*/, "").replace(/\*\*/g, "");
  const buffs = [...(baseRule ? [`Arquétipo ${sheet.archetype.name}: ${baseRule}`] : []), ...sheet.modifiers];
  const debuffs = status.aspects.filter((a) => a.weakened).map((a) => `${ATTRIBUTE_LABELS[a.aspect]} enfraquecido: ${WEAKENED_EFFECT[a.aspect]}`);
  const kindOf = (a: ActionRow): Kind => a.effectiveCost;
  const list = actions.filter((a) => kindOf(a) === kind);

  const spend = (cost: ActionCost) => {
    const next = [...actionsUsed, cost];
    if (validActionsUsed(next)) onActionsUsed(next);
  };

  return (
    <div className="space-y-7">
      <div className="grid gap-x-8 gap-y-7 sm:grid-cols-[auto_1fr]">
        <Section title="Vitalidade">
          <VitalitySpiral vitality={sheet.vitality} marks={marks} onMarks={onMarks} compact small />
        </Section>

        <Section title="Buffs e debuffs">
          {buffs.length === 0 && debuffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum efeito ativo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {buffs.map((b) => (
                <Chip key={b} tag="Buff" text={b} />
              ))}
              {debuffs.map((d) => (
                <Chip key={d} tag="Debuff" text={d} bad />
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Armas">
        <p className="text-sm text-muted-foreground">Nenhuma arma. Vêm do equipamento (aba Loja).</p>
      </Section>

      <Section title="Ações">
        <div role="tablist" className="flex flex-wrap gap-1 border-b border-border">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="tab"
              aria-selected={kind === k.kind}
              onClick={() => setKind(k.kind)}
              className={cn(
                "-mb-px border-b-2 px-2.5 py-2 text-sm transition-colors",
                kind === k.kind ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k.label}
              <span className="ml-1 opacity-60">{actions.filter((a) => kindOf(a) === k.kind).length}</span>
            </button>
          ))}
        </div>
        <ul>
          {list.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nenhuma ação deste tipo.</li>}
          {list.map((a) => {
            const details = [a.reason, a.note].filter(Boolean);
            const expanded = open === a.slug;
            const cost = a.effectiveCost === "free" ? null : a.effectiveCost;
            return (
              <li key={a.slug} className="flex items-start gap-3 border-b border-border px-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={details.length === 0}
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : a.slug)}
                    className="flex items-center gap-1.5 text-left text-sm enabled:hover:text-primary"
                  >
                    {details.length > 0 && (
                      <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
                    )}
                    {a.name}
                  </button>
                  {expanded && (
                    <div className="mt-1 space-y-0.5 pl-5 text-sm text-muted-foreground">
                      {details.map((d) => (
                        <p key={d}>{d}</p>
                      ))}
                    </div>
                  )}
                </div>
                {cost ? (
                  <Button type="button" size="sm" variant="outline" disabled={!canSpend(actionsUsed, cost)} onClick={() => spend(cost)}>
                    Usar
                  </Button>
                ) : (
                  <span className="pt-1 text-xs text-primary">sem custo</span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

function Chip({ tag, text, bad = false }: { tag: string; text: string; bad?: boolean }) {
  return (
    <span className={cn("rounded-lg border px-2.5 py-1.5 text-sm", bad ? "border-destructive/50" : "border-border")}>
      <b className={cn("mr-1.5 text-[11px] font-medium tracking-wider uppercase", bad ? "text-destructive" : "text-primary")}>{tag}</b>
      {text}
    </span>
  );
}
