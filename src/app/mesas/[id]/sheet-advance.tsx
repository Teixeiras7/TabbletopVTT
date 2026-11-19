"use client";

import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ATTRIBUTE_LABELS, type Advance, type SkillOption } from "@/lib/engine/character";
import type { CharacterView } from "@/lib/mesas/characters";
import { cn } from "@/lib/utils";
import { chooseAdvanceAction } from "./character-actions";

type Next = NonNullable<CharacterView["advance"]>;
const STAGE_LABEL = { hero: "Herói", veteran: "Veterano", epic: "Épico" } as const;
const field = "h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Bolinha verde no canto da ficha quando o XP liberou progressões; abre a escolha da próxima. */
export function AdvanceBadge({ characterId, next, onChanged }: { characterId: string; next: CharacterView["advance"]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  if (!next) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${next.pendingCount} ${next.pendingCount === 1 ? "progressão liberada" : "progressões liberadas"} pelo XP`}
        aria-label="Subir de nível: escolher progressão"
        className="relative ml-auto flex size-7 shrink-0 items-center justify-center self-center rounded-full border-2 border-emerald-500 text-emerald-500 transition-colors hover:bg-emerald-500/10"
      >
        <ChevronUp className="size-4" strokeWidth={2.5} />
        {next.pendingCount > 1 && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-card text-[10px] font-semibold text-emerald-500">
            {next.pendingCount}
          </span>
        )}
      </button>
      {open && (
        <AdvanceDialog
          characterId={characterId}
          next={next}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function AdvanceDialog({ characterId, next, onClose, onDone }: { characterId: string; next: Next; onClose: () => void; onDone: () => void }) {
  const { row, options } = next;
  const [draft, setDraft] = useState<Omit<Advance, "xp" | "grant">>({});
  const [mode, setMode] = useState<"benefit" | "career">("benefit");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Advance>) => setDraft((d) => ({ ...d, ...patch }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const advance = { ...draft, xp: row.xp, grant: row.grant, ...(row.grant === "archetype-benefit-or-career" && mode === "benefit" ? { career: undefined, skills: undefined } : {}) };
    const result = await chooseAdvanceAction(characterId, advance);
    setSaving(false);
    if (result.ok) onDone();
    else setErrors(result.errors);
  }

  const career = options.careers.find((c) => c.slug === draft.career);
  const chooseKinds = [
    { kind: "military" as const, label: "Perícia militar", count: options.military.length },
    { kind: "ability" as const, label: "Habilidade", count: options.abilities.length },
    { kind: "connection" as const, label: "Conexão", count: options.connections.length },
    { kind: "spell" as const, label: "Magia", count: options.spells.length },
  ];
  const ability = options.abilities.find((a) => `${a.slug}|${a.param ?? ""}` === `${draft.ability}|${draft.param ?? ""}` || (a.freeParam && a.slug === draft.ability));
  const benefit = options.benefits.find((b) => b.slug === draft.benefit);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>Progressão de {row.xp} XP</DialogTitle>
        <DialogDescription>
          {next.text}. Estágio {STAGE_LABEL[next.stage]}
          {next.pendingCount > 1 && ` · faltam ${next.pendingCount - 1} depois desta`}.
        </DialogDescription>

        <form onSubmit={submit} className="space-y-4">
          {row.grant === "professional-points" && <TwoPoints options={options.professional} value={draft.skills} onChange={(skills) => set({ skills })} />}

          {row.grant === "attribute" && (
            <div className="grid grid-cols-3 gap-2">
              {options.attributes.map((a) => (
                <Choice key={a.attribute} selected={draft.attribute === a.attribute} onClick={() => set({ attribute: a.attribute })}>
                  <span className="block font-medium">{ATTRIBUTE_LABELS[a.attribute]}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {a.value} → {a.value + 1} (máx. {a.max})
                  </span>
                </Choice>
              ))}
              {options.attributes.length === 0 && <p className="col-span-3 text-sm text-muted-foreground">Todos os atributos estão no máximo do estágio.</p>}
            </div>
          )}

          {row.grant === "choose-one" && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {chooseKinds.map((k) => (
                  <Choice key={k.kind} selected={draft.kind === k.kind} disabled={k.count === 0} onClick={() => setDraft({ kind: k.kind })}>
                    <span className="block text-sm font-medium">{k.label}</span>
                    <span className="text-xs text-muted-foreground">{k.count ? `${k.count} opções` : "nenhuma"}</span>
                  </Choice>
                ))}
              </div>
              {draft.kind === "military" && <SkillSelect label="Perícia militar (+1 nível)" options={options.military} value={draft.skills?.[0]} onChange={(s) => set({ skills: s ? [s] : [] })} />}
              {draft.kind === "ability" && (
                <>
                  <select
                    aria-label="Habilidade"
                    className={field}
                    value={draft.ability ? `${draft.ability}|${ability?.freeParam ? "" : (draft.param ?? "")}` : ""}
                    onChange={(e) => {
                      const [slug, param] = e.target.value.split("|");
                      set({ ability: slug || undefined, param: param || undefined });
                    }}
                  >
                    <option value="">Escolha a habilidade…</option>
                    {options.abilities.map((a) => (
                      <option key={`${a.slug}|${a.param ?? ""}`} value={`${a.slug}|${a.param ?? ""}`}>
                        {a.name}
                        {a.param ? ` (${a.param})` : ""}
                      </option>
                    ))}
                  </select>
                  {ability?.freeParam && <Input aria-label="Qual?" placeholder="Qual? (ex.: idioma, arma)" value={draft.param ?? ""} onChange={(e) => set({ param: e.target.value })} maxLength={60} />}
                </>
              )}
              {draft.kind === "connection" && (
                <select aria-label="Conexão" className={field} value={draft.connection ?? ""} onChange={(e) => set({ connection: e.target.value || undefined })}>
                  <option value="">Escolha a conexão…</option>
                  {options.connections.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
              {draft.kind === "spell" && (
                <select aria-label="Magia" className={field} value={draft.spell ?? ""} onChange={(e) => set({ spell: e.target.value || undefined })}>
                  <option value="">Escolha a magia…</option>
                  {options.spells.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          {row.grant === "archetype-benefit-or-career" && (
            <div className="grid grid-cols-2 gap-2">
              <Choice selected={mode === "benefit"} onClick={() => (setMode("benefit"), setDraft({}))}>
                <span className="text-sm font-medium">Benefício de arquétipo</span>
              </Choice>
              <Choice selected={mode === "career"} disabled={options.careers.length === 0} onClick={() => (setMode("career"), setDraft({}))}>
                <span className="text-sm font-medium">Nova carreira + 2 perícias</span>
              </Choice>
            </div>
          )}

          {(row.grant === "archetype-benefit" || (row.grant === "archetype-benefit-or-career" && mode === "benefit")) && (
            <>
              <select aria-label="Benefício" className={field} value={draft.benefit ?? ""} onChange={(e) => setDraft({ benefit: e.target.value || undefined })}>
                <option value="">Escolha o benefício…</option>
                {options.benefits.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
              {benefit?.param && (
                <select aria-label="Escolha do benefício" className={field} value={draft.param ?? ""} onChange={(e) => set({ param: e.target.value || undefined })}>
                  <option value="">{benefit.param === "skill" ? "Qual perícia militar?" : "Qual magia?"}</option>
                  {benefit.paramOptions.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          {row.grant === "archetype-benefit-or-career" && mode === "career" && (
            <>
              <select aria-label="Carreira" className={field} value={draft.career ?? ""} onChange={(e) => setDraft({ career: e.target.value || undefined })}>
                <option value="">Escolha a carreira…</option>
                {options.careers.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              {career && career.variants.length > 0 && (
                <select aria-label="Variante" className={field} value={draft.variant ?? ""} onChange={(e) => set({ variant: e.target.value || undefined })}>
                  <option value="">Escolha a variante…</option>
                  {career.variants.map((v) => (
                    <option key={v.slug} value={v.slug}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
              {career && <TwoPoints options={career.professional} value={draft.skills} onChange={(skills) => set({ skills })} />}
              <p className="text-xs text-muted-foreground">A carreira nova não dá os itens iniciais; abre as listas dela para as próximas progressões (p. 152).</p>
            </>
          )}

          {errors.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              {errors.join(" ")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Depois
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** +2 perícias profissionais: dois pontos, podem ir na mesma perícia (o servidor confere o máximo). */
function TwoPoints({ options, value, onChange }: { options: SkillOption[]; value: Advance["skills"]; onChange: (v: NonNullable<Advance["skills"]>) => void }) {
  const picks = value ?? [];
  const setAt = (i: number, pick: { skill: string; specialty?: string } | null) => {
    const next = [picks[0] ?? null, picks[1] ?? null];
    next[i] = pick;
    onChange(next.filter((p): p is { skill: string; specialty?: string } => !!p));
  };
  if (options.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma perícia profissional das carreiras pode subir agora.</p>;
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <SkillSelect key={i} label={`${i + 1}º ponto (+1 nível)`} options={options} value={picks[i]} onChange={(s) => setAt(i, s)} />
      ))}
    </div>
  );
}

function SkillSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SkillOption[];
  value: { skill: string; specialty?: string } | undefined;
  onChange: (v: { skill: string; specialty?: string } | null) => void;
}) {
  const keyOf = (o: SkillOption) => `${o.skill}|${o.freeSpecialty ? "*" : (o.specialty ?? "")}`;
  const selected = value ? options.find((o) => o.skill === value.skill && (o.freeSpecialty ? !options.some((x) => !x.freeSpecialty && x.skill === value.skill && x.specialty === (value.specialty ?? null)) : o.specialty === (value.specialty ?? null))) : undefined;
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        className={field}
        value={selected ? keyOf(selected) : ""}
        onChange={(e) => {
          const o = options.find((x) => keyOf(x) === e.target.value);
          onChange(o ? { skill: o.skill, specialty: o.freeSpecialty ? "" : (o.specialty ?? undefined) } : null);
        }}
      >
        <option value="">Escolha…</option>
        {options.map((o) => (
          <option key={keyOf(o)} value={keyOf(o)}>
            {o.name}
            {o.freeSpecialty ? " (nova especialidade)" : o.specialty ? ` (${o.specialty})` : ""} — nív. {o.level} → {o.level + 1} (máx. {o.cap})
          </option>
        ))}
      </select>
      {selected?.freeSpecialty && (
        <Input placeholder="Qual especialidade?" value={value?.specialty ?? ""} onChange={(e) => onChange({ skill: selected.skill, specialty: e.target.value })} maxLength={60} />
      )}
    </label>
  );
}

function Choice({ selected, disabled = false, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-40",
        selected ? "border-primary bg-primary/10" : "border-border enabled:hover:bg-accent/50",
      )}
    >
      {children}
    </button>
  );
}
