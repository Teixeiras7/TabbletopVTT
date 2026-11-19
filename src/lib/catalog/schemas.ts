import { z } from "zod";

// Formato dos arquivos em data/catalog/*.json (gerados do manual, ver docs/regras/).
// `.strict()` de propósito: campo novo no JSON sem entrar aqui deve falhar no teste.

export const ATTRIBUTES = ["FIS", "VEL", "FOR", "AGI", "DES", "MAE", "INT", "ARC", "PER"] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
const attributeKey = z.enum(ATTRIBUTES);

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const raceAttribute = z
  .object({ start: z.number().int().nullable(), hero: z.number().int(), veteran: z.number().int(), epic: z.number().int() })
  .strict();

export const raceSchema = z
  .object({
    slug,
    name: z.string(),
    sourcePage: z.number().int(),
    // null = a raça não tem o atributo (ARC de Gobber e Ogrun); start null = só para Dotado (ARC)
    attributes: z.record(attributeKey, raceAttribute.nullable()),
    archetypes: z.array(slug),
    languages: z.string(),
    features: z.string(),
    grants: z
      .object({
        attributeChoice: z.object({ options: z.array(attributeKey), amount: z.number() }).strict().optional(),
        abilities: z.array(slug).optional(),
        connections: z.array(z.string()).optional(),
        archetypeBenefits: z.array(slug).optional(),
        defBonus: z.number().optional(),
        extraCareerAbility: z.number().optional(),
      })
      .strict(),
    restrictions: z
      .object({ forbiddenMilitarySkills: z.array(slug).optional(), dotadoCareerBans: z.array(slug).optional() })
      .strict(),
    heightWeightNote: z.string().nullable(),
  })
  .strict();

export const archetypeSchema = z
  .object({
    slug,
    name: z.string(),
    sourcePage: z.number().int(),
    rules: z.array(z.string()),
    benefits: z.array(z.object({ slug, name: z.string(), isFeat: z.boolean(), text: z.string() }).strict()),
  })
  .strict();

export const skillSchema = z
  .object({
    slug,
    name: z.string(),
    category: z.enum(["military", "professional", "general"]),
    attribute: z.string(),
    attributeText: z.string(),
    multiChoice: z.boolean(),
    untrained: z.boolean(),
    sourcePage: z.number().int().nullable(),
    text: z.string(),
  })
  .strict();

export const abilitySchema = z
  .object({
    slug,
    name: z.string(),
    prerequisites: z.string().nullable(),
    text: z.string(),
    repeatable: z.boolean(),
    sourcePage: z.number().int().nullable(),
  })
  .strict();

export const spellSchema = z
  .object({
    slug,
    name: z.string(),
    sourcePage: z.number().int().nullable(),
    cost: z.number().int(),
    costVariable: z.boolean(),
    range: z.string(),
    area: z.string(),
    pod: z.union([z.number(), z.string()]).nullable(),
    sustainable: z.boolean(),
    offensive: z.boolean().nullable(),
    offensiveText: z.string(),
    text: z.string(),
  })
  .strict();

export const spellListSchema = z.object({ slug, name: z.string(), entries: z.array(slug) }).strict();

const abilityRef = z.object({ ability: slug, param: z.string().optional() }).strict();
const skillRef = z
  .object({
    skill: slug,
    level: z.number().int().nullable(),
    specialty: z.string().nullable(),
  })
  .strict();
const initialSkill = z.union([
  skillRef.extend({ type: z.literal("fixed") }).strict(),
  z.object({ type: z.literal("choose"), count: z.number().int(), options: z.array(skillRef) }).strict(),
]);
const progressionSkill = z
  .object({ skill: slug, maxLevel: z.number().int().nullable(), specialty: z.string().nullable() })
  .strict();

/** Bem inicial: item da Lista de Preços (`item`) ou item de texto (fora da lista, editável na ficha). */
const kitEntry = z.union([
  z.object({ item: slug, qty: z.number().int().positive() }).strict(),
  z.object({ text: z.string(), qty: z.number().int().positive() }).strict(),
]);
export type KitEntry = z.infer<typeof kitEntry>;

export const careerSchema = z
  .object({
    slug,
    name: z.string(),
    sourcePage: z.number().int(),
    prerequisites: z
      .object({ races: z.array(slug), archetypes: z.array(slug), nation: z.string().nullable(), text: z.string() })
      .strict(),
    initialOnly: z.boolean(),
    focalizer: z.boolean(),
    special: z.string().nullable(),
    initial: z
      .object({
        abilities: z.array(abilityRef),
        militarySkills: z.array(initialSkill),
        professionalSkills: z.array(initialSkill),
        connections: z.array(z.string()),
        spells: z.array(slug),
        gear: z
          .object({
            co: z.number().int().nullable(),
            items: z.string().nullable(),
            kit: z.array(kitEntry).optional(),
            choices: z.array(z.object({ label: z.string(), options: z.array(z.object({ label: z.string(), kit: z.array(kitEntry) }).strict()) }).strict()).optional(),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    progression: z
      .object({
        abilities: z.array(abilityRef),
        militarySkills: z.array(progressionSkill),
        professionalSkills: z.array(progressionSkill),
        connections: z.array(z.string()),
        spellLists: z.array(slug),
      })
      .strict(),
    notes: z.array(z.string()),
    grantsBenefits: z.array(slug).nullish(),
    secondCareerOneOf: z.array(slug).nullish(),
    variantLabel: z.string().nullish(),
    variants: z
      .array(
        z
          .object({
            slug,
            name: z.string(),
            abilities: z.array(abilityRef),
            spells: z.array(slug),
            professionalSkills: z.array(initialSkill).optional(),
            connections: z.array(z.string()).optional(),
            spellList: slug,
            bonus: z
              .object({ attribute: attributeKey, initial: z.number(), maxPerStage: z.number(), text: z.string() })
              .strict()
              .nullable()
              .optional(),
          })
          .strict(),
      )
      .nullish(),
  })
  .strict();

export const connectionSchema = z.object({ slug, name: z.string() }).strict();

export const ACTION_COSTS = ["quick", "attack", "full"] as const;
const actionCost = z.enum(ACTION_COSTS);
const actionRule = z.object({ kind: z.enum(["ability", "benefit"]), slug, note: z.string() }).strict();
/** Ações do turno (livro, pp. 201-202) e quais habilidades/benefícios as deixam sem custo (ou mais baratas). */
export const actionSchema = z
  .object({
    slug,
    name: z.string(),
    cost: actionCost,
    note: z.string().nullish(),
    freeWith: z.array(actionRule),
    altCost: z.array(actionRule.extend({ cost: actionCost }).strict()).nullish(),
    sourcePage: z.number().int(),
  })
  .strict();

/** Categorias da Lista de Preços do livro (pp. 241-245), na ordem e com os nomes de lá. */
export const EQUIPMENT_CATEGORIES = {
  armaduras: "Armaduras",
  "armas-corpo-a-corpo": "Armas corpo-a-corpo",
  "armas-a-distancia": "Armas de ataque à distância",
  "municoes-e-acessorios": "Munições e acessórios",
  vestuario: "Vestuário",
  equipamentos: "Equipamentos",
  montarias: "Montarias",
  "alimentacao-e-acomodacao": "Alimentação e acomodação",
  mekanica: "Mekânica",
  "runas-mekanicas": "Runas mekânicas",
  "dispositivos-mecanicos": "Dispositivos mecânicos",
  "ingredientes-alquimicos": "Ingredientes alquímicos",
  "compostos-alquimicos": "Compostos alquímicos",
  "armas-alquimicas": "Armas alquímicas",
} as const;
export type EquipmentCategory = keyof typeof EQUIPMENT_CATEGORIES;

/** Item da Lista de Preços. Preço em coroas de ouro (CO). */
export const equipmentSchema = z
  .object({
    slug,
    name: z.string(),
    category: z.enum(Object.keys(EQUIPMENT_CATEGORIES) as [EquipmentCategory, ...EquipmentCategory[]]),
    price: z.number().int().positive(),
    minimum: z.boolean().optional(), // "5+ CO": a partir desse valor
    addOn: z.boolean().optional(), // "+10 CO": acréscimo sobre outro item
    armorType: z.enum(["Leve", "Média", "Pesada"]).nullish(),
    /** Campos do livro na ordem impressa (Perícia, POD, Modificador de ARM, Descrição, Regras Especiais…). Sem = só na Lista de Preços. */
    details: z.array(z.object({ label: z.string(), text: z.string() }).strict()).nullish(),
    sourcePage: z.number().int().nullish(),
  })
  .strict();

const progressionGrant = z.enum([
  "professional-points",
  "choose-one",
  "attribute",
  "archetype-benefit",
  "archetype-benefit-or-career",
]);
const progressionRows = z.array(z.object({ xp: z.number().int(), grant: progressionGrant }).strict());
export const progressionSchema = z
  .object({
    source: z.string(),
    skillMaxLevelByStage: z.object({ hero: z.number(), veteran: z.number(), epic: z.number() }).strict(),
    creationAttributePoints: z.number().int(),
    creationFacadePoints: z.number().int(),
    table: z.object({ hero: progressionRows, veteran: progressionRows, epic: progressionRows }).strict(),
    grants: z.record(progressionGrant, z.string()),
  })
  .strict();

export type Connection = z.infer<typeof connectionSchema>;
export type Action = z.infer<typeof actionSchema>;
export type ActionCost = (typeof ACTION_COSTS)[number];
export type Race = z.infer<typeof raceSchema>;
export type Archetype = z.infer<typeof archetypeSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type Spell = z.infer<typeof spellSchema>;
export type SpellList = z.infer<typeof spellListSchema>;
export type Career = z.infer<typeof careerSchema>;
export type Progression = z.infer<typeof progressionSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;

export type Catalog = {
  races: Race[];
  archetypes: Archetype[];
  skills: Skill[];
  abilities: Ability[];
  spells: Spell[];
  spellLists: SpellList[];
  careers: Career[];
  connections: Connection[];
  actions: Action[];
  progression: Progression;
  equipment: Equipment[];
};
