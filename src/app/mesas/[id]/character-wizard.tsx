"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ATTRIBUTES, type Attribute, type Career, type Catalog } from "@/lib/catalog/schemas";
import {
  ATTRIBUTE_LABELS,
  attributeLimit,
  baseAttributes,
  benefitParamOptions,
  careerBlockReason,
  chooseGroups,
  evaluateCharacter,
  extraAbilityOptions,
  indexCatalog,
  languageSlots,
  type CatalogIndex,
  type CharacterChoices,
  type CharacterDetails,
} from "@/lib/engine/character";
import { cn } from "@/lib/utils";
import { BACKGROUND_TOO_BIG_MESSAGE, MAX_BACKGROUND_BYTES } from "@/lib/mesas/map";
import { createCharacterAction, getWizardCatalogAction, uploadCharacterImageAction } from "./character-actions";

const STEPS = ["Raça", "Arquétipo", "Carreiras", "Atributos", "Toques finais"] as const;
const EMPTY_CHOICES: CharacterChoices = { race: "", archetype: "", archetypeBenefit: "", careers: [], attributePoints: {} };
const EMPTY_DETAILS: CharacterDetails = { name: "", age: "", nationality: "", filiation: "", organization: "", height: "", weight: "", crimes: "", appearance: "" };
const NATION_LABEL: Record<string, string> = { cygnarano: "Cygnarano", khadorano: "Khadorano" };

export function CharacterWizard({
  tableId,
  open,
  onOpenChange,
  onCreated,
}: {
  tableId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** imageError: a imagem não subiu, mas o personagem foi criado (dá para anexar depois, em Pessoal). */
  onCreated: (id: string, imageError: string | null) => void;
}) {
  return (
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent floating className="flex h-[92dvh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogTitle className="sr-only">Criar personagem</DialogTitle>
        <DialogDescription className="sr-only">Passo a passo da criação de personagem de Reinos de Ferro.</DialogDescription>
        {/* Montado só enquanto aberto: fechar descarta o rascunho. */}
        {open && <WizardBody tableId={tableId} onClose={() => onOpenChange(false)} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  );
}

function Option({
  selected,
  disabled,
  onClick,
  children,
  className,
}: {
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        selected && "border-primary bg-primary/10 hover:bg-primary/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

const nameOf = (idx: CatalogIndex, slug: string) => idx.skills.get(slug)?.name ?? slug;
const abilityName = (idx: CatalogIndex, slug: string) => idx.abilities.get(slug)?.name ?? slug;

function WizardBody({ tableId, onClose, onCreated }: { tableId: string; onClose: () => void; onCreated: (id: string, imageError: string | null) => void }) {
  const [catalog, setCatalog] = useState<Catalog | null | "error">(null);
  const [step, setStep] = useState(1);
  const [choices, setChoices] = useState<CharacterChoices>(EMPTY_CHOICES);
  const [details, setDetails] = useState<CharacterDetails>(EMPTY_DETAILS);
  const [submitting, setSubmitting] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWizardCatalogAction(tableId).then((c) => {
      if (!cancelled) setCatalog(c ?? "error");
    });
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  const idx = useMemo(() => (catalog && catalog !== "error" ? indexCatalog(catalog) : null), [catalog]);
  const evaluation = useMemo(() => (idx ? evaluateCharacter(idx, choices, details) : null), [idx, choices, details]);

  if (catalog === "error") {
    return <p className="p-6 text-sm text-destructive">Não foi possível carregar o catálogo do livro. Feche e tente de novo.</p>;
  }
  if (!idx || !evaluation) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando o catálogo do livro…</p>;
  }

  const stepErrors = evaluation.errors.filter((e) => e.step <= step);
  const race = idx.races.get(choices.race);
  const archetype = idx.archetypes.get(choices.archetype);

  // Mudar uma escolha invalida o que depende dela (carreiras, pontos…), então volta a zero.
  const resetFrom = (level: "race" | "archetype" | "benefit" | "careers"): Partial<CharacterChoices> => ({
    ...(level === "race" ? { raceAttributeChoice: undefined, archetype: "", archetypeBenefit: "" } : {}),
    ...(level === "race" || level === "archetype" ? { archetypeBenefit: "" } : {}),
    archetypeBenefitParam: undefined,
    ...(level !== "benefit" ? { careers: [], extraAbility: undefined, attributePoints: {} } : {}),
  });
  const patch = (p: Partial<CharacterChoices>) => setChoices((c) => ({ ...c, ...p }));

  const careerPick = (slug: string) => {
    const career = idx.careers.get(slug)!;
    return { career: slug, variant: undefined, skillChoices: chooseGroups(career).map(() => []), languages: Array.from({ length: languageSlots(career) }, () => "") };
  };
  const toggleCareer = (slug: string) => {
    const has = choices.careers.some((p) => p.career === slug);
    const careers = has ? choices.careers.filter((p) => p.career !== slug) : [...choices.careers, careerPick(slug)];
    patch({ careers, extraAbility: undefined, archetypeBenefitParam: undefined, attributePoints: {} });
    const nation = idx.careers.get(slug)?.prerequisites.nation;
    if (!has && nation) setDetails((d) => ({ ...d, nationality: NATION_LABEL[nation] ?? nation }));
  };
  const updatePick = (slug: string, p: Partial<(typeof choices.careers)[number]>, resetPoints = false) =>
    setChoices((c) => ({
      ...c,
      careers: c.careers.map((x) => (x.career === slug ? { ...x, ...p } : x)),
      ...(resetPoints ? { attributePoints: {}, extraAbility: undefined, archetypeBenefitParam: undefined } : {}),
    }));

  const base = baseAttributes(idx, choices);
  const spent = ATTRIBUTES.reduce((s, a) => s + (choices.attributePoints[a] ?? 0), 0);
  const remaining = idx.attributePoints - spent;
  const setPoints = (attr: Attribute, delta: number) => {
    const n = (choices.attributePoints[attr] ?? 0) + delta;
    const limit = attributeLimit(idx, choices, attr);
    if (n < 0 || (delta > 0 && (remaining <= 0 || (limit !== null && (base[attr] ?? 0) + n > limit)))) return;
    patch({ attributePoints: { ...choices.attributePoints, [attr]: n } });
  };

  async function submit() {
    setSubmitting(true);
    setSubmitErrors([]);
    const result = await createCharacterAction(tableId, choices, details);
    if (!result.ok) {
      setSubmitting(false);
      return setSubmitErrors(result.errors);
    }
    let uploadError: string | null = null;
    if (imageFile) {
      const data = new FormData();
      data.set("file", imageFile);
      const up = await uploadCharacterImageAction(result.id, data);
      if (!up.ok) uploadError = `O personagem foi criado, mas a imagem não subiu: ${up.message} Você pode anexá-la depois, na aba Pessoal.`;
    }
    setSubmitting(false);
    onCreated(result.id, uploadError);
  }

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (file && file.size > MAX_BACKGROUND_BYTES) {
      setImageFile(null);
      return setImageError(BACKGROUND_TOO_BIG_MESSAGE);
    }
    setImageError(null);
    setImageFile(file);
  }

  const extraAbilities = race?.grants.extraCareerAbility ? extraAbilityOptions(idx, choices) : [];
  const benefitParam = benefitParamOptions(idx, choices);
  const careerReady = choices.careers.length === 2;

  return (
    <>
      <div className="border-b border-border px-6 pt-5 pb-4">
        <h2 className="text-lg font-semibold">Criar personagem</h2>
        <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STEPS.map((label, i) => (
            <li key={label} className={cn("flex items-center gap-1.5", i + 1 === step ? "font-semibold text-primary" : i + 1 < step ? "text-foreground" : "text-muted-foreground")}>
              <span className={cn("flex size-5 items-center justify-center rounded-full border text-[11px]", i + 1 === step ? "border-primary bg-primary/15" : "border-border")}>{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {step === 1 && (
          <>
            <p className="text-sm text-muted-foreground">Escolha a raça. Ela define os atributos iniciais e os limites.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...idx.races.values()].map((r) => (
                <Option key={r.slug} selected={choices.race === r.slug} onClick={() => setChoices({ ...EMPTY_CHOICES, race: r.slug })}>
                  <span className="font-medium">{r.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Arquétipos: {r.archetypes.map((a) => idx.archetypes.get(a)?.name).join(", ")}</span>
                </Option>
              ))}
            </div>
            {race && (
              <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 sm:grid-cols-5">
                  {ATTRIBUTES.map((a) => {
                    const v = race.attributes[a];
                    return (
                      <div key={a} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{a}</span>
                        <span className="font-medium">{v ? (v.start === null ? "Dotado" : `${v.start}/${v.hero}`) : "—"}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Inicial / máximo de Herói. Arcano só para Dotado.</p>
                <p className="text-muted-foreground">{race.features}</p>
                <p className="text-xs text-muted-foreground">Idiomas: {race.languages}</p>
                {race.grants.attributeChoice && (
                  <Field>
                    <FieldLabel>Potencial Excepcional: +1 em</FieldLabel>
                    <div className="flex gap-2">
                      {race.grants.attributeChoice.options.map((a) => (
                        <Option key={a} className="w-auto" selected={choices.raceAttributeChoice === a} onClick={() => patch({ raceAttributeChoice: a, attributePoints: {} })}>
                          {ATTRIBUTE_LABELS[a]}
                        </Option>
                      ))}
                    </div>
                  </Field>
                )}
              </div>
            )}
          </>
        )}

        {step === 2 && race && (
          <>
            <p className="text-sm text-muted-foreground">Escolha o arquétipo e o benefício inicial dele.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {race.archetypes.map((slug) => {
                const a = idx.archetypes.get(slug)!;
                return (
                  <Option key={slug} selected={choices.archetype === slug} onClick={() => setChoices({ ...choices, ...resetFrom("archetype"), archetype: slug })}>
                    <span className="font-medium">{a.name}</span>
                  </Option>
                );
              })}
            </div>
            {archetype && (
              <>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {archetype.rules.map((r) => (
                    <p key={r}>{r.replace(/\*\*/g, "")}</p>
                  ))}
                  {archetype.slug === "dotado" && <p>Arcano inicial: 3 (tecelão da vontade) ou 2 (focalizador, se tiver a carreira Conjurador de Guerra).</p>}
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Benefício inicial (escolha 1)</h3>
                  {archetype.benefits.map((b) => {
                    const given = race.grants.archetypeBenefits?.includes(b.slug);
                    return (
                      <Option key={b.slug} selected={choices.archetypeBenefit === b.slug} disabled={given} onClick={() => patch({ ...resetFrom("benefit"), archetypeBenefit: b.slug })}>
                        <span className="font-medium">{b.name}</span>
                        {given && <span className="ml-2 text-xs text-muted-foreground">(a raça já concede)</span>}
                        <span className="mt-0.5 block text-xs text-muted-foreground">{b.text}</span>
                      </Option>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {step === 3 && race && archetype && (
          <>
            <p className="text-sm text-muted-foreground">Escolha duas carreiras. Você recebe as habilidades, perícias, conexões, magias e bens iniciais de cada uma.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...idx.careers.values()]
                .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                .map((career) => {
                  const selected = choices.careers.some((p) => p.career === career.slug);
                  const other = choices.careers.find((p) => p.career !== career.slug)?.career;
                  const reason = selected ? null : careerBlockReason(idx, { race: race.slug, archetype: archetype.slug, otherCareer: other }, career.slug) ?? (careerReady ? "Você já escolheu duas." : null);
                  return (
                    <Option key={career.slug} selected={selected} disabled={!!reason} onClick={() => toggleCareer(career.slug)}>
                      <span className="font-medium">{career.name}</span>
                      {reason && <span className="mt-0.5 block text-xs text-muted-foreground">{reason}</span>}
                    </Option>
                  );
                })}
            </div>

            {choices.careers.map((pick) => {
              const career = idx.careers.get(pick.career)!;
              return <CareerConfig key={pick.career} idx={idx} career={career} pick={pick} raceSlug={race.slug} onChange={(p, reset) => updatePick(pick.career, p, reset)} />;
            })}

            {race.grants.extraCareerAbility && careerReady && (
              <Field>
                <FieldLabel>Iosano: uma habilidade adicional das suas carreiras</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {extraAbilities.map((slug) => (
                    <Option key={slug} selected={choices.extraAbility === slug} onClick={() => patch({ extraAbility: slug })}>
                      {abilityName(idx, slug)}
                    </Option>
                  ))}
                </div>
              </Field>
            )}

            {careerReady && benefitParam && (
              <Field>
                <FieldLabel>{choices.archetypeBenefit === "virtuoso" ? "Virtuoso: escolha a perícia militar" : "Estudo Adicional: escolha a magia"}</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {benefitParam.options.map((slug) => (
                    <Option key={slug} selected={choices.archetypeBenefitParam === slug} onClick={() => patch({ archetypeBenefitParam: slug })}>
                      {benefitParam.kind === "skill" ? nameOf(idx, slug) : (idx.spells.get(slug)?.name ?? slug)}
                    </Option>
                  ))}
                </div>
              </Field>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <p className="text-sm text-muted-foreground">
              Distribua {idx.attributePoints} pontos de atributo (todos devem ser gastos), sem passar do máximo de Herói. Restam{" "}
              <span className="font-semibold text-foreground">{remaining}</span>.
            </p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {ATTRIBUTES.filter((a) => base[a] !== null).map((a) => {
                const points = choices.attributePoints[a] ?? 0;
                const limit = attributeLimit(idx, choices, a);
                return (
                  <div key={a} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-28">{ATTRIBUTE_LABELS[a]}</span>
                    <span className="w-16 text-xs text-muted-foreground">base {base[a]}</span>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="size-8" aria-label={`Diminuir ${ATTRIBUTE_LABELS[a]}`} disabled={points === 0} onClick={() => setPoints(a, -1)}>
                        −
                      </Button>
                      <span className="w-6 text-center font-semibold">{(base[a] ?? 0) + points}</span>
                      <Button type="button" variant="outline" size="icon" className="size-8" aria-label={`Aumentar ${ATTRIBUTE_LABELS[a]}`} disabled={remaining <= 0 || (limit !== null && (base[a] ?? 0) + points >= limit)} onClick={() => setPoints(a, 1)}>
                        +
                      </Button>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">máx. {limit}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <p className="text-sm text-muted-foreground">Toques finais. Só o nome é obrigatório; o resto você pode preencher depois.</p>
            <Field>
              <FieldLabel htmlFor="w-name">Nome</FieldLabel>
              <Input id="w-name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} maxLength={60} autoFocus />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="w-age">Idade</FieldLabel>
                <Input id="w-age" value={details.age} onChange={(e) => setDetails({ ...details, age: e.target.value })} maxLength={30} />
              </Field>
              <Field>
                <FieldLabel htmlFor="w-nat">Nacionalidade</FieldLabel>
                <Input id="w-nat" value={details.nationality} onChange={(e) => setDetails({ ...details, nationality: e.target.value })} maxLength={60} />
              </Field>
              <Field>
                <FieldLabel htmlFor="w-fil">Filiação</FieldLabel>
                <Input id="w-fil" value={details.filiation} onChange={(e) => setDetails({ ...details, filiation: e.target.value })} maxLength={120} />
              </Field>
              <Field>
                <FieldLabel htmlFor="w-org">Organização</FieldLabel>
                <Input id="w-org" value={details.organization} onChange={(e) => setDetails({ ...details, organization: e.target.value })} maxLength={120} />
              </Field>
              <Field>
                <FieldLabel htmlFor="w-h">Altura</FieldLabel>
                <Input id="w-h" value={details.height} onChange={(e) => setDetails({ ...details, height: e.target.value })} maxLength={30} />
              </Field>
              <Field>
                <FieldLabel htmlFor="w-w">Peso</FieldLabel>
                <Input id="w-w" value={details.weight} onChange={(e) => setDetails({ ...details, weight: e.target.value })} maxLength={30} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="w-crimes">Crimes</FieldLabel>
              <Textarea id="w-crimes" value={details.crimes} onChange={(e) => setDetails({ ...details, crimes: e.target.value })} maxLength={500} rows={2} />
            </Field>
            <Field>
              <FieldLabel htmlFor="w-app">Aparência</FieldLabel>
              <Textarea id="w-app" value={details.appearance} onChange={(e) => setDetails({ ...details, appearance: e.target.value })} maxLength={1000} rows={3} />
            </Field>
            <Field>
              <FieldLabel htmlFor="w-img">Imagem do personagem (opcional)</FieldLabel>
              <Input id="w-img" type="file" accept="image/png,image/jpeg,image/webp" onChange={pickImage} />
              <p className="text-xs text-muted-foreground">
                {imageFile ? `Selecionada: ${imageFile.name}. ` : ""}PNG, JPEG ou WEBP, até {MAX_BACKGROUND_BYTES / 1024 / 1024} MB. Depois de criar, dá para incluir, trocar ou remover em Pessoal.
              </p>
              {imageError && <p role="alert" className="text-sm text-destructive">{imageError}</p>}
            </Field>
            {evaluation.sheet && (
              <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                {evaluation.sheet.race.name} {evaluation.sheet.archetype.name}, {evaluation.sheet.careers.map((c) => c.name).join(" e ")} · Defesa {evaluation.sheet.derived.defense} · Iniciativa{" "}
                {evaluation.sheet.derived.initiative} · Armadura {evaluation.sheet.derived.armor} · Vontade {evaluation.sheet.derived.willpower} · {evaluation.sheet.gold} CO
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2 border-t border-border px-6 py-4">
        {(stepErrors.length > 0 || submitErrors.length > 0) && (
          <ul role="alert" className="space-y-0.5 text-sm text-destructive">
            {[...new Set([...stepErrors.map((e) => e.message), ...submitErrors])].map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>
          {step < 5 ? (
            <Button type="button" disabled={stepErrors.length > 0} onClick={() => setStep(step + 1)}>
              Próximo
            </Button>
          ) : (
            <Button type="button" disabled={stepErrors.length > 0 || submitting || !evaluation.sheet} onClick={submit}>
              {submitting ? "Criando…" : "Criar personagem"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

/** O que a carreira entrega e as escolhas que ela pede (variante, perícias, idiomas). */
function CareerConfig({
  idx,
  career,
  pick,
  raceSlug,
  onChange,
}: {
  idx: CatalogIndex;
  career: Career;
  pick: CharacterChoices["careers"][number];
  raceSlug: string;
  onChange: (p: Partial<CharacterChoices["careers"][number]>, resetPoints?: boolean) => void;
}) {
  const forbidden = idx.races.get(raceSlug)?.restrictions.forbiddenMilitarySkills ?? [];
  const groups = chooseGroups(career);
  const fixed = (list: Career["initial"]["militarySkills"]) =>
    list.flatMap((s) => (s.type === "fixed" ? [`${nameOf(idx, s.skill)}${s.specialty ? ` (${s.specialty})` : ""} ${s.level}`] : []));
  const abilityText = career.initial.abilities.map((a) => `${abilityName(idx, a.ability)}${a.param ? ` (${a.param})` : ""}`);
  const lines = [
    abilityText.length ? ["Habilidades", abilityText.join(", ")] : null,
    fixed(career.initial.militarySkills).length ? ["Perícias militares", fixed(career.initial.militarySkills).join(", ")] : null,
    fixed(career.initial.professionalSkills).length ? ["Perícias profissionais", fixed(career.initial.professionalSkills).join(", ")] : null,
    career.initial.connections.length ? ["Conexões", career.initial.connections.join(", ")] : null,
    career.initial.spells.length ? ["Magias", career.initial.spells.map((s) => idx.spells.get(s)?.name).join(", ")] : null,
    career.initial.gear ? ["Bens", `${career.initial.gear.co} CO${career.initial.gear.items ? `, ${career.initial.gear.items}` : ""}`] : null,
  ].filter((l): l is [string, string] => !!l);
  const slots = languageSlots(career);
  let groupIndex = -1;

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 p-4 text-sm">
      <h3 className="font-semibold">{career.name}</h3>
      <dl className="space-y-0.5 text-xs">
        {lines.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {career.special && <p className="text-xs text-muted-foreground">{career.special}</p>}

      {career.variants && (
        <Field>
          <FieldLabel>{career.variantLabel}</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            {career.variants.map((v) => (
              <Option key={v.slug} selected={pick.variant === v.slug} onClick={() => onChange({ variant: v.slug }, true)}>
                <span className="font-medium">{v.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {[...v.abilities.map((a) => abilityName(idx, a.ability)), ...v.spells.map((s) => idx.spells.get(s)?.name), v.bonus?.text].filter(Boolean).join(" · ")}
                </span>
              </Option>
            ))}
          </div>
        </Field>
      )}

      {(career.initial.gear?.choices ?? []).map((choice, ci) => (
        <Field key={`gear${ci}`}>
          <FieldLabel>Bens: {choice.label}</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            {choice.options.map((o, oi) => (
              <Option
                key={o.label}
                selected={pick.gear?.[ci] === oi}
                onClick={() => {
                  const gear = [...(pick.gear ?? [])];
                  gear[ci] = oi;
                  onChange({ gear });
                }}
              >
                <span className="font-medium">{o.label}</span>
              </Option>
            ))}
          </div>
        </Field>
      ))}

      {(["military", "professional"] as const).flatMap((kind) =>
        groups
          .filter((g) => g.kind === kind)
          .map((group) => {
            groupIndex++;
            const gi = groupIndex;
            const chosen = pick.skillChoices[gi] ?? [];
            return (
              <Field key={`${kind}${gi}`}>
                <FieldLabel>
                  Escolha {group.count} {kind === "military" ? "perícia militar" : "perícia profissional"} ({chosen.length}/{group.count})
                </FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.options.map((o) => {
                    const on = chosen.includes(o.skill);
                    const blocked = forbidden.includes(o.skill);
                    const full = !on && chosen.length >= group.count;
                    return (
                      <Option
                        key={o.skill}
                        selected={on}
                        disabled={blocked || full}
                        onClick={() => {
                          const next = pick.skillChoices.map((list, i) => (i === gi ? (on ? list.filter((s) => s !== o.skill) : [...list, o.skill]) : list));
                          onChange({ skillChoices: next });
                        }}
                      >
                        {nameOf(idx, o.skill)} {o.level}
                        {blocked && <span className="ml-2 text-xs text-muted-foreground">(a raça não pode usar)</span>}
                      </Option>
                    );
                  })}
                </div>
              </Field>
            );
          }),
      )}

      {slots > 0 &&
        Array.from({ length: slots }, (_, i) => (
          <Field key={i}>
            <FieldLabel htmlFor={`lang-${career.slug}-${i}`}>Idioma que a carreira concede</FieldLabel>
            <Input
              id={`lang-${career.slug}-${i}`}
              value={pick.languages[i] ?? ""}
              maxLength={40}
              onChange={(e) => onChange({ languages: pick.languages.map((l, j) => (j === i ? e.target.value : l)) })}
            />
          </Field>
        ))}
    </div>
  );
}
