import { boolean, index, integer, jsonb, numeric, pgEnum, pgPolicy, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Archetype, Career, Equipment, Progression, Race, Skill, Action } from "../catalog/schemas";
import type { CombatState } from "../engine/combat";

// Banco em português; as chaves em TypeScript ficam como o código já usa.
// O backend acessa tudo pela conexão privilegiada (ignora RLS). As policies são defesa em profundidade
// para quem consultar o Supabase direto, e para o Realtime, que respeita RLS.

const createdAt = () => timestamp("criado_em", { withTimezone: true }).notNull().defaultNow();
const isMember = (tableId: unknown) =>
  sql`exists (select 1 from membros m where m.mesa_id = ${tableId} and m.usuario_id = auth.uid())`;
const isMaster = (tableId: unknown) => sql`exists (select 1 from mesas g where g.id = ${tableId} and g.dono_id = auth.uid())`;

/** Dados do usuário (espelha `auth.users`). */
export const profiles = pgTable(
  "perfis",
  {
    id: uuid("id").primaryKey(),
    displayName: text("nome").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    pgPolicy("perfis_ler_proprio", { for: "select", to: "authenticated", using: sql`auth.uid() = ${t.id}` }),
    pgPolicy("perfis_editar_proprio", { for: "update", to: "authenticated", using: sql`auth.uid() = ${t.id}` }),
  ],
).enableRLS();

/** Mesa. Quem criou (`ownerId`) é o Mestre; os demais membros são Jogadores (papel não é gravado). */
export const gameTables = pgTable(
  "mesas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("nome").notNull(),
    description: text("descricao"),
    ownerId: uuid("dono_id").notNull().references(() => profiles.id),
    inviteCode: text("codigo_convite").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [pgPolicy("mesas_ler_membro", { for: "select", to: "authenticated", using: isMember(t.id) })],
).enableRLS();

/** Participantes da mesa (o criador também). `chatClearedAt`: "limpar chat" só para esta pessoa. */
export const gameTableMembers = pgTable(
  "membros",
  {
    tableId: uuid("mesa_id").notNull().references(() => gameTables.id, { onDelete: "cascade" }),
    userId: uuid("usuario_id").notNull().references(() => profiles.id),
    joinedAt: timestamp("entrou_em", { withTimezone: true }).notNull().defaultNow(),
    chatClearedAt: timestamp("chat_limpo_em", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.tableId, t.userId] }),
    index("membros_usuario_idx").on(t.userId),
    pgPolicy("membros_ler_proprio", { for: "select", to: "authenticated", using: sql`auth.uid() = ${t.userId}` }),
  ],
).enableRLS();

export type ChatRoll = { title: string; total: number; label: string; detail: string };

/** Chat da mesa. Só as últimas mensagens ficam (src/lib/mesas/chat.ts apaga as antigas). */
export const chatMessages = pgTable(
  "mensagens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("mesa_id").notNull().references(() => gameTables.id, { onDelete: "cascade" }),
    authorId: uuid("autor_id").notNull().references(() => profiles.id),
    authorName: text("autor_nome").notNull(),
    content: text("texto").notNull(),
    /** Rolagem (cartão no chat: título, total, nome, detalhe dos dados). `texto` guarda a versão em texto. */
    roll: jsonb("rolagem").$type<ChatRoll>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("mensagens_mesa_criado_idx").on(t.tableId, t.createdAt),
    pgPolicy("mensagens_ler_membro", { for: "select", to: "authenticated", using: isMember(t.tableId) }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------------------------
// Catálogo do manual: igual para todas as mesas, só leitura para o app. Fonte: data/catalog/*.json,
// carregado por `npm run db:seed`. `id` é o identificador que a ficha guarda. Sem policy: só o backend lê.

export const races = pgTable("racas", {
  slug: text("id").primaryKey(),
  name: text("nome").notNull(),
  sourcePage: integer("pagina").notNull(),
  attributes: jsonb("atributos").$type<Race["attributes"]>().notNull(),
  archetypes: text("arquetipos").array().notNull(),
  languages: text("idiomas").notNull(),
  features: text("caracteristicas").notNull(),
  grants: jsonb("concede").$type<Race["grants"]>().notNull(),
  restrictions: jsonb("restricoes").$type<Race["restrictions"]>().notNull(),
  heightWeightNote: text("altura_peso"),
}).enableRLS();

export const archetypes = pgTable("arquetipos", {
  slug: text("id").primaryKey(),
  name: text("nome").notNull(),
  sourcePage: integer("pagina").notNull(),
  rules: text("regras").array().notNull(),
  benefits: jsonb("beneficios").$type<Archetype["benefits"]>().notNull(),
}).enableRLS();

export const careers = pgTable("carreiras", {
  slug: text("id").primaryKey(),
  name: text("nome").notNull(),
  sourcePage: integer("pagina").notNull(),
  prerequisites: jsonb("pre_requisitos").$type<Career["prerequisites"]>().notNull(),
  initialOnly: boolean("apenas_inicial").notNull(),
  focalizer: boolean("focalizador").notNull(),
  special: text("especial"),
  initial: jsonb("inicial").$type<Career["initial"]>().notNull(),
  progression: jsonb("progressao").$type<Career["progression"]>().notNull(),
  notes: text("notas").array().notNull(),
  grantsBenefits: text("concede_beneficios").array(),
  secondCareerOneOf: text("segunda_carreira_uma_de").array(),
  variantLabel: text("rotulo_variante"),
  variants: jsonb("variantes").$type<NonNullable<Career["variants"]>>(),
}).enableRLS();

export const skills = pgTable("pericias", {
  slug: text("id").primaryKey(),
  name: text("nome").notNull(),
  category: text("categoria").$type<Skill["category"]>().notNull(),
  attribute: text("atributo").notNull(),
  attributeText: text("atributo_texto").notNull(),
  multiChoice: boolean("varias_vezes").notNull(),
  untrained: boolean("sem_treino").notNull(),
  sourcePage: integer("pagina"),
  text: text("texto").notNull(),
}).enableRLS();

export const abilities = pgTable("habilidades", {
  slug: text("id").primaryKey(),
  name: text("nome").notNull(),
  prerequisites: text("pre_requisitos"),
  text: text("texto").notNull(),
  repeatable: boolean("repetivel").notNull(),
  sourcePage: integer("pagina"),
}).enableRLS();

export const spells = pgTable("magias", {
  slug: text("id").primaryKey(),
  name: text("nome").notNull(),
  sourcePage: integer("pagina"),
  cost: integer("custo").notNull(),
  costVariable: boolean("custo_variavel").notNull(),
  range: text("alcance").notNull(),
  area: text("area").notNull(),
  pod: jsonb("pod").$type<number | string | null>(),
  sustainable: boolean("manutencao").notNull(),
  offensive: boolean("ofensiva"),
  offensiveText: text("ofensiva_texto").notNull(),
  text: text("texto").notNull(),
}).enableRLS();

export const spellLists = pgTable("listas_de_magias", {
  slug: text("id").primaryKey(),
  name: text("nome").notNull(),
  entries: text("magias").array().notNull(),
}).enableRLS();

export const connections = pgTable("conexoes", {
  slug: text("id").primaryKey(),
  name: text("nome").notNull(),
}).enableRLS();

export const actions = pgTable("acoes", {
  slug: text("id").primaryKey(),
  name: text("nome").notNull(),
  cost: text("custo").$type<Action["cost"]>().notNull(),
  note: text("nota"),
  freeWith: jsonb("sem_custo_com").$type<Action["freeWith"]>().notNull(),
  altCost: jsonb("custo_alternativo").$type<NonNullable<Action["altCost"]>>(),
  sourcePage: integer("pagina").notNull(),
}).enableRLS();

/** Tabela de progressão por XP (uma linha, id "padrao"). */
export const progression = pgTable("progressao", {
  id: text("id").primaryKey(),
  source: text("fonte").notNull(),
  skillMaxLevelByStage: jsonb("nivel_max_pericia").$type<Progression["skillMaxLevelByStage"]>().notNull(),
  creationAttributePoints: integer("pontos_atributo_criacao").notNull(),
  creationFacadePoints: integer("pontos_facanha_criacao").notNull(),
  table: jsonb("tabela").$type<Progression["table"]>().notNull(),
  grants: jsonb("concessoes").$type<Progression["grants"]>().notNull(),
}).enableRLS();

/** Lista de Preços do livro (pp. 241-245). Preço em coroas de ouro (CO). */
export const equipment = pgTable("equipamentos", {
  slug: text("id").primaryKey(),
  name: text("nome").notNull(),
  category: text("categoria").$type<Equipment["category"]>().notNull(),
  price: integer("preco").notNull(),
  minimum: boolean("preco_minimo").notNull().default(false), // "5+ CO"
  addOn: boolean("acrescimo").notNull().default(false), // "+10 CO" sobre outro item
  armorType: text("tipo_armadura").$type<NonNullable<Equipment["armorType"]>>(),
  details: jsonb("detalhes").$type<NonNullable<Equipment["details"]>>(),
  sourcePage: integer("pagina"),
}).enableRLS();

// ---------------------------------------------------------------------------------------------

/**
 * Personagem. Guarda só as ESCOLHAS (ids do catálogo), os detalhes narrativos, o estado da sessão
 * (dano, ações gastas), as notas do jogador, o dinheiro e o inventário (ids do catálogo). Tudo que é calculado (DEF, ARM, perícias…) o engine
 * monta na hora (src/lib/engine/character.ts).
 */
export const characters = pgTable(
  "personagens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("mesa_id").notNull().references(() => gameTables.id, { onDelete: "cascade" }),
    ownerId: uuid("dono_id").notNull().references(() => profiles.id),
    name: text("nome").notNull(),
    choices: jsonb("escolhas").notNull(),
    details: jsonb("detalhes").notNull(),
    imageUrl: text("imagem_url"), // Storage `character-images/<mesa>/<personagem>/image`
    state: jsonb("estado").notNull().default({}),
    notes: jsonb("notas").$type<CharacterNote[]>().notNull().default([]),
    /** XP total, dado pelo Mestre (livro, p. 151). As progressões que ele libera são escolhas da ficha. */
    xp: integer("xp").notNull().default(0),
    /** Coroas de ouro, com uma casa decimal. Começa com as CO das carreiras (livro). */
    money: numeric("dinheiro", { precision: 10, scale: 1, mode: "number" }).notNull().default(0),
    /** Equipamentos possuídos: id do catálogo e quantidade. */
    inventory: jsonb("inventario").$type<InventoryItem[]>().notNull().default([]),
    /** Última rolagem de Negociação (% de compra e de venda), válida enquanto a Loja está aberta. */
    negotiation: jsonb("negociacao").$type<Negotiation>(),
    createdAt: createdAt(),
    updatedAt: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("personagens_mesa_idx").on(t.tableId),
    // Ficha completa: dono e Mestre. Os demais veem só o dossiê, entregue pelo backend.
    pgPolicy("personagens_ler_dono_ou_mestre", {
      for: "select",
      to: "authenticated",
      using: sql`${t.ownerId} = auth.uid() or ${isMaster(t.tableId)}`,
    }),
  ],
).enableRLS();

export type CharacterNote = { id: string; title: string; content: string };
/** Item possuído: da Lista de Preços (`id`) ou de texto (`custom`: bens fora da lista, nome e descrição editáveis). */
export type InventoryItem = { id: string; qty: number } | { custom: string; name: string; description: string; qty: number };
export type Negotiation = { buy?: number; sell?: number };

export const infoKind = pgEnum("tipo_info", ["image", "note"]);

/**
 * Aba Infos: imagens (só o Mestre cria) e notas (qualquer participante). O que o Mestre cria nasce
 * oculto até ele mostrar (src/lib/mesas/info-rules.ts).
 */
export const infos = pgTable(
  "infos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("mesa_id").notNull().references(() => gameTables.id, { onDelete: "cascade" }),
    kind: infoKind("tipo").notNull(),
    name: text("nome").notNull(),
    description: text("descricao"),
    imageUrl: text("imagem_url"),
    createdBy: uuid("criado_por").notNull().references(() => profiles.id),
    hidden: boolean("oculta").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("infos_mesa_idx").on(t.tableId),
    pgPolicy("infos_ler_visiveis", {
      for: "select",
      to: "authenticated",
      using: sql`${isMember(t.tableId)} and (not ${t.hidden} or ${isMaster(t.tableId)})`,
    }),
  ],
).enableRLS();

/** Mapa da mesa (uma cena por mesa por enquanto). */
export const scenes = pgTable(
  "cenas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("mesa_id").notNull().references(() => gameTables.id, { onDelete: "cascade" }),
    name: text("nome").notNull().default("Mesa"),
    gridSize: integer("tamanho_grid").notNull().default(40),
    backgroundUrl: text("fundo_url"),
    /** Combate em andamento (rodada, vez e ordem de iniciativa); null = sem combate. */
    combat: jsonb("combate").$type<CombatState>(),
    createdAt: createdAt(),
  },
  (t) => [
    pgPolicy("cenas_ler_membro", { for: "select", to: "authenticated", using: isMember(t.tableId) }),
    pgPolicy("cenas_editar_mestre", { for: "update", to: "authenticated", using: isMaster(t.tableId) }),
  ],
).enableRLS();

/**
 * Personagem no mapa: a casa (`x`,`y`) onde ele está na cena. Um por personagem por cena. Nome e imagem vêm do
 * personagem. `REPLICA IDENTITY FULL` e a publicação `supabase_realtime` vêm de SQL na migration.
 */
export const tokens = pgTable(
  "tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sceneId: uuid("cena_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
    characterId: uuid("personagem_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
  },
  (t) => [
    unique("tokens_cena_personagem").on(t.sceneId, t.characterId),
    pgPolicy("tokens_ler_membro", {
      for: "select",
      to: "authenticated",
      using: sql`exists (select 1 from cenas s join membros m on m.mesa_id = s.mesa_id where s.id = ${t.sceneId} and m.usuario_id = auth.uid())`,
    }),
  ],
).enableRLS();
