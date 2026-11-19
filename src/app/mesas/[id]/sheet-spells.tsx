"use client";

import { useState } from "react";
import type { CharacterSheet } from "@/lib/engine/character";
import { SpellRow } from "./regras-panel";
import { Section } from "./sheet-ficha";

/** Magias que o personagem conhece; clicar abre a descrição do livro (como na consulta da aba Regras). */
export function SpellsTab({ sheet }: { sheet: CharacterSheet }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Section title="Magias conhecidas" count={sheet.spells.length}>
      <p className="text-xs text-muted-foreground">
        {sheet.tradition === "focalizador" ? "Focalizador" : "Tecelão da vontade"} · {sheet.spells.length}
        {sheet.spellLimit !== null && ` de ${sheet.spellLimit}`} magias
      </p>
      <ul className="divide-y divide-border">
        {sheet.spells.map((s) =>
          s.spell ? (
            <SpellRow key={s.slug} spell={s.spell} open={open === s.slug} onToggle={() => setOpen(open === s.slug ? null : s.slug)} />
          ) : (
            <li key={s.slug} className="py-3 text-sm">
              {s.name}
            </li>
          ),
        )}
      </ul>
    </Section>
  );
}
