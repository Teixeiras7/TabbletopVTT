// Criação de personagem (Reinos de Ferro, cap. 3, p. 105 e 148): validação e ficha calculada.
// Funções puras, sem banco nem HTTP: a interface as usa para mostrar opções, e o backend as
// executa de novo (autoridade) antes de gravar. No banco ficam só as ESCOLHAS; tudo que é
// derivado (DEF, ARM, vitalidade, total das perícias…) é calculado aqui, na hora.
import {
  ATTRIBUTES,
  type Ability,
  type Action,
  type ActionCost,
  type Archetype,
  type Attribute,
  type Career,
  type Catalog,
  type Progression,
  type Race,
  type Skill,
  type Spell,
} from "@/lib/catalog/schemas";
import { slugify } from "@/lib/catalog/slug";

// ---------- tipos ----------

export type CareerPick = {
  career: string;
  /** Elemento (Feiticeiro) ou religião (Sacerdote). */
  variant?: string;
  /** Uma lista por grupo "escolha N entre…" da carreira (ver chooseGroups). */
  skillChoices: string[][];
  /** Um idioma por habilidade Idioma "qualquer" da carreira. */
  languages: string[];
  /** Opção escolhida em cada escolha de bens da carreira (ver gearChoices em inventory.ts). */
  gear?: number[];
};

export type CharacterChoices = {
  race: string;
  raceAttributeChoice?: Attribute;
  archetype: string;
  archetypeBenefit: string;
  /** Virtuoso: perícia militar. Estudo Adicional: magia. */
  archetypeBenefitParam?: string;
  careers: CareerPick[];
  /** Iosano: 1 habilidade adicional de uma de suas carreiras. */
  extraAbility?: string;
  attributePoints: Partial<Record<Attribute, number>>;
  /** Progressões escolhidas com XP. */
  advances?: Advance[];
};

/** Dados pessoais (aba Pessoal e dossiê): tudo texto livre; só o nome é obrigatório. */
export type CharacterDetails = {
  name: string;
  age: string;
  nationality: string;
  /** Filiação (família, a quem o personagem é ligado). */
  filiation: string;
  organization: string;
  height: string;
  weight: string;
  crimes: string;
  appearance: string;
};

/** Passos 1-5 da criação; 6 = progressões de XP. */
export type CreationError = { step: 1 | 2 | 3 | 4 | 5 | 6; message: string };

export type Stage = "hero" | "veteran" | "epic";
export type Grant = Progression["table"]["hero"][number]["grant"];
/** XP total. Herói até 49, Veterano de 50 a 99, Épico a partir de 100 (decisão do usuário: o livro não diz). */
export type Progress = { xp: number };
export const VETERAN_XP = 50;
export const EPIC_XP = 100;
export const stageOf = (p: Progress): Stage => (p.xp < VETERAN_XP ? "hero" : p.xp < EPIC_XP ? "veteran" : "epic");

/** Uma progressão escolhida (livro, p. 152). Os campos usados dependem de `grant`/`kind`; o motor confere tudo. */
export type Advance = {
  xp: number;
  grant: Grant;
  kind?: "military" | "ability" | "connection" | "spell";
  skills?: { skill: string; specialty?: string }[];
  ability?: string;
  param?: string;
  connection?: string;
  spell?: string;
  attribute?: Attribute;
  benefit?: string;
  career?: string;
  variant?: string;
};

export type CatalogIndex = {
  races: Map<string, Race>;
  archetypes: Map<string, Archetype>;
  careers: Map<string, Career>;
  skills: Map<string, Skill>;
  abilities: Map<string, Ability>;
  spells: Map<string, Spell>;
  spellLists: Map<string, string[]>;
  benefits: Map<string, { archetype: string; name: string; text: string; isFeat: boolean }>;
  actions: Map<string, Action>;
  attributePoints: number;
  heroSkillMax: number;
  facadePoints: number;
  skillMaxByStage: Record<Stage, number>;
  /** Tabela de progressão: Herói (2-45), Veterano (50-95) e Épico (100-145: o livro imprime igual à de Veterano;
   *  decisão do usuário: continua de 5 em 5 depois do 95, na mesma sequência). */
  progressionRows: { xp: number; grant: Grant; table: Stage }[];
  grantText: Record<Grant, string>;
};

export function indexCatalog(c: Catalog): CatalogIndex {
  const by = <T extends { slug: string }>(list: T[]) => new Map(list.map((x) => [x.slug, x]));
  const benefits = new Map<string, { archetype: string; name: string; text: string; isFeat: boolean }>();
  for (const a of c.archetypes) for (const b of a.benefits) benefits.set(b.slug, { archetype: a.slug, name: b.name, text: b.text, isFeat: b.isFeat });
  return {
    races: by(c.races),
    archetypes: by(c.archetypes),
    careers: by(c.careers),
    skills: by(c.skills),
    abilities: by(c.abilities),
    spells: by(c.spells),
    spellLists: new Map(c.spellLists.map((l) => [l.slug, l.entries])),
    benefits,
    attributePoints: c.progression.creationAttributePoints,
    heroSkillMax: c.progression.skillMaxLevelByStage.hero,
    skillMaxByStage: c.progression.skillMaxLevelByStage,
    progressionRows: [
      ...c.progression.table.hero.map((r) => ({ ...r, table: "hero" as const })),
      ...c.progression.table.veteran.map((r) => ({ ...r, table: "veteran" as const })),
      ...c.progression.table.veteran.map((r) => ({ ...r, xp: r.xp + EPIC_XP - VETERAN_XP, table: "epic" as const })),
    ],
    grantText: c.progression.grants,
    facadePoints: c.progression.creationFacadePoints,
    actions: by(c.actions),
  };
}

// ---------- ajudantes ----------

type SkillRef = { skill: string; level: number | null; specialty: string | null };
export type ChooseGroup = { kind: "military" | "professional"; count: number; options: SkillRef[] };

/** Grupos "escolha N entre…" das perícias iniciais, na ordem: militares, depois profissionais. */
export function chooseGroups(career: Career): ChooseGroup[] {
  const out: ChooseGroup[] = [];
  for (const kind of ["military", "professional"] as const) {
    for (const s of kind === "military" ? career.initial.militarySkills : career.initial.professionalSkills) {
      if (s.type === "choose") out.push({ kind, count: s.count, options: s.options });
    }
  }
  return out;
}

const FREE_LANGUAGE = new Set(["qualquer", "escolha um"]);
const isFreeLanguage = (a: { ability: string; param?: string }) =>
  a.ability === "idioma" && !!a.param && FREE_LANGUAGE.has(a.param.toLowerCase());

/** Quantos idiomas o jogador escolhe nesta carreira (habilidade Idioma "qualquer"). */
export function languageSlots(career: Career) {
  return career.initial.abilities.filter(isFreeLanguage).length;
}

export function tradition(idx: CatalogIndex, choices: Pick<CharacterChoices, "archetype" | "careers">) {
  if (choices.archetype !== "dotado") return null;
  const focalizer = choices.careers.some((p) => idx.careers.get(p.career)?.focalizer);
  return focalizer ? ("focalizador" as const) : ("tecelao" as const);
}

function variantBonuses(idx: CatalogIndex, careers: CareerPick[]) {
  return careers.flatMap((p) => {
    const bonus = idx.careers.get(p.career)?.variants?.find((v) => v.slug === p.variant)?.bonus;
    return bonus ? [bonus] : [];
  });
}

/** Valores iniciais: raça, Potencial Excepcional (humano), ARC do Dotado por tradição, bônus do elemento (Feiticeiro). */
export function baseAttributes(idx: CatalogIndex, choices: Partial<CharacterChoices>): Record<Attribute, number | null> {
  const race = choices.race ? idx.races.get(choices.race) : undefined;
  const out = Object.fromEntries(ATTRIBUTES.map((a) => [a, null])) as Record<Attribute, number | null>;
  if (!race) return out;
  const trad = tradition(idx, { archetype: choices.archetype ?? "", careers: choices.careers ?? [] });
  for (const attr of ATTRIBUTES) {
    const v = race.attributes[attr];
    if (!v) continue;
    if (attr === "ARC") out.ARC = trad ? (trad === "focalizador" ? 2 : 3) : null;
    else out[attr] = v.start;
  }
  const choice = race.grants.attributeChoice;
  if (choice && choices.raceAttributeChoice && choice.options.includes(choices.raceAttributeChoice)) {
    const a = choices.raceAttributeChoice;
    if (out[a] !== null) out[a] = (out[a] ?? 0) + choice.amount;
  }
  for (const b of variantBonuses(idx, choices.careers ?? [])) if (out[b.attribute] !== null) out[b.attribute] = (out[b.attribute] ?? 0) + b.initial;
  return out;
}

/** Máximo do estágio (limite da raça; elemento Pedra/Tempestade soma +1). */
export function attributeLimit(idx: CatalogIndex, choices: Partial<CharacterChoices>, attr: Attribute, stage: Stage = "hero"): number | null {
  const race = choices.race ? idx.races.get(choices.race) : undefined;
  const v = race?.attributes[attr];
  if (!v) return null;
  const extra = variantBonuses(idx, choices.careers ?? []).filter((b) => b.attribute === attr).reduce((s, b) => s + b.maxPerStage, 0);
  return v[stage] + extra;
}

/** Motivo pelo qual a carreira não pode ser escolhida agora (null = pode). */
export function careerBlockReason(
  idx: CatalogIndex,
  ctx: { race: string; archetype: string; otherCareer?: string },
  careerSlug: string,
): string | null {
  const career = idx.careers.get(careerSlug);
  const race = idx.races.get(ctx.race);
  if (!career || !race) return "Carreira inválida.";
  const pre = career.prerequisites;
  if (pre.races.length > 0 && !pre.races.includes(race.slug)) {
    return `Só para ${pre.races.map((r) => idx.races.get(r)?.name ?? r).join(" ou ")}.`;
  }
  if (pre.archetypes.length > 0 && !pre.archetypes.includes(ctx.archetype)) {
    return `Exige o arquétipo ${pre.archetypes.map((a) => idx.archetypes.get(a)?.name ?? a).join(" ou ")}.`;
  }
  if (ctx.archetype === "dotado" && race.restrictions.dotadoCareerBans?.includes(careerSlug)) {
    return `${race.name} Dotado não pode ter esta carreira.`;
  }
  if (ctx.otherCareer) {
    const other = idx.careers.get(ctx.otherCareer);
    if (career.secondCareerOneOf && !career.secondCareerOneOf.includes(ctx.otherCareer)) {
      return `Só combina com: ${career.secondCareerOneOf.map((s) => idx.careers.get(s)?.name ?? s).join(", ")}.`;
    }
    if (other?.secondCareerOneOf && !other.secondCareerOneOf.includes(careerSlug)) {
      return `${other.name} só combina com: ${other.secondCareerOneOf.map((s) => idx.careers.get(s)?.name ?? s).join(", ")}.`;
    }
  }
  return null;
}

const NATION_ROOT: Record<string, string> = { cygnarano: "cygnar", khadorano: "khador" };
/** A nacionalidade informada atende à exigência da carreira (ex.: "Cygnarana" atende "cygnarano")? */
export function nationalityMatches(required: string, nationality: string) {
  return slugify(nationality).includes(NATION_ROOT[required] ?? slugify(required));
}

// ---------- pré-requisitos de habilidade ----------

export type ParsedPrerequisites = {
  attributes: [Attribute, number][];
  skills: [string, number][];
  abilities: string[];
  archetypes: string[];
  unknown: string[];
};

const SKILL_ALIAS: Record<string, string> = { "eng-mekanica": "engenharia-mekanica" };

export function parsePrerequisites(idx: CatalogIndex, text: string | null): ParsedPrerequisites {
  const out: ParsedPrerequisites = { attributes: [], skills: [], abilities: [], archetypes: [], unknown: [] };
  if (!text) return out;
  for (const token of text.split(/,\s*/).map((t) => t.trim()).filter(Boolean)) {
    const attr = token.match(/^(FIS|VEL|FOR|AGI|DES|MAE|INT|ARC|PER)\s+(\d+)$/);
    if (attr) { out.attributes.push([attr[1] as Attribute, Number(attr[2])]); continue; }
    const withLevel = token.match(/^(.+?)\s+(\d+)$/);
    if (withLevel) {
      const s = slugify(withLevel[1] ?? "");
      const skill = SKILL_ALIAS[s] ?? s;
      if (idx.skills.has(skill)) { out.skills.push([skill, Number(withLevel[2])]); continue; }
    }
    const s = slugify(token);
    if (idx.archetypes.has(s)) out.archetypes.push(s);
    else if (idx.abilities.has(s)) out.abilities.push(s);
    else out.unknown.push(token);
  }
  return out;
}

type Owned = { attributes: Record<Attribute, number | null>; skills: Map<string, number>; abilities: Set<string>; archetype: string };

export function meetsPrerequisites(idx: CatalogIndex, text: string | null, owned: Owned) {
  const p = parsePrerequisites(idx, text);
  if (p.unknown.length > 0) return false;
  return (
    p.attributes.every(([a, n]) => (owned.attributes[a] ?? 0) >= n) &&
    p.skills.every(([s, n]) => (owned.skills.get(s) ?? 0) >= n) &&
    p.abilities.every((a) => owned.abilities.has(a)) &&
    p.archetypes.every((a) => a === owned.archetype)
  );
}

// ---------- montagem ----------

export type SheetSkill = {
  slug: string;
  name: string;
  category: Skill["category"];
  specialty: string | null;
  level: number;
  attribute: string;
  total: number | null;
};

export type CharacterSheet = {
  details: CharacterDetails;
  stage: Stage;
  xp: number;
  race: { slug: string; name: string; features: string };
  archetype: { slug: string; name: string; rules: string[] };
  tradition: "focalizador" | "tecelao" | null;
  careers: { slug: string; name: string; variant: string | null; variantLabel: string | null; fromXp: boolean }[];
  attributes: Record<Attribute, number | null>;
  limits: Record<Attribute, number | null>;
  derived: { defense: number; initiative: number; armor: number; willpower: number; commandRange: number };
  /** Círculos de vitalidade por aspecto (= atributo primário). */
  vitality: { FIS: number; AGI: number; INT: number };
  skills: SheetSkill[];
  /** Perícias do jogo que o personagem não tem (a aba Perícias lista todas). `base` = valor do atributo (null se social: o jogador escolhe); `needsTraining` = sem treino não pode usar (mostra 0). */
  otherSkills: { slug: string; name: string; category: Skill["category"]; attribute: string; attributeText: string; multiChoice: boolean; needsTraining: boolean; base: number | null }[];
  abilities: { slug: string; name: string; param: string | null; source: string; text: string }[];
  benefits: { slug: string; name: string; param: string | null; source: string; text: string; isFeat: boolean }[];
  /** Magias conhecidas com os dados do livro (`spell`) para a aba Magias. */
  spells: { slug: string; name: string; cost: number; source: string; spell: Spell | null }[];
  spellLimit: number | null;
  connections: string[];
  languages: string;
  gold: number;
  startingGear: { source: string; text: string }[];
  facadePoints: number;
  modifiers: string[];
  notes: string[];
};

type Assembled = {
  skills: Map<string, { slug: string; specialty: string | null; level: number }>;
  abilities: { slug: string; param: string | null; source: string }[];
  benefits: { slug: string; param: string | null; source: string }[];
  spells: { slug: string; source: string }[];
  connections: string[];
  gold: number;
  gear: { source: string; text: string }[];
  notes: string[];
};

function assemble(idx: CatalogIndex, choices: CharacterChoices): Assembled {
  const race = idx.races.get(choices.race)!;
  const skills: Assembled["skills"] = new Map();
  const abilities: Assembled["abilities"] = [];
  const benefits: Assembled["benefits"] = [];
  const spells: Assembled["spells"] = [];
  const connections: string[] = [];
  const gear: Assembled["gear"] = [];
  const notes: string[] = [];
  let gold = 0;

  const addAbility = (slug: string, param: string | null, source: string) => {
    if (abilities.some((a) => a.slug === slug && a.param === param)) return;
    abilities.push({ slug, param, source });
  };

  for (const slug of race.grants.abilities ?? []) addAbility(slug, null, race.name);
  for (const b of race.grants.archetypeBenefits ?? []) benefits.push({ slug: b, param: null, source: race.name });
  for (const c of race.grants.connections ?? []) connections.push(c);
  benefits.push({ slug: choices.archetypeBenefit, param: choices.archetypeBenefitParam ?? null, source: idx.archetypes.get(choices.archetype)!.name });

  for (const pick of choices.careers) {
    const career = idx.careers.get(pick.career)!;
    const variant = career.variants?.find((v) => v.slug === pick.variant);
    const addSkill = (ref: SkillRef) => {
      const key = `${ref.skill}|${ref.specialty ?? ""}`;
      const existing = skills.get(key);
      // Mesma perícia inicial nas duas carreiras: começa no nível 2 (p. 116).
      skills.set(key, {
        slug: ref.skill,
        specialty: ref.specialty,
        level: Math.min(idx.heroSkillMax, existing ? 2 : (ref.level ?? 1)),
      });
    };
    for (const list of [career.initial.militarySkills, career.initial.professionalSkills, variant?.professionalSkills ?? []]) {
      for (const s of list) if (s.type === "fixed") addSkill(s);
    }
    chooseGroups(career).forEach((group, i) => {
      for (const slug of pick.skillChoices[i] ?? []) {
        const ref = group.options.find((o) => o.skill === slug);
        if (ref) addSkill(ref);
      }
    });

    let langIndex = 0;
    for (const a of career.initial.abilities) {
      if (isFreeLanguage(a)) addAbility("idioma", (pick.languages[langIndex++] ?? "").trim(), career.name);
      else addAbility(a.ability, a.param ?? null, career.name);
    }
    for (const a of variant?.abilities ?? []) addAbility(a.ability, a.param ?? null, `${career.name} (${variant?.name})`);
    for (const b of career.grantsBenefits ?? []) benefits.push({ slug: b, param: null, source: career.name });
    for (const s of career.initial.spells) spells.push({ slug: s, source: career.name });
    for (const s of variant?.spells ?? []) spells.push({ slug: s, source: `${career.name} (${variant?.name})` });
    for (const c of [...career.initial.connections, ...(variant?.connections ?? [])]) connections.push(c);
    gold += career.initial.gear?.co ?? 0;
    if (career.initial.gear?.items) gear.push({ source: career.name, text: career.initial.gear.items });
    if (career.special && /\bCO\b/.test(career.special)) notes.push(`${career.name}: ${career.special}`);
  }

  if (choices.extraAbility) addAbility(choices.extraAbility, null, race.name);

  // Dedupe de benefícios (ex.: Superpercepção do Investigador e do arquétipo Intelectual).
  const seenBenefit = new Set<string>();
  const uniqueBenefits = benefits.filter((b) => (seenBenefit.has(b.slug) ? false : (seenBenefit.add(b.slug), true)));
  const spellSeen = new Set<string>();
  const uniqueSpells = spells.filter((s) => (spellSeen.has(s.slug) ? false : (spellSeen.add(s.slug), true)));
  return { skills, abilities, benefits: uniqueBenefits, spells: uniqueSpells, connections: [...new Set(connections)], gold, gear, notes };
}

function ownedState(idx: CatalogIndex, choices: CharacterChoices, a: Assembled): Owned {
  const attrs = baseAttributes(idx, choices);
  const skills = new Map<string, number>();
  for (const s of a.skills.values()) skills.set(s.slug, Math.max(skills.get(s.slug) ?? 0, s.level));
  return { attributes: attrs, skills, abilities: new Set(a.abilities.map((x) => x.slug)), archetype: choices.archetype };
}

/** Habilidades que o Iosano pode escolher como a adicional (de uma das carreiras, pré-requisitos atendidos). */
export function extraAbilityOptions(idx: CatalogIndex, choices: CharacterChoices) {
  const picks = choices.careers.map((p) => idx.careers.get(p.career));
  if (!idx.races.get(choices.race) || !idx.archetypes.get(choices.archetype) || picks.some((c) => !c) || !idx.benefits.has(choices.archetypeBenefit)) return [];
  const a = assemble(idx, { ...choices, extraAbility: undefined });
  const owned = ownedState(idx, choices, a);
  const out = new Set<string>();
  for (const career of picks) {
    for (const ref of career!.progression.abilities) {
      const ab = idx.abilities.get(ref.ability);
      if (!ab || ab.repeatable || ref.param) continue;
      if (owned.abilities.has(ab.slug)) continue;
      if (meetsPrerequisites(idx, ab.prerequisites, owned)) out.add(ab.slug);
    }
  }
  return [...out];
}

export const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  FIS: "Físico",
  VEL: "Velocidade",
  FOR: "Força",
  AGI: "Agilidade",
  DES: "Destreza",
  MAE: "Maestria",
  INT: "Intelecto",
  ARC: "Arcano",
  PER: "Percepção",
};

/** Benefícios que pedem uma escolha extra (Virtuoso: perícia militar; Estudo Adicional: magia nova) e as opções válidas. */
export function benefitParamOptions(idx: CatalogIndex, choices: CharacterChoices): { kind: "skill" | "spell"; options: string[] } | null {
  if (choices.archetypeBenefit !== "virtuoso" && choices.archetypeBenefit !== "estudo-adicional") return null;
  const ready =
    !!idx.races.get(choices.race) && !!idx.archetypes.get(choices.archetype) && choices.careers.length === 2 && choices.careers.every((p) => idx.careers.has(p.career));
  if (!ready) return { kind: choices.archetypeBenefit === "virtuoso" ? "skill" : "spell", options: [] };
  const a = assemble(idx, { ...choices, archetypeBenefitParam: undefined, extraAbility: undefined });
  if (choices.archetypeBenefit === "virtuoso") {
    const mil = [...a.skills.values()].filter((s) => idx.skills.get(s.slug)?.category === "military").map((s) => s.slug);
    return { kind: "skill", options: [...new Set(mil)] };
  }
  const known = new Set(a.spells.map((s) => s.slug));
  const options = new Set<string>();
  for (const l of reachableSpellLists(idx, choices.careers)) for (const s of idx.spellLists.get(l) ?? []) if (!known.has(s)) options.add(s);
  return { kind: "spell", options: [...options] };
}

/** Listas de magias das carreiras escolhidas (respeitando elemento/religião). */
export function reachableSpellLists(idx: CatalogIndex, careers: CareerPick[]) {
  const lists = new Set<string>();
  for (const p of careers) {
    const career = idx.careers.get(p.career);
    if (!career) continue;
    const variant = career.variants?.find((v) => v.slug === p.variant);
    for (const l of variant ? [variant.spellList] : career.progression.spellLists) lists.add(l);
  }
  return [...lists];
}

function resolveAttr(spec: string, attrs: Record<Attribute, number | null>): number | null {
  if (spec === "SOCIAL") return null;
  const min = spec.match(/^MIN\((\w+),(\w+)\)$/);
  if (min) return Math.min(attrs[min[1] as Attribute] ?? 0, attrs[min[2] as Attribute] ?? 0);
  return attrs[spec as Attribute] ?? null;
}

const clip = (s: string, n: number) => s.trim().slice(0, n);

/** Ficha calculada a partir das escolhas (criação + progressões de XP). `progress`: XP total e se é Épico. */
export function evaluateCharacter(idx: CatalogIndex, choices: CharacterChoices, details: CharacterDetails, progress?: Progress) {
  const { errors, sheet } = evaluate(idx, choices, details, progress);
  return { errors, sheet };
}

function evaluate(
  idx: CatalogIndex,
  choices: CharacterChoices,
  rawDetails: CharacterDetails,
  progress: Progress = { xp: 0 },
): { errors: CreationError[]; sheet: CharacterSheet | null; state?: ProgressState } {
  const errors: CreationError[] = [];
  const err = (step: CreationError["step"], message: string) => errors.push({ step, message });
  const details: CharacterDetails = {
    name: clip(rawDetails.name, 60),
    age: clip(rawDetails.age, 30),
    nationality: clip(rawDetails.nationality, 60),
    filiation: clip(rawDetails.filiation, 120),
    organization: clip(rawDetails.organization, 120),
    height: clip(rawDetails.height, 30),
    weight: clip(rawDetails.weight, 30),
    crimes: clip(rawDetails.crimes, 500),
    appearance: clip(rawDetails.appearance, 1000),
  };

  // 1. Raça
  const race = idx.races.get(choices.race);
  if (!race) err(1, "Escolha uma raça.");
  else if (race.grants.attributeChoice) {
    const c = choices.raceAttributeChoice;
    if (!c || !race.grants.attributeChoice.options.includes(c)) err(1, "Escolha o atributo do Potencial Excepcional.");
  }

  // 2. Arquétipo
  const archetype = idx.archetypes.get(choices.archetype);
  if (!archetype) err(2, "Escolha um arquétipo.");
  else if (race && !race.archetypes.includes(archetype.slug)) err(2, `${race.name} não pode ser ${archetype.name}.`);
  if (archetype) {
    const benefit = archetype.benefits.find((b) => b.slug === choices.archetypeBenefit);
    if (!benefit) err(2, "Escolha o benefício inicial do arquétipo.");
    else if (race?.grants.archetypeBenefits?.includes(benefit.slug)) err(2, `${race.name} já começa com ${benefit.name}; escolha outro benefício.`);
  }
  if (!race || !archetype) return { errors, sheet: null };

  // 3. Carreiras
  const picks = choices.careers;
  const careerSlugs = picks.map((p) => p.career);
  if (picks.length !== 2 || new Set(careerSlugs).size !== 2) err(3, "Escolha duas carreiras diferentes.");
  if (picks.length === 2) {
    picks.forEach((pick, i) => {
      const career = idx.careers.get(pick.career);
      if (!career) { err(3, "Carreira inválida."); return; }
      const block = careerBlockReason(idx, { race: race.slug, archetype: archetype.slug, otherCareer: picks[1 - i]?.career }, career.slug);
      if (block) err(3, `${career.name}: ${block}`);
      if (career.prerequisites.nation && !nationalityMatches(career.prerequisites.nation, details.nationality)) {
        err(3, `${career.name} exige nacionalidade ${career.prerequisites.nation}.`);
      }
      if (career.variants) {
        if (!career.variants.some((v) => v.slug === pick.variant)) err(3, `${career.name}: escolha ${career.variantLabel?.toLowerCase() ?? "a variante"}.`);
      }
      (career.initial.gear?.choices ?? []).forEach((choice, i) => {
        if (!choice.options[pick.gear?.[i] ?? -1]) err(3, `${career.name}: escolha ${choice.label.toLowerCase()}.`);
      });
      chooseGroups(career).forEach((group, g) => {
        const chosen = pick.skillChoices[g] ?? [];
        const allowed = group.options.filter((o) => !race.restrictions.forbiddenMilitarySkills?.includes(o.skill)).map((o) => o.skill);
        if (new Set(chosen).size !== group.count || chosen.length !== group.count || chosen.some((s) => !allowed.includes(s))) {
          err(3, `${career.name}: escolha ${group.count} ${group.count === 1 ? "perícia" : "perícias"} da lista.`);
        }
      });
      const slots = languageSlots(career);
      const langs = pick.languages.map((l) => l.trim()).filter(Boolean);
      if (langs.length !== slots) err(3, `${career.name}: informe o idioma que a carreira concede.`);
    });
  }
  if (errors.some((e) => e.step === 3) || picks.length !== 2) return { errors, sheet: null };

  const assembled = assemble(idx, choices);
  const attrs = baseAttributes(idx, choices);
  const owned = ownedState(idx, choices, assembled);

  // 2 (continuação). Parâmetros do benefício, que dependem das carreiras.
  const benefitSlug = choices.archetypeBenefit;
  if (benefitSlug === "virtuoso") {
    const mil = [...assembled.skills.values()].filter((s) => idx.skills.get(s.slug)?.category === "military").map((s) => s.slug);
    if (!choices.archetypeBenefitParam || !mil.includes(choices.archetypeBenefitParam)) err(2, "Virtuoso: escolha uma das suas perícias militares.");
  }
  if (benefitSlug === "estudo-adicional") {
    const lists = reachableSpellLists(idx, picks);
    const known = new Set(assembled.spells.map((s) => s.slug));
    const p = choices.archetypeBenefitParam;
    const inList = !!p && lists.some((l) => idx.spellLists.get(l)?.includes(p));
    if (!p || !inList || known.has(p)) err(2, "Estudo Adicional: escolha uma magia nova da lista de uma das suas carreiras.");
    else assembled.spells.push({ slug: p, source: "Estudo Adicional" });
  }

  // Iosano: habilidade adicional
  if (race.grants.extraCareerAbility) {
    const options = extraAbilityOptions(idx, choices);
    if (!choices.extraAbility || !options.includes(choices.extraAbility)) err(3, "Iosano: escolha a habilidade adicional de uma das carreiras.");
  }

  // 4. Atributos
  const points = choices.attributePoints;
  const trad = tradition(idx, choices);
  let spent = 0;
  const finalAttrs = { ...attrs };
  for (const attr of ATTRIBUTES) {
    const n = points[attr] ?? 0;
    if (!Number.isInteger(n) || n < 0) { err(4, "Pontos inválidos."); continue; }
    if (n === 0) continue;
    if (finalAttrs[attr] === null) { err(4, `${attr} não está disponível para este personagem.`); continue; }
    spent += n;
    finalAttrs[attr] = (finalAttrs[attr] ?? 0) + n;
    const limit = attributeLimit(idx, choices, attr);
    if (limit !== null && (finalAttrs[attr] ?? 0) > limit) err(4, `${attr} passa do máximo de ${limit}.`);
  }
  if (spent !== idx.attributePoints) err(4, `Distribua exatamente ${idx.attributePoints} pontos de atributo (usados: ${spent}).`);

  // 5. Detalhes
  if (details.name.length < 2) err(5, "Dê um nome ao personagem (mínimo 2 letras).");

  // 6. Progressões de XP, aplicadas sobre a criação já válida
  const state: ProgressState = { race, archetype: archetype.slug, nationality: details.nationality, picks, xpCareers: [], assembled, attrs: finalAttrs, trad };
  if (errors.length === 0 && choices.advances?.length) applyAdvances(idx, state, choices.advances, progress, (m) => err(6, m));

  // Magias conhecidas ≤ 2 × INT (3 × INT com Acadêmico Arcano)
  const spellLimit = spellLimitOf(state);
  if (spellLimit !== null && assembled.spells.length > spellLimit) err(3, `Magias demais (máximo ${spellLimit}).`);

  if (errors.length > 0) return { errors, sheet: null };

  // ---------- ficha ----------
  const num = (a: Attribute) => finalAttrs[a] ?? 0;
  const modifiers: string[] = [];
  const defBonus = race.grants.defBonus ?? 0;
  if (defBonus) modifiers.push(`${race.name}: +${defBonus} DEF`);
  const skillList: SheetSkill[] = [...assembled.skills.values()]
    .map((s) => {
      const def = idx.skills.get(s.slug)!;
      const base = resolveAttr(def.attribute, finalAttrs);
      return {
        slug: s.slug,
        name: def.name,
        category: def.category,
        specialty: s.specialty,
        level: s.level,
        attribute: def.attributeText,
        total: base === null ? null : base + s.level,
      };
    })
    .sort((a, b) => (a.category === b.category ? a.name.localeCompare(b.name, "pt-BR") : a.category === "military" ? -1 : 1));
  const comandar = assembled.skills.get("comandar|")?.level ?? 0;

  const sheet: CharacterSheet = {
    details,
    stage: stageOf(progress),
    xp: progress.xp,
    race: { slug: race.slug, name: race.name, features: race.features },
    archetype: { slug: archetype.slug, name: archetype.name, rules: archetype.rules },
    tradition: trad,
    careers: picks.map((p) => {
      const c = idx.careers.get(p.career)!;
      return { slug: c.slug, name: c.name, variant: c.variants?.find((v) => v.slug === p.variant)?.name ?? null, variantLabel: c.variantLabel ?? null, fromXp: false };
    }).concat(
      state.xpCareers.map((p) => {
        const c = idx.careers.get(p.career)!;
        return { slug: c.slug, name: c.name, variant: c.variants?.find((v) => v.slug === p.variant)?.name ?? null, variantLabel: c.variantLabel ?? null, fromXp: true };
      }),
    ),
    attributes: finalAttrs,
    limits: Object.fromEntries(
      ATTRIBUTES.map((a) => [a, attributeLimit(idx, { ...choices, careers: [...picks, ...state.xpCareers] }, a, stageOf(progress))]),
    ) as Record<Attribute, number | null>,
    derived: {
      defense: num("VEL") + num("AGI") + num("PER") + defBonus,
      initiative: num("VEL") + num("MAE") + num("PER"),
      armor: num("FIS"),
      willpower: num("FIS") + num("INT"),
      commandRange: num("INT") + comandar,
    },
    vitality: { FIS: num("FIS"), AGI: num("AGI"), INT: num("INT") },
    skills: skillList,
    otherSkills: [...idx.skills.values()]
      .filter((s) => !skillList.some((o) => o.slug === s.slug))
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        category: s.category,
        attribute: s.attribute,
        attributeText: s.attributeText,
        multiChoice: s.multiChoice,
        needsTraining: !s.untrained,
        base: resolveAttr(s.attribute, finalAttrs),
      }))
      .sort((a, b) => (a.category === b.category ? a.name.localeCompare(b.name, "pt-BR") : a.category === "military" ? -1 : a.category === "professional" && b.category === "general" ? -1 : 1)),
    abilities: assembled.abilities.map((a) => ({
      slug: a.slug,
      name: idx.abilities.get(a.slug)?.name ?? a.slug,
      param: a.param,
      source: a.source,
      text: idx.abilities.get(a.slug)?.text ?? "",
    })),
    benefits: assembled.benefits.map((b) => {
      const info = idx.benefits.get(b.slug);
      return { slug: b.slug, name: info?.name ?? b.slug, param: b.param, source: b.source, text: info?.text ?? "", isFeat: info?.isFeat ?? false };
    }),
    spells: assembled.spells.map((s) => {
      const spell = idx.spells.get(s.slug) ?? null;
      return { slug: s.slug, name: spell?.name ?? s.slug, cost: spell?.cost ?? 0, source: s.source, spell };
    }),
    spellLimit,
    connections: assembled.connections,
    languages: race.languages,
    gold: assembled.gold,
    startingGear: assembled.gear,
    facadePoints: idx.facadePoints,
    modifiers,
    notes: assembled.notes,
  };
  return { errors: [], sheet, state };
}

// ---------- espiral vital (p. 104, 148, 211) ----------

export const SPIRAL_ASPECTS = ["FIS", "AGI", "INT"] as const;
export type SpiralAspect = (typeof SPIRAL_ASPECTS)[number];

/** Círculos desenhados por ramo na ficha do livro (Físico 10, Agilidade 8, Intelecto 8; dois ramos por aspecto). */
export const SPIRAL_DRAWN_PER_BRANCH: Record<SpiralAspect, number> = { FIS: 5, AGI: 4, INT: 4 };

/**
 * O livro só diz "dividir o mais igualmente possível entre as duas ramificações" (p. 148) e não diz qual ramo
 * fica com o círculo a mais quando o atributo é ímpar. Decisão provisória: o ramo de número menor.
 */
export const ODD_EXTRA_GOES_TO_LOWER_BRANCH = true;

export type SpiralBranch = { number: number; aspect: SpiralAspect; capacity: number; drawn: number };

/** Os 6 ramos numerados (1-2 Físico, 3-4 Agilidade, 5-6 Intelecto), com os círculos disponíveis de cada um. */
export function spiralBranches(vitality: Record<SpiralAspect, number>): SpiralBranch[] {
  return SPIRAL_ASPECTS.flatMap((aspect, i) => {
    const total = vitality[aspect];
    const low = Math.floor(total / 2);
    const high = total - low;
    const [first, second] = ODD_EXTRA_GOES_TO_LOWER_BRANCH ? [high, low] : [low, high];
    const drawn = SPIRAL_DRAWN_PER_BRANCH[aspect];
    return [
      { number: i * 2 + 1, aspect, capacity: Math.min(first, drawn), drawn },
      { number: i * 2 + 2, aspect, capacity: Math.min(second, drawn), drawn },
    ];
  });
}

/** Dano marcado em cada ramo (6 números), limitado ao que o ramo comporta. */
export function clampMarks(marks: readonly number[] | undefined, branches: SpiralBranch[]): number[] {
  return branches.map((b, i) => Math.max(0, Math.min(b.capacity, Math.trunc(marks?.[i] ?? 0))));
}

export const WEAKENED_EFFECT: Record<SpiralAspect, string> = {
  FIS: "−2 em Força",
  AGI: "−2 nas jogadas de ataque",
  INT: "−2 em Defesa e não pode manter magias",
};

export type AspectStatus = { aspect: SpiralAspect; total: number; remaining: number; weakened: boolean };

/** Aspecto sem círculos livres = enfraquecido; todos zerados = debilitado (p. 212). */
export function spiralStatus(branches: SpiralBranch[], marks: readonly number[]) {
  const aspects: AspectStatus[] = SPIRAL_ASPECTS.map((aspect) => {
    const mine = branches.filter((b) => b.aspect === aspect);
    const total = mine.reduce((s, b) => s + b.capacity, 0);
    const marked = mine.reduce((s, b) => s + (marks[b.number - 1] ?? 0), 0);
    return { aspect, total, remaining: total - marked, weakened: total - marked <= 0 };
  });
  return { aspects, debilitated: aspects.every((a) => a.weakened) };
}

// ---------- ações do turno (p. 201) ----------

/** No turno: 2 ações rápidas, ou 1 rápida + 1 de ataque, ou 1 completa. */
export function validActionsUsed(used: readonly ActionCost[]): boolean {
  const q = used.filter((c) => c === "quick").length;
  const a = used.filter((c) => c === "attack").length;
  const f = used.filter((c) => c === "full").length;
  if (f > 0) return used.length === 1;
  return (q === 0 && a === 0) || (q === 1 && a === 0) || (q === 2 && a === 0) || (q === 0 && a === 1) || (q === 1 && a === 1);
}

/** Dá para gastar mais uma ação deste tipo neste turno? */
export function canSpend(used: readonly ActionCost[], cost: ActionCost) {
  return validActionsUsed([...used, cost]);
}

export type ActionRow = {
  slug: string;
  name: string;
  cost: ActionCost;
  /** "free" = uma habilidade ou benefício do personagem faz esta ação não gastar nenhuma ação do turno. */
  effectiveCost: ActionCost | "free";
  note: string | null;
  /** Por que o custo é diferente do normal (habilidade que concede, com a restrição do livro). */
  reason: string | null;
};

/** Ações do livro com o custo que valem para ESTE personagem (habilidades que dão ação extra específica ou barateiam). */
export function actionRows(idx: CatalogIndex, owned: { abilities: string[]; benefits: string[] }): ActionRow[] {
  const has = (r: { kind: "ability" | "benefit"; slug: string }) => (r.kind === "ability" ? owned.abilities : owned.benefits).includes(r.slug);
  const nameOfRule = (r: { kind: "ability" | "benefit"; slug: string }) => (r.kind === "ability" ? idx.abilities.get(r.slug)?.name : idx.benefits.get(r.slug)?.name) ?? r.slug;
  return [...idx.actions.values()].map((a) => {
    const free = a.freeWith.find(has);
    const alt = a.altCost?.find(has);
    const rule = free ?? alt;
    return {
      slug: a.slug,
      name: a.name,
      cost: a.cost,
      effectiveCost: free ? ("free" as const) : alt ? alt.cost : a.cost,
      note: a.note ?? null,
      reason: rule ? `${nameOfRule(rule)}: ${rule.note}` : null,
    };
  });
}

// ---------- progressão por XP (livro, pp. 151-152) ----------

/** Estado do personagem enquanto as progressões são aplicadas, em ordem. */
type ProgressState = {
  race: Race;
  archetype: string;
  nationality: string;
  picks: CareerPick[];
  /** Carreiras ganhas com XP: dão acesso às listas, mas não aos itens iniciais (p. 152). */
  xpCareers: CareerPick[];
  assembled: Assembled;
  attrs: Record<Attribute, number | null>;
  trad: ReturnType<typeof tradition>;
};

export type SkillOption = { skill: string; name: string; specialty: string | null; freeSpecialty: boolean; level: number; cap: number };
export type AdvanceCandidates = {
  professional: SkillOption[];
  military: SkillOption[];
  abilities: { slug: string; name: string; param: string | null; freeParam: boolean }[];
  connections: string[];
  spells: { slug: string; name: string }[];
  attributes: { attribute: Attribute; value: number; max: number }[];
  benefits: { slug: string; name: string; param: "skill" | "spell" | null; paramOptions: { slug: string; name: string }[] }[];
  /** `professional`: perícias profissionais que dá para subir já com a carreira nova (os +2 pontos). */
  careers: { slug: string; name: string; variants: { slug: string; name: string }[]; professional: SkillOption[] }[];
};

const skillKey = (skill: string, specialty?: string | null) => `${skill}|${specialty ?? ""}`;

/** Limite de magias: 2 × INT (3 × INT com Acadêmico Arcano, p. 152). Null = não conjura. */
function spellLimitOf(st: Pick<ProgressState, "attrs" | "trad" | "assembled">) {
  if (st.attrs.ARC === null && !st.trad) return null;
  const academico = st.assembled.abilities.some((a) => a.slug === "academico-arcano");
  return (st.attrs.INT ?? 0) * (academico ? 3 : 2);
}

/** O que a progressão pode escolher agora, já filtrado pelas regras (listas das carreiras, níveis, pré-requisitos). */
function candidates(idx: CatalogIndex, st: ProgressState, stage: Stage, withCareer = true): AdvanceCandidates {
  const careers = [...st.picks, ...st.xpCareers].map((p) => idx.careers.get(p.career)!);
  const stageMax = idx.skillMaxByStage[stage];
  const forbidden = st.race.restrictions.forbiddenMilitarySkills ?? [];

  const skillOptions = (kind: "militarySkills" | "professionalSkills") => {
    const out = new Map<string, SkillOption>();
    const put = (key: string, option: SkillOption) => out.set(key, { ...option, cap: Math.max(option.cap, out.get(key)?.cap ?? 0) });
    for (const career of careers) {
      for (const ref of career.progression[kind]) {
        const def = idx.skills.get(ref.skill);
        if (!def || (kind === "militarySkills" && forbidden.includes(ref.skill))) continue;
        const cap = Math.min(stageMax, ref.maxLevel ?? stageMax);
        const free = def.multiChoice && !ref.specialty;
        // Especialidade livre (Ofício, Conhecimento…): as que o personagem já tem, e uma nova.
        const specialties = free ? [...st.assembled.skills.values()].filter((s) => s.slug === ref.skill).map((s) => s.specialty) : [ref.specialty];
        for (const specialty of specialties) {
          const key = skillKey(ref.skill, specialty);
          put(key, { skill: ref.skill, name: def.name, specialty, freeSpecialty: false, level: st.assembled.skills.get(key)?.level ?? 0, cap });
        }
        if (free) put(skillKey(ref.skill, "*"), { skill: ref.skill, name: def.name, specialty: null, freeSpecialty: true, level: 0, cap });
      }
    }
    return [...out.values()].filter((o) => o.level < o.cap).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  };

  const owned: Owned = { attributes: st.attrs, skills: new Map(), abilities: new Set(st.assembled.abilities.map((a) => a.slug)), archetype: st.archetype };
  for (const s of st.assembled.skills.values()) owned.skills.set(s.slug, Math.max(owned.skills.get(s.slug) ?? 0, s.level));

  const abilities = new Map<string, AdvanceCandidates["abilities"][number]>();
  for (const career of careers) {
    for (const ref of career.progression.abilities) {
      const ab = idx.abilities.get(ref.ability);
      if (!ab || !meetsPrerequisites(idx, ab.prerequisites, owned)) continue;
      const freeParam = isFreeLanguage(ref) || (ab.repeatable && !ref.param);
      const param = freeParam ? null : (ref.param ?? null);
      const has = st.assembled.abilities.filter((a) => a.slug === ab.slug);
      if (has.length && !ab.repeatable) continue;
      if (!freeParam && has.some((a) => a.param === param)) continue;
      abilities.set(`${ab.slug}|${param ?? ""}`, { slug: ab.slug, name: ab.name, param, freeParam });
    }
  }

  const knownConnections = new Set(st.assembled.connections);
  const connections = [...new Set(careers.flatMap((c) => c.progression.connections))].filter((c) => !knownConnections.has(c));

  const limit = spellLimitOf(st);
  const known = new Set(st.assembled.spells.map((s) => s.slug));
  const spellSlugs = limit !== null && known.size < limit ? reachableSpellLists(idx, [...st.picks, ...st.xpCareers]).flatMap((l) => idx.spellLists.get(l) ?? []) : [];
  const spells = [...new Set(spellSlugs)].filter((s) => !known.has(s)).map((s) => ({ slug: s, name: idx.spells.get(s)?.name ?? s }));

  const forLimits = { race: st.race.slug, careers: [...st.picks, ...st.xpCareers] };
  const attributes = ATTRIBUTES.flatMap((a) => {
    const value = st.attrs[a];
    const max = attributeLimit(idx, forLimits, a, stage);
    return value !== null && max !== null && value < max ? [{ attribute: a, value, max }] : [];
  });

  const ownedBenefits = new Set(st.assembled.benefits.map((b) => b.slug));
  const militaryOwned = [...new Set([...st.assembled.skills.values()].filter((s) => idx.skills.get(s.slug)?.category === "military").map((s) => s.slug))];
  const benefits = (idx.archetypes.get(st.archetype)?.benefits ?? [])
    .filter((b) => !ownedBenefits.has(b.slug))
    .map((b) => {
      const param = b.slug === "virtuoso" ? ("skill" as const) : b.slug === "estudo-adicional" ? ("spell" as const) : null;
      const paramOptions =
        param === "skill" ? militaryOwned.map((s) => ({ slug: s, name: idx.skills.get(s)?.name ?? s })) : param === "spell" ? spells : [];
      return { slug: b.slug, name: b.name, param, paramOptions };
    })
    .filter((b) => b.param === null || b.paramOptions.length > 0);

  const have = new Set(careers.map((c) => c.slug));
  const ctx = { race: st.race.slug, archetype: st.archetype };
  const careerOptions = [...idx.careers.values()]
    .filter(
      (c) =>
        !have.has(c.slug) &&
        !c.initialOnly &&
        !careerBlockReason(idx, ctx, c.slug) &&
        careers.every((o) => !careerBlockReason(idx, { ...ctx, otherCareer: o.slug }, c.slug)) &&
        (!c.prerequisites.nation || nationalityMatches(c.prerequisites.nation, st.nationality)),
    )
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      variants: (c.variants ?? []).map((v) => ({ slug: v.slug, name: v.name })),
      professional: withCareer ? candidates(idx, { ...st, xpCareers: [...st.xpCareers, { career: c.slug, skillChoices: [], languages: [] }] }, stage, false).professional : [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return {
    professional: skillOptions("professionalSkills"),
    military: skillOptions("militarySkills"),
    abilities: [...abilities.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    connections,
    spells: spells.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    attributes,
    benefits,
    careers: careerOptions,
  };
}

/** Sobe a perícia em 1 nível se a escolha estiver entre as opções; devolve o erro, se houver. */
function raiseSkill(idx: CatalogIndex, st: ProgressState, options: SkillOption[], pick: { skill: string; specialty?: string }) {
  const specialty = pick.specialty?.trim() || null;
  const key = skillKey(pick.skill, specialty);
  const option =
    options.find((o) => !o.freeSpecialty && o.skill === pick.skill && o.specialty === specialty) ??
    (specialty ? options.find((o) => o.freeSpecialty && o.skill === pick.skill) : undefined);
  const level = st.assembled.skills.get(key)?.level ?? 0;
  if (!option || level >= option.cap) return `${idx.skills.get(pick.skill)?.name ?? pick.skill}: não pode subir (fora das carreiras ou no nível máximo).`;
  st.assembled.skills.set(key, { slug: pick.skill, specialty, level: level + 1 });
  return null;
}

function applyAdvance(idx: CatalogIndex, st: ProgressState, a: Advance, stage: Stage): string | null {
  const c = candidates(idx, st, stage, false);
  const src = `XP ${a.xp}`;
  const skills = a.skills ?? [];
  const twoProfessional = () => {
    if (skills.length !== 2) return "escolha 2 pontos de perícia profissional.";
    for (const pick of skills) {
      const error = raiseSkill(idx, st, candidates(idx, st, stage, false).professional, pick); // recalcula: os 2 pontos podem ir na mesma
      if (error) return error;
    }
    return null;
  };
  const benefit = () => {
    const b = c.benefits.find((x) => x.slug === a.benefit);
    if (!b) return "benefício de arquétipo indisponível.";
    if (b.param && !b.paramOptions.some((o) => o.slug === a.param)) return `${b.name}: escolha ${b.param === "skill" ? "a perícia militar" : "a magia"}.`;
    st.assembled.benefits.push({ slug: b.slug, param: a.param ?? null, source: src });
    if (b.slug === "estudo-adicional" && a.param) st.assembled.spells.push({ slug: a.param, source: "Estudo Adicional" });
    return null;
  };

  switch (a.grant) {
    case "professional-points":
      return twoProfessional();
    case "attribute": {
      const opt = c.attributes.find((x) => x.attribute === a.attribute);
      if (!opt) return "atributo no máximo do estágio (ou inválido).";
      st.attrs[opt.attribute] = opt.value + 1;
      return null;
    }
    case "choose-one":
      if (a.kind === "military") return skills.length === 1 ? raiseSkill(idx, st, c.military, skills[0]!) : "escolha 1 perícia militar.";
      if (a.kind === "ability") {
        const opt = c.abilities.find((x) => x.slug === a.ability && (x.freeParam ? !!a.param?.trim() : x.param === (a.param ?? null)));
        if (!opt) return "habilidade indisponível (fora das carreiras, já possuída ou sem pré-requisito).";
        st.assembled.abilities.push({ slug: opt.slug, param: opt.freeParam ? a.param!.trim() : opt.param, source: src });
        return null;
      }
      if (a.kind === "connection") {
        if (!a.connection || !c.connections.includes(a.connection)) return "conexão indisponível.";
        st.assembled.connections.push(a.connection);
        return null;
      }
      if (a.kind === "spell") {
        if (!c.spells.some((s) => s.slug === a.spell)) return "magia indisponível (fora das listas ou no limite de magias).";
        st.assembled.spells.push({ slug: a.spell!, source: src });
        return null;
      }
      return "escolha perícia militar, habilidade, conexão ou magia.";
    case "archetype-benefit":
      return benefit();
    case "archetype-benefit-or-career": {
      if (!a.career) return benefit();
      const opt = c.careers.find((x) => x.slug === a.career);
      if (!opt) return "carreira indisponível.";
      if (opt.variants.length && !opt.variants.some((v) => v.slug === a.variant)) return `${opt.name}: escolha a variante.`;
      st.xpCareers.push({ career: opt.slug, variant: a.variant, skillChoices: [], languages: [] });
      return twoProfessional();
    }
  }
}

/** Aplica as progressões em ordem, conferindo cada uma contra a tabela e as regras. */
function applyAdvances(idx: CatalogIndex, st: ProgressState, advances: Advance[], progress: Progress, err: (m: string) => void) {
  const done = new Set<number>();
  for (const a of [...advances].sort((x, y) => x.xp - y.xp)) {
    const row = idx.progressionRows.find((r) => r.xp === a.xp);
    if (!row || row.grant !== a.grant) return err(`Progressão inválida em ${a.xp} XP.`);
    if (a.xp > progress.xp) return err(`Progressão de ${a.xp} XP ainda não liberada.`);
    if (done.has(a.xp)) return err(`Progressão de ${a.xp} XP repetida.`);
    done.add(a.xp);
    const stage: Stage = row.table;
    const error = applyAdvance(idx, st, a, stage);
    if (error) return err(`${a.xp} XP: ${error}`);
  }
}

/** Linhas da tabela já liberadas pelo XP e ainda não escolhidas (a mais baixa primeiro). */
export function pendingAdvances(idx: CatalogIndex, choices: CharacterChoices, progress: Progress) {
  const done = new Set((choices.advances ?? []).map((a) => a.xp));
  return idx.progressionRows.filter((r) => r.xp <= progress.xp && !done.has(r.xp));
}

/** Próxima progressão pendente e o que dá para escolher nela (null se não há pendente ou a ficha é inválida). */
export function nextAdvance(idx: CatalogIndex, choices: CharacterChoices, details: CharacterDetails, progress: Progress) {
  const pending = pendingAdvances(idx, choices, progress);
  const row = pending[0];
  if (!row) return null;
  const result = evaluate(idx, choices, details, progress);
  if (!result.state) return null;
  const stage: Stage = row.table;
  return { row, stage, pendingCount: pending.length, text: idx.grantText[row.grant], options: candidates(idx, result.state, stage, row.grant === "archetype-benefit-or-career") };
}
