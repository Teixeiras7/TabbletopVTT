"use client";

import { useState } from "react";
import { ATTRIBUTES, type Attribute, type Skill } from "@/lib/catalog/schemas";
import { ATTRIBUTE_LABELS, type CharacterSheet, type SpiralAspect } from "@/lib/engine/character";
import { cn } from "@/lib/utils";
import { Section } from "./sheet-ficha";
import { ASPECT_COLOR } from "./vitality-spiral";

const CATEGORY_LABEL: Record<Skill["category"], string> = { military: "Militares", professional: "Profissionais", general: "Gerais" };
const ORDER: Skill["category"][] = ["military", "professional", "general"];
/** Atributo → aspecto do livro (Físico: FIS/VEL/FOR; Agilidade: AGI/MAE/DES; Intelecto: INT/ARC/PER), para a cor. */
const ASPECT_OF: Partial<Record<string, SpiralAspect>> = { FIS: "FIS", VEL: "FIS", FOR: "FIS", AGI: "AGI", MAE: "AGI", DES: "AGI", INT: "INT", ARC: "INT", PER: "INT" };
/** Sigla curta para a coluna do atributo ("AGI ou INT (o menor dos dois)" → "AGI/INT"); o texto inteiro fica no title. */
const shortAttribute = (text: string) => text.match(/\b(FIS|VEL|FOR|AGI|DES|MAE|INT|ARC|PER)\b/g)?.join("/") ?? text;

type Row = {
  key: string;
  slug: string;
  name: string;
  specialty: string | null;
  category: Skill["category"];
  attributeText: string;
  social: boolean;
  owned: boolean;
  level: number;
  /** Total já calculado (atributo + nível), valor do atributo sem treino, ou 0 se exige treino. null = perícia social (escolher o atributo). */
  fixedTotal: number | null;
  needsTraining: boolean;
};

/**
 * Todas as perícias do jogo, com as do personagem marcadas (para saber o que rolar mesmo sem ter a perícia).
 * Sem a perícia: valor do atributo se pode usar sem treino, 0 se exige treino. Social: o jogador escolhe o atributo.
 */
export function SkillsTab({ sheet }: { sheet: CharacterSheet }) {
  const [social, setSocial] = useState<Record<string, Attribute | "">>({});

  const rows: Row[] = [
    ...sheet.skills.map((s): Row => ({
      key: `${s.slug}|${s.specialty ?? ""}`,
      slug: s.slug,
      name: s.name,
      specialty: s.specialty,
      category: s.category,
      attributeText: s.attribute,
      social: s.attribute.toLowerCase().startsWith("social"),
      owned: true,
      level: s.level,
      fixedTotal: s.total,
      needsTraining: false,
    })),
    ...sheet.otherSkills.map((s): Row => ({
      key: s.slug,
      slug: s.slug,
      name: s.name,
      specialty: null,
      category: s.category,
      attributeText: s.attributeText,
      social: s.attribute === "SOCIAL",
      owned: false,
      level: 0,
      fixedTotal: s.needsTraining ? 0 : s.base,
      needsTraining: s.needsTraining,
    })),
  ].sort((a, b) => (a.category === b.category ? a.name.localeCompare(b.name, "pt-BR") : ORDER.indexOf(a.category) - ORDER.indexOf(b.category)));

  const available = ATTRIBUTES.filter((a) => sheet.attributes[a] !== null);

  return (
    <div className="space-y-6">
      {ORDER.map((category) => {
        const list = rows.filter((r) => r.category === category);
        if (list.length === 0) return null;
        return (
          <Section key={category} title={CATEGORY_LABEL[category]} count={list.length}>
            <ul className="grid gap-x-7 sm:grid-cols-2">
              {list.map((r) => {
                const chosen = social[r.key] ?? "";
                const showSelect = r.social && !(r.needsTraining && !r.owned);
                const total = showSelect ? (chosen ? (sheet.attributes[chosen] ?? 0) + r.level : null) : r.fixedTotal;
                const aspect = ASPECT_OF[r.attributeText.split(/\W/)[0] ?? ""];
                const badge = "flex h-5 w-full items-center justify-center rounded border px-1 text-[10.5px] font-semibold tracking-wide";
                return (
                  <li key={r.key} className="grid grid-cols-[1fr_2.75rem_4.5rem_1.75rem] items-center gap-2 border-b border-border py-1.5">
                    <span className={cn("min-w-0 truncate text-sm", r.owned ? "font-semibold" : "text-muted-foreground")}>
                      {r.name}
                      {r.specialty && <span className="font-normal text-muted-foreground"> ({r.specialty})</span>}
                    </span>
                    <span className="text-right text-[11px] text-primary">{r.owned ? `nív. ${r.level}` : ""}</span>
                    {showSelect ? (
                      // Social: o quadradinho é a própria lista (outra cor); clicar abre a escolha do atributo.
                      <select
                        aria-label={`Atributo para ${r.name}`}
                        value={chosen}
                        onChange={(e) => setSocial({ ...social, [r.key]: e.target.value as Attribute | "" })}
                        className={cn(badge, "cursor-pointer appearance-none border-foreground/40 bg-accent text-center text-foreground")}
                      >
                        <option value="">escolher</option>
                        {available.map((a) => (
                          <option key={a} value={a}>
                            {a} · {ATTRIBUTE_LABELS[a]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        title={r.attributeText}
                        className={badge}
                        style={aspect ? { color: ASPECT_COLOR[aspect], borderColor: `color-mix(in oklch, ${ASPECT_COLOR[aspect]} 40%, transparent)` } : undefined}
                      >
                        {shortAttribute(r.attributeText)}
                      </span>
                    )}
                    <span
                      className={cn("text-right font-serif text-base tabular-nums", r.owned ? "font-semibold" : "text-muted-foreground")}
                      title={!r.owned && r.needsTraining ? "Exige treino" : undefined}
                    >
                      {!r.owned && r.needsTraining ? "—" : (total ?? "—")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Sem treino, a perícia usa o valor do atributo; as que exigem treino aparecem com “—”. Nas sociais, escolha o atributo.
      </p>
    </div>
  );
}
