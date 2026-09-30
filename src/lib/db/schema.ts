import {
  boolean,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Espelha `auth.users` (gerenciado pela Supabase Auth) com os dados do
 * usuário que pertencem ao domínio da aplicação. Uma linha é criada aqui
 * quando o cadastro é concluído; o restante do modelo de dados (mesas,
 * personagens, etc.) depende de docs/modelo-de-dados.md e será
 * adicionado quando essas funcionalidades forem implementadas.
 *
 * O backend sempre acessa esta tabela com a conexão privilegiada do
 * Postgres (`DATABASE_URL`), que ignora RLS. As policies abaixo existem
 * como defesa em profundidade, caso a tabela venha a ser exposta também
 * via cliente Supabase (PostgREST) no futuro — hoje não é.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    pgPolicy("profiles_select_own", {
      for: "select",
      to: "authenticated",
      using: sql`auth.uid() = ${table.id}`,
    }),
    pgPolicy("profiles_update_own", {
      for: "update",
      to: "authenticated",
      using: sql`auth.uid() = ${table.id}`,
    }),
  ],
).enableRLS();

/**
 * Mesa de jogo. O papel de cada participante não é armazenado: quem criou a
 * mesa (`ownerId`) é o Mestre e os demais membros são Jogadores (CLAUDE.md
 * §17), então não há como o papel divergir do dono.
 */
export const gameTables = pgTable(
  "game_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id),
    inviteCode: text("invite_code").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    pgPolicy("game_tables_select_member", {
      for: "select",
      to: "authenticated",
      using: sql`exists (select 1 from game_table_members m where m.table_id = ${table.id} and m.user_id = auth.uid())`,
    }),
  ],
).enableRLS();

/** Participantes da mesa. O criador também entra aqui como membro. */
export const gameTableMembers = pgTable(
  "game_table_members",
  {
    tableId: uuid("table_id")
      .notNull()
      .references(() => gameTables.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // "Limpar chat" pessoal: mensagens anteriores a este instante não são
    // mostradas a este participante. Nada é apagado para os demais.
    chatClearedAt: timestamp("chat_cleared_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.tableId, table.userId] }),
    index("game_table_members_user_idx").on(table.userId),
    pgPolicy("game_table_members_select_own", {
      for: "select",
      to: "authenticated",
      using: sql`auth.uid() = ${table.userId}`,
    }),
  ],
).enableRLS();

/**
 * Mensagens do chat da mesa. `authorName` é gravado junto (cópia do nome no
 * momento do envio) para o evento de Realtime já carregar tudo o que a tela
 * precisa, sem join, e para o histórico continuar legível se o autor sair.
 * `REPLICA IDENTITY FULL` e a publicação `supabase_realtime` vão por SQL
 * bruto na migration.
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => gameTables.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id),
    authorName: text("author_name").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_messages_table_created_idx").on(table.tableId, table.createdAt),
    pgPolicy("chat_messages_select_member", {
      for: "select",
      to: "authenticated",
      using: sql`exists (select 1 from game_table_members m where m.table_id = ${table.tableId} and m.user_id = auth.uid())`,
    }),
  ],
).enableRLS();

export const infoKind = pgEnum("info_kind", ["image", "note"]);

/**
 * Aba Infos: imagens (só o Mestre cria; nome + imagem) e notas (qualquer
 * participante cria; nome + descrição). Quem pode editar/excluir depende de
 * quem criou (src/lib/mesas/info-rules.ts). O que o Mestre cria nasce
 * `hidden` (só ele vê) até ele mostrar; a policy de leitura garante isso mesmo
 * que alguém consulte o Supabase direto, sem passar pelo backend.
 */
export const infos = pgTable(
  "infos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => gameTables.id, { onDelete: "cascade" }),
    kind: infoKind("kind").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("infos_table_idx").on(table.tableId),
    pgPolicy("infos_select_visible", {
      for: "select",
      to: "authenticated",
      using: sql`exists (select 1 from game_table_members m where m.table_id = ${table.tableId} and m.user_id = auth.uid())
        and (not ${table.hidden} or exists (select 1 from game_tables g where g.id = ${table.tableId} and g.owner_id = auth.uid()))`,
    }),
  ],
).enableRLS();

/**
 * Área de jogo da mesa (mapa). Uma mesa tem uma cena por enquanto — o
 * modelo já suporta várias (CLAUDE.md §10 prepara para o futuro), mas nada
 * na interface cria uma segunda ainda, então não há por que construir essa
 * troca agora.
 */
export const scenes = pgTable(
  "scenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => gameTables.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Mesa"),
    gridSize: integer("grid_size").notNull().default(40),
    backgroundUrl: text("background_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    pgPolicy("scenes_select_member", {
      for: "select",
      to: "authenticated",
      using: sql`exists (select 1 from game_table_members m where m.table_id = ${table.tableId} and m.user_id = auth.uid())`,
    }),
    pgPolicy("scenes_update_master", {
      for: "update",
      to: "authenticated",
      using: sql`exists (select 1 from game_tables g where g.id = ${table.tableId} and g.owner_id = auth.uid())`,
    }),
  ],
).enableRLS();

/**
 * Marcador no grid. Ainda não é ligado a personagem/criatura (isso depende
 * do catálogo do manual, docs/modelo-de-dados.md fases B/C) — por ora é só
 * nome, cor e posição, controlado pelo Mestre. `x`/`y` são a casa do token
 * (0 = primeira) num mapa de tamanho fixo (src/lib/mesas/map.ts); o token
 * acompanha o tamanho do quadrado.
 *
 * `REPLICA IDENTITY FULL` e a publicação em `supabase_realtime` são
 * adicionadas por SQL bruto na migration (Drizzle não tem essa API): sem
 * isso, o evento de DELETE do Supabase Realtime não carrega `scene_id`, e o
 * filtro por cena do cliente não teria como saber qual token sumiu.
 */
export const tokens = pgTable(
  "tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    color: text("color").notNull().default("#6366f1"),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    pgPolicy("tokens_select_member", {
      for: "select",
      to: "authenticated",
      using: sql`exists (
        select 1 from scenes s
        join game_table_members m on m.table_id = s.table_id
        where s.id = ${table.sceneId} and m.user_id = auth.uid()
      )`,
    }),
  ],
).enableRLS();
