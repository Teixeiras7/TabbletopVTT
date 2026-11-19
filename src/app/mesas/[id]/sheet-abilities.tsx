"use client";

import { ChevronRight } from "lucide-react";
import type { CharacterSheet } from "@/lib/engine/character";
import { Section } from "./sheet-ficha";

type Item = { key: string; name: string; param: string | null; source: string; text: string; feat: boolean };

export function AbilitiesTab({ sheet }: { sheet: CharacterSheet }) {
  const benefits: Item[] = sheet.benefits.map((b) => ({ ...b, key: `b${b.slug}`, feat: b.isFeat }));
  const abilities: Item[] = sheet.abilities.map((a) => ({ ...a, key: `a${a.slug}${a.param ?? ""}`, feat: false }));

  return (
    <div className="space-y-7">
      <Section title="Benefícios de arquétipo" count={benefits.length}>
        <ItemList items={benefits} />
      </Section>
      <Section title="Habilidades" count={abilities.length}>
        <ItemList items={abilities} />
      </Section>

      <Section title="Mais">
        <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2.5 text-sm">
          <Row label="Idiomas" value={sheet.languages} />
          {sheet.connections.length > 0 && <Row label="Conexões" value={sheet.connections.join(", ")} />}
          <Row label="Dinheiro inicial" value={`${sheet.gold} CO`} />
          {sheet.startingGear.map((g) => (
            <Row key={g.source} label={`Bens (${g.source})`} value={g.text} />
          ))}
        </dl>
        {[...(sheet.race.features ? [`${sheet.race.name}: ${sheet.race.features}`] : []), ...sheet.notes].map((n) => (
          <p key={n} className="border-l-2 border-border pl-2.5 text-xs text-muted-foreground">
            {n}
          </p>
        ))}
      </Section>
    </div>
  );
}

function ItemList({ items }: { items: Item[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nenhum.</p>;
  return (
    <ul>
      {items.map((x) => (
        <li key={x.key} className="border-b border-border">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-0.5 py-2.5 hover:text-primary">
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              <span className="min-w-0 flex-1 font-medium">
                {x.name}
                {x.param && <span className="font-normal text-muted-foreground"> ({x.param})</span>}
                {x.feat && <span className="ml-2 text-xs font-normal text-primary">façanha</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{x.source}</span>
            </summary>
            <p className="pr-0.5 pb-3 pl-6 text-sm text-muted-foreground">{x.text}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </>
  );
}
