"use client";

import { cn } from "@/lib/utils";
import type { CharacterSheet } from "@/lib/engine/character";
import type { CharacterView } from "@/lib/mesas/characters";
import { AttributeDiagram } from "./attribute-diagram";
import { VitalitySpiral } from "./vitality-spiral";

/** Seção da ficha: título curto em maiúsculas, contagem opcional e uma linha até a borda. */
export function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        {title}
        {count !== undefined && <span className="font-normal tracking-normal opacity-70">{count}</span>}
        <span aria-hidden className="h-px flex-1 bg-border" />
      </h3>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5 text-center" title={hint}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl leading-tight font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function Avatar({ name, imageUrl, className }: { name: string; imageUrl: string | null; className?: string }) {
  return imageUrl ? (
    // <img> simples: a imagem já vem do Storage e o otimizador do Next não agrega aqui.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt={`Imagem de ${name}`} className={className} />
  ) : (
    <div className={cn("flex items-center justify-center bg-muted text-2xl font-semibold text-muted-foreground", className)} aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function FichaTab({
  view,
  name,
  sheet,
  imageUrl,
  marks,
  onMarks,
}: {
  view: CharacterView;
  name: string;
  sheet: CharacterSheet;
  imageUrl: string | null;
  marks: number[];
  onMarks: (next: number[]) => void;
}) {
  const { derived } = sheet;
  return (
    <div className="space-y-7">
      <header className="flex items-center gap-4">
        <Avatar name={name} imageUrl={imageUrl} className="size-20 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-2xl leading-tight font-semibold break-words">{name}</h2>
          <p className="text-sm text-muted-foreground">
            {sheet.race.name} · {sheet.archetype.name}
          </p>
          <p className="text-sm text-muted-foreground">{sheet.careers.map((c) => (c.variant ? `${c.name} (${c.variant})` : c.name)).join(" + ")}</p>
          <p className="text-xs text-muted-foreground">
            Herói · {sheet.xp} XP{view.isMaster && view.ownerName ? ` · Jogador: ${view.ownerName}` : ""}
          </p>
        </div>
      </header>

      <div className="grid gap-x-8 gap-y-7 md:grid-cols-[3fr_2fr]">
        <Section title="Atributos">
          <AttributeDiagram attributes={sheet.attributes} limits={sheet.limits} />
        </Section>

        <Section title="Derivados">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Iniciativa" value={derived.initiative} hint="VEL + MAE + PER" />
            <Stat label="Defesa" value={derived.defense} hint="VEL + AGI + PER" />
            <Stat label="Armadura" value={derived.armor} hint="FIS + armadura usada" />
            <Stat label="Vontade" value={derived.willpower} hint="FIS + INT" />
            <Stat label="Comando" value={`${derived.commandRange}″`} hint={`INT + Comandar: ${derived.commandRange * 2} metros`} />
          </div>
          {sheet.modifiers.length > 0 && <p className="text-xs text-muted-foreground">{sheet.modifiers.join(" · ")}</p>}
        </Section>
      </div>

      <Section title="Vitalidade">
        <VitalitySpiral vitality={sheet.vitality} marks={marks} onMarks={onMarks} compact />
        <p className="text-xs text-muted-foreground">Clique num círculo para marcar o dano; clique no último marcado para desfazer.</p>
      </Section>
    </div>
  );
}
