-- Banco em português (pedido do usuário, 2026-10-05). Renomeia no lugar, sem perder dados.
-- Notas da ficha vão para personagens.notas; o catálogo genérico vira uma tabela por tipo (recarregar com npm run db:seed).
DROP POLICY "profiles_select_own" ON "profiles";--> statement-breakpoint
DROP POLICY "profiles_update_own" ON "profiles";--> statement-breakpoint
DROP POLICY "game_tables_select_member" ON "game_tables";--> statement-breakpoint
DROP POLICY "game_table_members_select_own" ON "game_table_members";--> statement-breakpoint
DROP POLICY "chat_messages_select_member" ON "chat_messages";--> statement-breakpoint
DROP POLICY "characters_select_owner_or_master" ON "characters";--> statement-breakpoint
DROP POLICY "infos_select_visible" ON "infos";--> statement-breakpoint
DROP POLICY "scenes_select_member" ON "scenes";--> statement-breakpoint
DROP POLICY "scenes_update_master" ON "scenes";--> statement-breakpoint
DROP POLICY "tokens_select_member" ON "tokens";--> statement-breakpoint
ALTER TABLE "profiles" RENAME TO "perfis";--> statement-breakpoint
ALTER TABLE "perfis" RENAME COLUMN "display_name" TO "nome";--> statement-breakpoint
ALTER TABLE "perfis" RENAME COLUMN "created_at" TO "criado_em";--> statement-breakpoint
ALTER TABLE "game_tables" RENAME TO "mesas";--> statement-breakpoint
ALTER TABLE "mesas" RENAME COLUMN "name" TO "nome";--> statement-breakpoint
ALTER TABLE "mesas" RENAME COLUMN "description" TO "descricao";--> statement-breakpoint
ALTER TABLE "mesas" RENAME COLUMN "owner_id" TO "dono_id";--> statement-breakpoint
ALTER TABLE "mesas" RENAME COLUMN "invite_code" TO "codigo_convite";--> statement-breakpoint
ALTER TABLE "mesas" RENAME COLUMN "created_at" TO "criado_em";--> statement-breakpoint
ALTER TABLE "mesas" RENAME CONSTRAINT "game_tables_owner_id_profiles_id_fk" TO "mesas_dono_id_perfis_id_fk";--> statement-breakpoint
ALTER TABLE "mesas" RENAME CONSTRAINT "game_tables_invite_code_unique" TO "mesas_codigo_convite_unique";--> statement-breakpoint
ALTER TABLE "game_table_members" RENAME TO "membros";--> statement-breakpoint
ALTER TABLE "membros" RENAME COLUMN "table_id" TO "mesa_id";--> statement-breakpoint
ALTER TABLE "membros" RENAME COLUMN "user_id" TO "usuario_id";--> statement-breakpoint
ALTER TABLE "membros" RENAME COLUMN "joined_at" TO "entrou_em";--> statement-breakpoint
ALTER TABLE "membros" RENAME COLUMN "chat_cleared_at" TO "chat_limpo_em";--> statement-breakpoint
ALTER TABLE "membros" RENAME CONSTRAINT "game_table_members_table_id_game_tables_id_fk" TO "membros_mesa_id_mesas_id_fk";--> statement-breakpoint
ALTER TABLE "membros" RENAME CONSTRAINT "game_table_members_user_id_profiles_id_fk" TO "membros_usuario_id_perfis_id_fk";--> statement-breakpoint
ALTER TABLE "membros" RENAME CONSTRAINT "game_table_members_table_id_user_id_pk" TO "membros_mesa_id_usuario_id_pk";--> statement-breakpoint
ALTER INDEX "game_table_members_user_idx" RENAME TO "membros_usuario_idx";--> statement-breakpoint
ALTER TABLE "chat_messages" RENAME TO "mensagens";--> statement-breakpoint
ALTER TABLE "mensagens" RENAME COLUMN "table_id" TO "mesa_id";--> statement-breakpoint
ALTER TABLE "mensagens" RENAME COLUMN "author_id" TO "autor_id";--> statement-breakpoint
ALTER TABLE "mensagens" RENAME COLUMN "author_name" TO "autor_nome";--> statement-breakpoint
ALTER TABLE "mensagens" RENAME COLUMN "content" TO "texto";--> statement-breakpoint
ALTER TABLE "mensagens" RENAME COLUMN "created_at" TO "criado_em";--> statement-breakpoint
ALTER TABLE "mensagens" RENAME CONSTRAINT "chat_messages_table_id_game_tables_id_fk" TO "mensagens_mesa_id_mesas_id_fk";--> statement-breakpoint
ALTER TABLE "mensagens" RENAME CONSTRAINT "chat_messages_author_id_profiles_id_fk" TO "mensagens_autor_id_perfis_id_fk";--> statement-breakpoint
ALTER INDEX "chat_messages_table_created_idx" RENAME TO "mensagens_mesa_criado_idx";--> statement-breakpoint
ALTER TABLE "characters" RENAME TO "personagens";--> statement-breakpoint
ALTER TABLE "personagens" RENAME COLUMN "table_id" TO "mesa_id";--> statement-breakpoint
ALTER TABLE "personagens" RENAME COLUMN "owner_id" TO "dono_id";--> statement-breakpoint
ALTER TABLE "personagens" RENAME COLUMN "name" TO "nome";--> statement-breakpoint
ALTER TABLE "personagens" RENAME COLUMN "choices" TO "escolhas";--> statement-breakpoint
ALTER TABLE "personagens" RENAME COLUMN "details" TO "detalhes";--> statement-breakpoint
ALTER TABLE "personagens" RENAME COLUMN "image_url" TO "imagem_url";--> statement-breakpoint
ALTER TABLE "personagens" RENAME COLUMN "state" TO "estado";--> statement-breakpoint
ALTER TABLE "personagens" RENAME COLUMN "created_at" TO "criado_em";--> statement-breakpoint
ALTER TABLE "personagens" RENAME COLUMN "updated_at" TO "atualizado_em";--> statement-breakpoint
ALTER TABLE "personagens" RENAME CONSTRAINT "characters_table_id_game_tables_id_fk" TO "personagens_mesa_id_mesas_id_fk";--> statement-breakpoint
ALTER TABLE "personagens" RENAME CONSTRAINT "characters_owner_id_profiles_id_fk" TO "personagens_dono_id_perfis_id_fk";--> statement-breakpoint
ALTER INDEX "characters_table_idx" RENAME TO "personagens_mesa_idx";--> statement-breakpoint
ALTER TABLE "personagens" ADD COLUMN "notas" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "personagens" p SET "notas" = n.lista FROM (SELECT character_id, jsonb_agg(jsonb_build_object('id', id, 'title', title, 'content', content) ORDER BY created_at) AS lista FROM character_notes GROUP BY character_id) n WHERE n.character_id = p.id;--> statement-breakpoint
DROP TABLE "character_notes";--> statement-breakpoint
ALTER TYPE "info_kind" RENAME TO "tipo_info";--> statement-breakpoint
ALTER TABLE "infos" RENAME COLUMN "table_id" TO "mesa_id";--> statement-breakpoint
ALTER TABLE "infos" RENAME COLUMN "kind" TO "tipo";--> statement-breakpoint
ALTER TABLE "infos" RENAME COLUMN "name" TO "nome";--> statement-breakpoint
ALTER TABLE "infos" RENAME COLUMN "description" TO "descricao";--> statement-breakpoint
ALTER TABLE "infos" RENAME COLUMN "image_url" TO "imagem_url";--> statement-breakpoint
ALTER TABLE "infos" RENAME COLUMN "created_by" TO "criado_por";--> statement-breakpoint
ALTER TABLE "infos" RENAME COLUMN "hidden" TO "oculta";--> statement-breakpoint
ALTER TABLE "infos" RENAME COLUMN "created_at" TO "criado_em";--> statement-breakpoint
ALTER TABLE "infos" RENAME CONSTRAINT "infos_table_id_game_tables_id_fk" TO "infos_mesa_id_mesas_id_fk";--> statement-breakpoint
ALTER TABLE "infos" RENAME CONSTRAINT "infos_created_by_profiles_id_fk" TO "infos_criado_por_perfis_id_fk";--> statement-breakpoint
ALTER INDEX "infos_table_idx" RENAME TO "infos_mesa_idx";--> statement-breakpoint
ALTER TABLE "scenes" RENAME TO "cenas";--> statement-breakpoint
ALTER TABLE "cenas" RENAME COLUMN "table_id" TO "mesa_id";--> statement-breakpoint
ALTER TABLE "cenas" RENAME COLUMN "name" TO "nome";--> statement-breakpoint
ALTER TABLE "cenas" RENAME COLUMN "grid_size" TO "tamanho_grid";--> statement-breakpoint
ALTER TABLE "cenas" RENAME COLUMN "background_url" TO "fundo_url";--> statement-breakpoint
ALTER TABLE "cenas" RENAME COLUMN "created_at" TO "criado_em";--> statement-breakpoint
ALTER TABLE "cenas" RENAME CONSTRAINT "scenes_table_id_game_tables_id_fk" TO "cenas_mesa_id_mesas_id_fk";--> statement-breakpoint
ALTER TABLE "tokens" RENAME COLUMN "scene_id" TO "cena_id";--> statement-breakpoint
ALTER TABLE "tokens" RENAME COLUMN "label" TO "rotulo";--> statement-breakpoint
ALTER TABLE "tokens" RENAME COLUMN "color" TO "cor";--> statement-breakpoint
ALTER TABLE "tokens" RENAME COLUMN "created_by" TO "criado_por";--> statement-breakpoint
ALTER TABLE "tokens" RENAME COLUMN "created_at" TO "criado_em";--> statement-breakpoint
ALTER TABLE "tokens" RENAME CONSTRAINT "tokens_scene_id_scenes_id_fk" TO "tokens_cena_id_cenas_id_fk";--> statement-breakpoint
ALTER TABLE "tokens" RENAME CONSTRAINT "tokens_created_by_profiles_id_fk" TO "tokens_criado_por_perfis_id_fk";--> statement-breakpoint
CREATE POLICY "personagens_ler_dono_ou_mestre" ON "personagens" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("personagens"."dono_id" = auth.uid() or exists (select 1 from mesas g where g.id = "personagens"."mesa_id" and g.dono_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "mensagens_ler_membro" ON "mensagens" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from membros m where m.mesa_id = "mensagens"."mesa_id" and m.usuario_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "membros_ler_proprio" ON "membros" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth.uid() = "membros"."usuario_id");--> statement-breakpoint
CREATE POLICY "mesas_ler_membro" ON "mesas" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from membros m where m.mesa_id = "mesas"."id" and m.usuario_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "infos_ler_visiveis" ON "infos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from membros m where m.mesa_id = "infos"."mesa_id" and m.usuario_id = auth.uid()) and (not "infos"."oculta" or exists (select 1 from mesas g where g.id = "infos"."mesa_id" and g.dono_id = auth.uid())));--> statement-breakpoint
CREATE POLICY "perfis_ler_proprio" ON "perfis" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth.uid() = "perfis"."id");--> statement-breakpoint
CREATE POLICY "perfis_editar_proprio" ON "perfis" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (auth.uid() = "perfis"."id");--> statement-breakpoint
CREATE POLICY "cenas_ler_membro" ON "cenas" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from membros m where m.mesa_id = "cenas"."mesa_id" and m.usuario_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "cenas_editar_mestre" ON "cenas" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from mesas g where g.id = "cenas"."mesa_id" and g.dono_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "tokens_ler_membro" ON "tokens" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from cenas s join membros m on m.mesa_id = s.mesa_id where s.id = "tokens"."cena_id" and m.usuario_id = auth.uid()));--> statement-breakpoint
DROP TABLE "catalog_entries";--> statement-breakpoint
DROP TYPE "catalog_kind";--> statement-breakpoint
CREATE TABLE "habilidades" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"pre_requisitos" text,
	"texto" text NOT NULL,
	"repetivel" boolean NOT NULL,
	"pagina" integer
);--> statement-breakpoint
ALTER TABLE "habilidades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acoes" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"custo" text NOT NULL,
	"nota" text,
	"sem_custo_com" jsonb NOT NULL,
	"custo_alternativo" jsonb,
	"pagina" integer NOT NULL
);--> statement-breakpoint
ALTER TABLE "acoes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "arquetipos" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"pagina" integer NOT NULL,
	"regras" text[] NOT NULL,
	"beneficios" jsonb NOT NULL
);--> statement-breakpoint
ALTER TABLE "arquetipos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "carreiras" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"pagina" integer NOT NULL,
	"pre_requisitos" jsonb NOT NULL,
	"apenas_inicial" boolean NOT NULL,
	"focalizador" boolean NOT NULL,
	"especial" text,
	"inicial" jsonb NOT NULL,
	"progressao" jsonb NOT NULL,
	"notas" text[] NOT NULL,
	"concede_beneficios" text[],
	"segunda_carreira_uma_de" text[],
	"rotulo_variante" text,
	"variantes" jsonb
);--> statement-breakpoint
ALTER TABLE "carreiras" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conexoes" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL
);--> statement-breakpoint
ALTER TABLE "conexoes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "equipamentos" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"categoria" text NOT NULL,
	"preco" integer NOT NULL,
	"preco_minimo" boolean DEFAULT false NOT NULL,
	"acrescimo" boolean DEFAULT false NOT NULL,
	"tipo_armadura" text
);--> statement-breakpoint
ALTER TABLE "equipamentos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "progressao" (
	"id" text PRIMARY KEY NOT NULL,
	"fonte" text NOT NULL,
	"nivel_max_pericia" jsonb NOT NULL,
	"pontos_atributo_criacao" integer NOT NULL,
	"pontos_facanha_criacao" integer NOT NULL,
	"tabela" jsonb NOT NULL,
	"concessoes" jsonb NOT NULL
);--> statement-breakpoint
ALTER TABLE "progressao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "racas" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"pagina" integer NOT NULL,
	"atributos" jsonb NOT NULL,
	"arquetipos" text[] NOT NULL,
	"idiomas" text NOT NULL,
	"caracteristicas" text NOT NULL,
	"concede" jsonb NOT NULL,
	"restricoes" jsonb NOT NULL,
	"altura_peso" text
);--> statement-breakpoint
ALTER TABLE "racas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pericias" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"categoria" text NOT NULL,
	"atributo" text NOT NULL,
	"atributo_texto" text NOT NULL,
	"varias_vezes" boolean NOT NULL,
	"sem_treino" boolean NOT NULL,
	"pagina" integer,
	"texto" text NOT NULL
);--> statement-breakpoint
ALTER TABLE "pericias" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listas_de_magias" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"magias" text[] NOT NULL
);--> statement-breakpoint
ALTER TABLE "listas_de_magias" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "magias" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"pagina" integer,
	"custo" integer NOT NULL,
	"custo_variavel" boolean NOT NULL,
	"alcance" text NOT NULL,
	"area" text NOT NULL,
	"pod" jsonb,
	"manutencao" boolean NOT NULL,
	"ofensiva" boolean,
	"ofensiva_texto" text NOT NULL,
	"texto" text NOT NULL
);--> statement-breakpoint
ALTER TABLE "magias" ENABLE ROW LEVEL SECURITY;
