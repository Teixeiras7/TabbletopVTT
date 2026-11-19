"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Progression, Spell, SpellList } from "@/lib/catalog/schemas";
import { cn } from "@/lib/utils";
import { getProgressionAction, getSpellsAction } from "./regras-actions";

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const dash = (value: string | number | null) => (value === null || value === "" ? "—" : String(value));

/** Aba Regras: consultas do livro (magias e progressão por XP). */
export function RegrasPanel({ tableId }: { tableId: string }) {
  const [open, setOpen] = useState<"magias" | "progressao" | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Consulte o conteúdo do livro sem sair da mesa.</p>
      <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setOpen("magias")}>
        <Sparkles className="size-4" /> Magias
      </Button>
      <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setOpen("progressao")}>
        <TrendingUp className="size-4" /> Progressão por XP
      </Button>
      {open === "magias" && <SpellsDialog tableId={tableId} onClose={() => setOpen(null)} />}
      {open === "progressao" && <ProgressionDialog tableId={tableId} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SpellsDialog({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getSpellsAction>> | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [list, setList] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getSpellsAction(tableId).then(setData, () => setData(null));
  }, [tableId]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = normalize(query.trim());
    const allowed = list ? new Set(data.lists.find((l) => l.slug === list)?.entries) : null;
    return data.spells.filter((s) => (!allowed || allowed.has(s.slug)) && normalize(s.name).includes(q));
  }, [data, query, list]);

  return (
    <Dialog modal={false} open onOpenChange={(o) => !o && onClose()}>
      <DialogContent floating className="flex h-[min(52rem,92dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <header className="shrink-0 space-y-3 border-b border-border px-6 pt-5 pb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">Magias</DialogTitle>
          <DialogDescription className="sr-only">Todas as magias do livro, com filtro por nome e carreira.</DialogDescription>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar magia pelo nome" className="h-9 pl-9" />
            </div>
            <select
              aria-label="Carreira"
              value={list}
              onChange={(e) => setList(e.target.value)}
              className="h-9 rounded-md border border-input bg-card px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">Todas as carreiras</option>
              {data?.lists.map((l: SpellList) => (
                <option key={l.slug} value={l.slug}>{l.name}</option>
              ))}
            </select>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {data === undefined && <p className="px-6 py-4 text-sm text-muted-foreground">Carregando as magias…</p>}
          {data === null && <p role="alert" className="px-6 py-4 text-sm text-destructive">Não foi possível carregar as magias.</p>}
          {data && visible.length === 0 && <p className="px-6 py-4 text-sm text-muted-foreground">Nenhuma magia encontrada.</p>}
          <ul className="divide-y divide-border">
            {visible.map((spell) => (
              <SpellRow key={spell.slug} spell={spell} open={expanded === spell.slug} onToggle={() => setExpanded(expanded === spell.slug ? null : spell.slug)} />
            ))}
          </ul>
        </div>
        <p className="shrink-0 border-t border-border px-6 py-2.5 text-xs text-muted-foreground">
          {data ? `${visible.length} de ${data.spells.length} magias` : ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function SpellRow({ spell, open, onToggle }: { spell: Spell; open: boolean; onToggle: () => void }) {
  const stats: [string, string][] = [
    ["Custo", `${spell.cost}${spell.costVariable ? "+" : ""}`],
    ["ALC", dash(spell.range)],
    ["ADE", dash(spell.area)],
    ["POD", dash(spell.pod)],
  ];
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-accent/40">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{spell.name}</span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            {spell.sustainable && <span>Manutenção</span>}
            {spell.offensiveText === "S" && <span className="text-primary">Ofensiva</span>}
            {spell.offensiveText === "*" && <span className="text-primary">Ofensiva (ver texto)</span>}
          </span>
        </span>
        <dl className="hidden gap-4 text-right sm:flex">
          {stats.map(([label, value]) => (
            <div key={label} className="w-12">
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="text-sm tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2 px-6 pb-4">
          <p className="text-xs text-muted-foreground tabular-nums sm:hidden">{stats.map(([l, v]) => `${l} ${v}`).join(" · ")}</p>
          <p className="max-w-prose text-sm leading-relaxed">{spell.text}</p>
          {spell.sourcePage && <p className="text-xs text-muted-foreground">Livro, p. {spell.sourcePage}</p>}
        </div>
      )}
    </li>
  );
}

const STAGES = [
  { key: "hero", label: "Herói" },
  { key: "veteran", label: "Veterano" },
  { key: "epic", label: "Épico" },
] as const;

function ProgressionDialog({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const [data, setData] = useState<Progression | null | undefined>(undefined);
  useEffect(() => {
    getProgressionAction(tableId).then(setData, () => setData(null));
  }, [tableId]);

  return (
    <Dialog modal={false} open onOpenChange={(o) => !o && onClose()}>
      <DialogContent floating className="flex h-[min(52rem,92dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <header className="shrink-0 border-b border-border px-6 pt-5 pb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">Progressão por XP</DialogTitle>
          <DialogDescription className="mt-1">
            Ao chegar no XP total da linha, o personagem ganha a progressão. Ela é escolhida antes da próxima sessão e não pode ser
            guardada (livro, pp. 151-152).
          </DialogDescription>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {data === undefined && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {data === null && <p role="alert" className="text-sm text-destructive">Não foi possível carregar a tabela.</p>}
          {data && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">O que cada progressão dá</h3>
                <dl className="space-y-1.5 text-sm">
                  {Object.entries(data.grants).map(([key, text]) => (
                    <div key={key} className="grid grid-cols-[9rem_1fr] gap-3">
                      <dt className="text-muted-foreground">{GRANT_LABEL[key as keyof typeof GRANT_LABEL]}</dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              {STAGES.map((stage) => (
                <section key={stage.key} className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {stage.label}{" "}
                    <span className="font-normal text-muted-foreground">· perícias até o nível {data.skillMaxLevelByStage[stage.key]}</span>
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-muted-foreground">
                        <th className="w-24 py-1 font-normal">XP total</th>
                        <th className="py-1 font-normal">Progressão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {/* Épico: o livro imprime igual ao Veterano; aqui continua de 5 em 5 depois do 95 (decisão do usuário). */}
                      {(stage.key === "epic" ? data.table.veteran.map((r) => ({ ...r, xp: r.xp + 50 })) : data.table[stage.key]).map((row) => (
                        <tr key={row.xp}>
                          <td className="py-1.5 tabular-nums">{row.xp}</td>
                          <td className="py-1.5">{GRANT_LABEL[row.grant]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
              <p className="text-xs text-muted-foreground">
                Herói até 49 XP, Veterano de 50 a 99, Épico a partir de 100. O livro não diz quando se muda de estágio e imprime
                a tabela de Épico igual à de Veterano; na mesa, o Épico continua de 5 em 5 depois do 95.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const GRANT_LABEL: Record<Progression["table"]["hero"][number]["grant"], string> = {
  "professional-points": "+2 perícias profissionais",
  "choose-one": "+1 perícia militar, habilidade, conexão ou magia",
  attribute: "+1 atributo",
  "archetype-benefit": "+1 benefício de arquétipo",
  "archetype-benefit-or-career": "+1 benefício de arquétipo ou nova carreira",
};
