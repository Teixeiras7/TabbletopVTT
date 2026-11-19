import { z } from "zod";
import { ATTRIBUTES } from "@/lib/catalog/schemas";

// Formato do que o cliente envia ao criar/editar personagem. Limites de tamanho de propósito:
// o conteúdo de verdade (existe? é permitido?) é validado pelo engine contra o catálogo.
const slug = z.string().min(1).max(80);
const attribute = z.enum(ATTRIBUTES);

export const careerPickSchema = z.object({
  career: slug,
  variant: slug.optional(),
  skillChoices: z.array(z.array(slug).max(8)).max(6),
  languages: z.array(z.string().max(40)).max(4),
  /** Opção escolhida em cada escolha de bens da carreira (ex.: Pistoleiro: canhão de mão ou par de pistolas). */
  gear: z.array(z.number().int().min(0).max(10)).max(4).optional(),
});

const skillPick = z.object({ skill: slug, specialty: z.string().trim().max(60).optional() });

/** Uma progressão escolhida com XP (livro, p. 152). O motor confere se cabe nas regras. */
export const advanceSchema = z.object({
  xp: z.number().int().min(1).max(200),
  grant: z.enum(["professional-points", "choose-one", "attribute", "archetype-benefit", "archetype-benefit-or-career"]),
  /** choose-one: o que foi escolhido. */
  kind: z.enum(["military", "ability", "connection", "spell"]).optional(),
  /** +2 perícias profissionais (2 pontos, podem ir na mesma perícia) ou +1 perícia militar (1). */
  skills: z.array(skillPick).max(2).optional(),
  ability: slug.optional(),
  param: z.string().trim().max(60).optional(),
  connection: z.string().max(120).optional(),
  spell: slug.optional(),
  attribute: attribute.optional(),
  benefit: slug.optional(),
  career: slug.optional(),
  variant: slug.optional(),
});
export type AdvanceInput = z.infer<typeof advanceSchema>;

const itemText = {
  name: z.string().trim().min(1, "Dê um nome ao item.").max(80, "Nome muito longo (máximo 80)."),
  description: z.string().trim().max(2000, "Descrição muito longa (máximo 2000)."),
};
const qty = z.number().int().min(0, "Quantidade inválida.").max(9999, "Quantidade grande demais.");

/** Mudanças no inventário/dinheiro pela aba Equipamentos. `qty` 0 tira o item. */
export const inventoryOpSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add-catalog"), id: slug, qty: qty.min(1) }),
  z.object({ type: z.literal("add-custom"), ...itemText, qty: qty.min(1) }),
  z.object({ type: z.literal("edit"), key: z.string().max(80), ...itemText }),
  z.object({ type: z.literal("qty"), key: z.string().max(80), qty }),
  z.object({ type: z.literal("money"), money: z.number().min(0, "Dinheiro não pode ser negativo.").max(1_000_000) }),
]);

export const choicesSchema = z.object({
  race: slug,
  raceAttributeChoice: attribute.optional(),
  archetype: slug,
  archetypeBenefit: slug,
  archetypeBenefitParam: slug.optional(),
  careers: z.array(careerPickSchema).max(2),
  extraAbility: slug.optional(),
  attributePoints: z.partialRecord(attribute, z.number().int().min(0).max(10)),
  /** Progressões já escolhidas com XP, na ordem da tabela. */
  advances: z.array(advanceSchema).max(40).optional(),
});

const text = (max: number) => z.string().max(max).default("");
export const detailsSchema = z.object({
  name: text(80),
  age: text(40),
  nationality: text(80),
  filiation: text(160),
  organization: text(160),
  height: text(40),
  weight: text(40),
  crimes: text(700),
  appearance: text(1500),
});

export const characterIdSchema = z.uuid();

// Estado de jogo (muda na sessão): dano marcado por ramo da espiral vital e ações já gastas no turno.
export const characterStateSchema = z.object({
  marks: z.array(z.number().int().min(0).max(10)).length(6).optional(),
  actionsUsed: z.array(z.enum(["quick", "attack", "full"])).max(2).optional(),
});

export const noteSchema = z.object({
  title: z.string().trim().min(1, "Dê um título à nota.").max(80, "Título muito longo (máximo 80)."),
  content: z.string().trim().min(1, "Escreva a nota.").max(5000, "Nota muito longa (máximo 5000)."),
});
