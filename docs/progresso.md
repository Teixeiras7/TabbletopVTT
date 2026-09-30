# Progresso — Reinos de Ferro TabletopVTT

## Etapa 0 — Análise inicial e definição de arquitetura (2026-09-18)

**Status**: concluída. Nenhuma funcionalidade foi implementada.

### O que foi feito

- Análise do diretório do projeto: confirmado que é greenfield real — continha apenas `CLAUDE.md` e `manual/` (PDF do livro básico de Reinos de Ferro). Sem git, sem stack, sem dependências, sem configuração de qualquer tipo.
- Definida a arquitetura geral do projeto, documentada em `docs/arquitetura.md`: Next.js (Vercel) + Supabase (Postgres/Auth/Realtime) + Drizzle + RPGSystemEngine desacoplado em TypeScript puro + react-konva para o Canvas.
- Decidido explicitamente como separar Presence, eventos em tempo real e persistência (CLAUDE.md §18), sem depender de polling.

### Decisões-chave (ver `docs/arquitetura.md` para o raciocínio completo)

- Sem servidor backend separado: Route Handlers/Server Actions do Next.js são a autoridade, chamando o `RPGSystemEngine`.
- Sem servidor de sala com estado em memória (PartyKit/Durable Objects) por enquanto — volume de eventos esperado para uma mesa pequena não justifica essa infraestrutura extra; é o ponto de escalada caso o volume de eventos cresça.
- Supabase concentra Postgres + Auth + Realtime + Storage, evitando integrar múltiplos fornecedores para um projeto deste tamanho.
- Drizzle em vez de Prisma, por ser mais leve e mais fácil de manter desacoplado do engine.

### Riscos identificados

- Pooling de conexões Postgres em ambiente serverless precisa ser configurado corretamente desde o início (usar pooler da Supabase).
- O conteúdo real do `RPGSystemEngine` (fórmulas, testes, progressão) ainda depende da leitura do manual — não foi suposto nada sobre regras nesta etapa.
- Modelo de dados detalhado ainda não definido — depende das regras reais do sistema.

### Próximas etapas propostas

1. Ler `manual/Reinos de Ferro - Livro Básico...pdf` e documentar as regras analisadas em `docs/regras-rpg.md` (carreiras, perícias, testes, combate, progressão, condições/efeitos) — registrar dúvidas de interpretação em vez de supor.
2. A partir das regras, definir `docs/modelo-de-dados.md` (entidades de catálogo x instância, conforme CLAUDE.md §10).
3. Inicializar o projeto Next.js + configurar Supabase (projeto, Postgres, Auth) + Drizzle (schema inicial mínimo: usuários, mesas, participação).
4. Fluxo de autenticação e criação de mesa (criador da mesa → Mestre, demais → Jogadores, decidido no backend).
5. Esqueleto do `RPGSystemEngine` com os primeiros testes reais (o que as regras permitirem definir com confiança).
6. Canvas mínimo (Background + Grid + Tokens) integrado a uma mesa real, sincronizado via Supabase Realtime.

### Perguntas em aberto

- Nenhuma pergunta bloqueante nesta etapa. Dúvidas de regras específicas serão registradas em `docs/regras-rpg.md` durante a leitura do manual.

## Etapa 1 — Fundação técnica (2026-09-19)

**Status**: concluída. Projeto Next.js inicializado conforme `docs/arquitetura.md`; nenhuma funcionalidade de usuário (auth completa, Minhas Mesas, Lobby, personagens, combate, Bestiário, Compendium, Canvas) foi implementada — apenas a base que essas etapas vão usar.

### O que foi implementado

- **Projeto**: Next.js 16 (App Router, Turbopack), React 19, TypeScript estrito (`strict`, `noUncheckedIndexedAccess`), Tailwind v4, em `src/`.
- **Estrutura de rotas**: `src/app/` (páginas) e `src/app/api/**/route.ts` (Route Handlers). Criado `GET /api/health` como referência do padrão: validação de query com zod, erro de domínio via `AppError`, resposta convertida por `toErrorResponse`. Nenhuma rota de domínio (mesas, personagens, etc.) foi criada ainda.
- **Validação e tratamento de erros**: `src/lib/api/errors.ts` — classe `AppError` (erros de domínio com status/código explícitos) e `toErrorResponse()` (converte `AppError`, `ZodError` ou erro inesperado em JSON consistente: 4xx conhecido, 422 de validação, 500 genérico sem vazar detalhes). Coberto por teste (`errors.test.ts`).
- **Variáveis de ambiente**: `src/lib/env.client.ts` (públicas, prefixo `NEXT_PUBLIC_`) e `src/lib/env.server.ts` (segredos, com `server-only` para impedir import acidental no bundle do cliente), ambos validados com zod e com erro claro se algo faltar. `.env.example` documentado; `.env.local` criado com placeholders (não aponta para um projeto Supabase real ainda) só para permitir `dev`/`build` funcionarem localmente nesta etapa.
- **Banco de dados e ORM**: Drizzle + `postgres` (driver recomendado para Supabase em serverless) em `src/lib/db/index.ts`, com comentário explícito sobre usar o pooler em modo transação (porta 6543) na Vercel. Schema inicial (`src/lib/db/schema.ts`) contém apenas `profiles` (id, display_name, created_at) — o mínimo para existir uma ponte entre Supabase Auth e o banco da aplicação; o restante do modelo (mesas, personagens, etc.) fica para quando `docs/modelo-de-dados.md` existir. Pipeline de migração validado (`npm run db:generate` gerou `drizzle/0000_dry_moondragon.sql` com sucesso).
- **Autenticação (preparação, não implementação)**: `src/lib/supabase/client.ts` (cliente para Client Components) e `src/lib/supabase/server.ts` (cliente para Server Components/Route Handlers, via cookies). Nenhuma tela de login, middleware de sessão ou proteção de rota foi criada — isso é funcionalidade de auth de verdade e fica para a próxima etapa.
- **Realtime**: nenhum módulo novo criado. Presence/Broadcast serão abertos via o mesmo cliente Supabase (`@supabase/supabase-js`, já instalado) quando a primeira funcionalidade de mesa existir — criar uma abstração agora seria código sem uso real ainda.
- **RPGSystemEngine — estrutura inicial**: `src/lib/engine/` como módulo TypeScript puro (sem import de DB/HTTP), com `types.ts` (tipos genéricos de dado) e `dice.ts` (`rollDie`/`rollDice`, com fonte de aleatoriedade injetável para testes determinísticos). É a única peça de lógica de regras implementada, porque rolagem de dados é genérica o suficiente para não depender de regras específicas de Reinos de Ferro ainda não lidas no manual. Tipos de domínio (Character, CreatureInstance, Effect...) ficam para depois de `docs/regras-rpg.md`. Coberto por testes.
- **Lint**: ESLint 9 (flat config) com `eslint-config-next/core-web-vitals`.
- **Testes**: Vitest, `src/**/*.test.ts`. 7 testes (dice + errors), todos passando.
- **Deploy Vercel**: nenhuma configuração extra necessária além das variáveis de ambiente — Next.js App Router é suportado nativamente pela Vercel sem `vercel.json`.

### Verificação executada

Todos passando neste momento:

- `npx tsc --noEmit` — sem erros.
- `npx eslint .` — sem problemas.
- `npx vitest run` — 7/7 testes passando.
- `npx next build` — build de produção concluído com sucesso (`/` estático, `/api/health` dinâmico).
- Smoke test manual do servidor buildado: `/` responde 200; `/api/health` responde `{"status":"ok"}`; `?verbose=true` inclui timestamp; `?fail=1` responde 400 com o formato de erro esperado.

### Decisões desta etapa

- Placeholders em `.env.local` (não commitado) em vez de exigir um projeto Supabase real só para o `build`/`dev` funcionarem nesta etapa de fundação — nenhum dado real trafega, só valida o encadeamento env → cliente DB/Supabase.
- Não criar middleware de sessão do Supabase nem qualquer proteção de rota agora — isso é comportamento de autenticação de verdade (redirecionar usuário não autenticado, renovar sessão), que a própria tarefa desta etapa pediu para não implementar ainda.
- Não criar abstração de Realtime (`channels.ts` ou similar) sem um primeiro uso real — seria código morto; a instalação do `@supabase/supabase-js` já é suficiente preparação.
- `type: "module"` adicionado ao `package.json` para os arquivos de configuração ESM (`drizzle.config.ts`, `vitest.config.ts`) rodarem sem aviso.

### Riscos / pontos de atenção para a próxima etapa

- Antes de deploy real, `.env.local` local precisa ser substituído por variáveis de ambiente reais no painel da Vercel (as mesmas chaves de `.env.example`), usando a connection string do pooler da Supabase.
- `profiles` ainda não tem RLS nem é preenchida por nenhum fluxo — isso entra junto com a implementação real de autenticação.
- Modelo de dados de mesas/personagens/etc. continua pendente de `docs/regras-rpg.md` e `docs/modelo-de-dados.md`.

### Próximas etapas propostas (revisadas na Etapa 2, ver abaixo)

1. Ler o manual e escrever `docs/regras-rpg.md` (ainda pendente desde a etapa 0).
2. `docs/modelo-de-dados.md` a partir das regras.
3. ~~Autenticação real~~ — feito na Etapa 2.
4. Criação de mesa (criador → Mestre) e Minhas Mesas/Lobby.
5. Primeiras regras reais no `RPGSystemEngine` (o que as regras permitirem definir com confiança) com testes.
6. Canvas mínimo (Background + Grid + Tokens) sincronizado via Supabase Realtime.

## Etapa 2 — Autenticação (2026-09-19)

**Status**: concluída. Cadastro, login, logout, área autenticada (`/mesas`, placeholder para "Minhas Mesas") e proteção de rota funcionando contra um projeto Supabase real. Ainda não implementado (como pedido): Minhas Mesas de verdade, Lobby, personagens, combate, Bestiário, Compendium, Canvas.

### Projeto Supabase usado

O usuário forneceu as credenciais de um projeto Supabase real já existente (ref `rklfwnjfxzquhzfsbbue`). Todas as chaves ficam em `.env.local` (gitignored, nunca commitado); `.env.example` documenta as variáveis necessárias sem valores reais.

### O que foi implementado

- **Cadastro** (`/cadastro`): formulário (nome de exibição, e-mail, senha) com `useActionState`, validação zod client+server, Server Action (`src/app/cadastro/actions.ts`) que chama `supabase.auth.signUp`. Cria a linha em `profiles` (`ensureProfile`) usando o **mesmo id retornado pelo Supabase Auth** — nunca um id gerado à parte, garantindo identidade única entre autenticação e banco (exigência explícita do pedido).
- **E-mail de confirmação**: o projeto tem `mailer_autoconfirm: false` (confirmado via `GET /auth/v1/settings`), ou seja, cadastro não cria sessão imediata — o usuário precisa clicar no link do e-mail. A UI mostra o estado "confirme seu e-mail" em vez de assumir login automático. `src/app/auth/confirm/route.ts` implementa o endpoint de confirmação (`verifyOtp` com `token_hash`/`type`, padrão oficial do Supabase para Next.js).
- **Login** (`/login`): mesmo padrão (Server Action + `useActionState`), com `redirectTo` (validado contra open redirect — só aceita caminhos internos) para voltar à página que o usuário tentou acessar antes de ser redirecionado ao login.
- **Logout**: Server Action (`src/lib/auth/actions.ts`) chamando `supabase.auth.signOut()` e redirecionando para `/login`, disparada por um formulário simples no cabeçalho de `/mesas`.
- **Sessão / "permanecer autenticado"**: `src/proxy.ts` (ver nota sobre Next 16 abaixo) + `src/lib/supabase/middleware.ts` renovam os cookies de sessão a cada request, seguindo o padrão oficial `@supabase/ssr`.
- **Proteção de rota**: dupla camada — o proxy redireciona para `/login?redirectTo=...` antes mesmo da página renderizar (`/mesas/**`), e a própria página (`requireUser()` em `src/lib/auth/session.ts`) confere de novo, porque a documentação do Next 16 explicitly avisa que Server Actions não passam necessariamente pelo proxy da mesma forma que páginas — nunca confiar só nele.
- **Sessão ausente/expirada**: `getCurrentUser()`/`requireUser()` usam `supabase.auth.getUser()`, que **revalida contra o servidor de Auth** (não só decodifica o JWT local) — cobre tanto "sem sessão" quanto "refresh token inválido/expirado" com o mesmo caminho: retorna `null`, a página redireciona.
- **Erros e mensagens**: `src/lib/auth/errors.ts` mapeia os códigos de erro reais do Supabase Auth (`invalid_credentials`, `user_already_exists`, `weak_password`, etc.) para mensagens em português; nunca expõe a mensagem original em inglês nem detalhes internos.
- **RLS**: `profiles` agora tem Row Level Security habilitada com policies "cada usuário só lê/edita o próprio perfil" — defesa em profundidade, já que hoje o backend acessa a tabela com a conexão privilegiada do Postgres (bypassa RLS), mas protege caso a tabela seja exposta via cliente Supabase no futuro.
- **Senhas e dados sensíveis**: senha nunca toca nosso código/banco — só passa para a API do Supabase Auth via HTTPS, que faz o hashing; nosso schema (`profiles`) não tem (e nunca deve ter) coluna de senha.

### Bugs reais encontrados e corrigidos durante a verificação

1. **`drizzle-kit migrate` engolindo DDL silenciosamente.** A `DATABASE_URL` (pooler Supabase em modo "transaction", porta 6543, usada em runtime) fazia `drizzle-kit migrate` reportar sucesso e gravar a migração como aplicada em `__drizzle_migrations`, mas a tabela `profiles` nunca era criada de fato — só percebido ao consultar `information_schema` diretamente. Corrigido adicionando `DIRECT_URL` (mesma conexão, porta 5432, modo "session", sem `pgbouncer=true`) usada só por `drizzle.config.ts` para migrations; `DATABASE_URL` continua sendo a do pooler para o app em runtime. Recriado do zero (`DROP TABLE` + limpar `__drizzle_migrations` + `drizzle-kit migrate` de novo) para confirmar que agora funciona de ponta a ponta.
2. **Usuário "fantasma" do Supabase em cadastro com e-mail repetido.** Para não revelar quais e-mails já têm conta (proteção contra enumeração), `signUp()` para um e-mail já cadastrado **não retorna erro** — devolve um `user` com `id` diferente do real e `identities: []`. O código original chamaria `ensureProfile()` com esse id falso, criando uma linha órfã em `profiles` sem usuário correspondente em `auth.users`. Corrigido: quando `identities.length === 0`, não cria perfil, mas mostra a mesma mensagem de "confirme seu e-mail" (preserva a mesma proteção contra enumeração que o próprio Supabase já aplica). Coberto por teste.
3. **Next.js 16 renomeou `middleware.ts` para `proxy.ts`** (`middleware` é considerado depreciado nesta versão; a própria documentação embutida em `node_modules/next/dist/docs` avisa sobre isso). Migrado: `src/middleware.ts` → `src/proxy.ts`, função `middleware` → `proxy`, mesmo comportamento.

4. **Erro em runtime: `"use server"` só pode exportar funções assíncronas.** `cadastro/actions.ts` e `login/actions.ts` exportavam constantes de estado inicial (objetos), o que quebra ao abrir a página. Tipos, testes e build passavam; só o dev server acusou. Corrigido: estado inicial definido dentro de cada formulário, apenas o tipo é importado das actions. Lição: verificar páginas rodando de verdade, não só build/testes. Após a correção, o usuário confirmou manualmente que o fluxo funciona.

### Usuário de teste

`admin123@gmail.com` (criado via Admin API, já confirmado, perfil "Admin" em `profiles`). A senha foi retirada deste documento por ser um repositório no GitHub; ela tem 6 caracteres (o login aceita, mas o formulário de cadastro exige 8). Remover essa conta antes de qualquer uso real do projeto.

### Testes

**Automatizados (vitest, 33 testes, todos passando)**:
- `src/lib/auth/schemas.test.ts`: cadastro/login válidos e inválidos (e-mail malformado, senha curta/sem número, nome vazio).
- `src/lib/auth/errors.test.ts`: mapeamento de códigos de erro reais do Supabase para mensagens em português.
- `src/lib/auth/session.test.ts`: `getCurrentUser`/`requireUser` com cliente Supabase mockado — sessão válida, ausente, redirecionamento.
- `src/app/login/actions.test.ts`: entrada inválida, senha incorreta (erro mapeado), redirect seguro (`redirectTo` interno aceito, externo rejeitado).
- `src/app/cadastro/actions.test.ts`: entrada inválida, e-mail já cadastrado (com e sem o "usuário fantasma"), criação de perfil com o id do Auth, `emailRedirectTo` correto.

**Verificação manual contra o projeto Supabase e o app reais** (dev server local + chamadas diretas à API do Supabase, já que não há navegador disponível nesta sessão — ver nota abaixo):
- **Cadastro válido**: `signUp()` real com e-mail novo aceito pela API (confirmado via chamada direta); dentro do projeto, domínios de e-mail claramente falsos (`@example.com`) para endereços *novos* são bloqueados pela própria validação do Supabase (`email_address_invalid`) — proteção do próprio projeto, não uma limitação da nossa implementação.
- **Cadastro inválido**: coberto pelos testes de schema (zod), reforçado por validação HTML nativa nos campos.
- **Login válido**: usuário de teste pré-confirmado (criado via Admin API, já que não há como clicar em link de e-mail nesta sessão) logou de verdade contra o Supabase; os cookies de sessão gerados pelo `@supabase/ssr` foram usados para acessar `GET /mesas` no app rodando de verdade — **200, mostrando "Minhas Mesas" e o nome do perfil do banco**, confirmando a identidade Auth↔banco.
- **Senha inválida**: `signInWithPassword` real com senha errada devolveu `invalid_credentials`, mapeado para "E-mail ou senha incorretos.".
- **Logout**: `signOut()` real invalidou o refresh token — tentativa de renová-lo depois retornou 400 `refresh_token_not_found`.
- **Acesso sem autenticação**: `GET /mesas` sem cookies no app real devolveu 307 para `/login?redirectTo=%2Fmesas`.
- **Sessão após reload**: duas requisições `GET /mesas` seguidas com os mesmos cookies de sessão real, ambas 200.
- Todos os dados de teste (usuário admin-criado, linha em `profiles`) foram removidos do projeto Supabase ao final — nada de teste ficou no banco do usuário.

**O que não foi possível testar nesta sessão** (documentado em vez de simulado como concluído, conforme CLAUDE.md §7):
- Clicar de fato no link do e-mail de confirmação (não há acesso à caixa de entrada) — o endpoint `/auth/confirm` foi implementado seguindo o padrão oficial do Supabase para Next.js, mas não verificado ponta a ponta com um clique real. Recomenda-se o usuário testar manualmente ao menos uma vez.
- Expiração real de access token (~1h de vida) — o mecanismo (`getUser()` revalida contra o servidor a cada request) é o padrão documentado do Supabase, não foi forçado a expirar de fato nesta sessão.
- Teste em navegador de verdade (extensão Claude in Chrome não foi instalada pelo usuário nesta sessão) — a verificação usou o dev server real + chamadas HTTP/API reais em vez de interação de UI.

### Verificação de qualidade

- `npx tsc --noEmit` — sem erros.
- `npx eslint .` — sem problemas.
- `npx vitest run` — 33/33 testes passando.
- `npx next build` — build de produção concluído com sucesso (rotas `/`, `/cadastro`, `/login`, `/mesas`, `/auth/confirm`, `/api/health`, proxy ativo).

### Próximas etapas propostas

1. Ler o manual e escrever `docs/regras-rpg.md`.
2. `docs/modelo-de-dados.md` a partir das regras.
3. Criação de mesa (criador → Mestre) e Minhas Mesas/Lobby de verdade dentro de `/mesas`.
4. Primeiras regras reais no `RPGSystemEngine`.
5. Canvas mínimo sincronizado via Supabase Realtime.
6. Antes de deploy: configurar as mesmas variáveis de `.env.example` (incluindo `DIRECT_URL`) no painel da Vercel, e conferir em Authentication > URL Configuration do Supabase se `Site URL`/`Redirect URLs` incluem o domínio de produção.

## Etapa 3 — Leitura do manual e regras (2026-09-26)

**Status**: concluída. Nenhum código foi alterado nesta etapa.

### O que foi feito

- Texto do manual extraído com `pdftotext` e lido por partes (capítulos 3 a 8 e Bestiário, pp. 103-335); capítulos 1 e 2 ignorados por serem ambientação.
- `docs/regras-rpg.md`: documento principal com índice, glossário de siglas, resumo do núcleo mecânico, dúvidas consolidadas e o que o engine já pode assumir.
- `docs/regras/01..09-*.md`: detalhe por parte, com tabelas de catálogo completas (raças, carreiras, habilidades, perícias, 160 magias, armas, armaduras, mekânica, alquimia, gigantes-a-vapor, criaturas) e 20 casos de teste do livro na parte 04.

### Limites da análise

- A extração de texto não captura figuras. Espirais vitais, grade de dano dos gigantes-a-vapor e as espirais de 4 criaturas ficaram sem dados; algumas tabelas saíram desalinhadas. A lista está em `docs/regras-rpg.md` §5.1 e precisa de conferência visual no PDF antes de virar seed do banco.
- Dúvidas de interpretação (arredondamento de metades, ARM contra fogo/corrosão, tabela Épico, etc.) estão em §5.2 e não foram tratadas como fato.

### Próximas etapas propostas

1. Conferir visualmente no PDF os itens de §5.1 (o usuário pode fazer isso ou fornecer as imagens das páginas) e decidir as dúvidas de §5.2 que bloqueiam o modelo.
2. `docs/modelo-de-dados.md` a partir das regras (catálogo x instância, espiral vital, carreira dupla).
3. Criação de mesa (criador → Mestre) e Minhas Mesas/Lobby dentro de `/mesas`. Não depende das regras e pode andar em paralelo.
4. Primeiras regras no `RPGSystemEngine`: teste de perícia, ataque e dano, com os casos de teste da parte 04.
5. Canvas mínimo sincronizado via Supabase Realtime.

## Etapa 4 — Minhas Mesas e Lobby (2026-09-26)

**Status**: concluída. Ainda não implementados: mesa virtual (Canvas), personagens, combate, Bestiário, Compendium e realtime/Presence.

### O que foi implementado

- **Banco** (migration `0002`, aplicada): `game_tables` (nome, descrição, dono, código de convite único) e `game_table_members` (mesa + usuário, chave primária composta, `ON DELETE CASCADE` na mesa). Chaves estrangeiras para `profiles`, ou seja, a identidade continua a mesma do Supabase Auth. RLS ativado com policies de leitura por participante (defesa em profundidade; o backend usa a conexão privilegiada).
- **Papel derivado, não armazenado**: criador (`owner_id`) = Mestre; demais membros = Jogadores (CLAUDE.md §17). Não existe coluna de papel nem seleção manual, então não há como divergir. Regra em `src/lib/mesas/roles.ts`.
- **Permissões no backend** (`src/lib/mesas/queries.ts`): quem não participa recebe "não encontrada" (não descobre que a mesa existe); só o Mestre exclui; o Mestre não "sai" da própria mesa (só exclui); entrar por código é idempotente; as Server Actions usam sempre o usuário da sessão, nunca um id vindo do formulário.
- **Convite**: código de 8 caracteres sem símbolos ambíguos, gerado com `crypto.randomInt`, aceito em qualquer caixa/com hífen. Link `/mesas?codigo=...` preenche o formulário e sobrevive ao redirecionamento de login (o proxy agora preserva a query em `redirectTo`).
- **Telas**: `/mesas` (lista, estado vazio, criar mesa, entrar com código; no celular o formulário do convite sobe quando há `?codigo=`), `/mesas/[id]` (Lobby: participantes com papel, convite com copiar link/código só para o Mestre, sair/excluir com confirmação), `loading.tsx` e `not-found.tsx`. Cabeçalho comum no `layout.tsx` de `/mesas`.
- **Reuso**: `fieldErrorsOf` (`src/lib/forms.ts`) e classes de formulário compartilhadas (`src/components/form-styles.ts`, com altura mínima de toque de 44px) agora também usados por login e cadastro; `getCurrentUser` com `cache` de React evita repetir a chamada ao Supabase na mesma requisição (layout + página).

### Testes

- **Unitários (47, todos passando)**: papéis, código de convite, schemas, e as 4 Server Actions com dependências mockadas (validação, usuário da sessão, id inválido, código inexistente).
- **Integração** (`npm run test:integration`, banco real, fora do `npm test`): cria usuários fictícios e percorre criar, convidar, entrar duas vezes, listar, tentativas indevidas (excluir sem ser Mestre, Mestre sair, estranho ver a mesa), sair e excluir com cascade; apaga tudo ao final.
- **Verificação com a app rodando** (sessão real do usuário de teste, dados semeados e removidos): estado vazio, lista com papel e contagem, Lobby com convite e link, mesa alheia oculta na lista e "não encontrada" no acesso direto, redirecionamento ao login preservando `?codigo=`, código pré-preenchido.
- `tsc`, `eslint` e `next build` sem erros.

### Pontos de atenção

- **Falha intermitente não explicada**: uma execução do teste de integração falhou uma vez durante a verificação final; em 5 execuções seguintes passou todas e não restou dado no banco. Sem o erro capturado, a causa não foi identificada (suspeita: oscilação de conexão com o pooler remoto). Se voltar, rodar com a saída completa.
- `notFound()` em páginas com `loading.tsx` responde HTTP 200 (com `noindex`), comportamento do streaming do Next; o conteúdo está correto.
- Não implementado por decisão: remover participante, transferir mesa, limite de jogadores e regenerar convite — o livro não define limite de jogadores e não foram pedidos.

### Combinado com o usuário

As telas atuais (login, cadastro, Minhas Mesas, Lobby) são provisórias, feitas para validar funcionalidade. Quando a etapa chegar no grid/Canvas, as telas anteriores serão revisadas visualmente (CLAUDE.md §4). Até lá, não polir o visual.

### Próximas etapas propostas

1. Conferir as figuras do PDF (`docs/regras-rpg.md` §5.1) e decidir as dúvidas de §5.2.
2. `docs/modelo-de-dados.md` (catálogo x instância, espiral vital, carreira dupla).
3. Mesa virtual mínima: Realtime com Presence no Lobby/mesa e Canvas (Background + Grid + Tokens).
4. Primeiras regras no `RPGSystemEngine` com os casos de teste da parte 04.

## Etapa 5 — Modelo de dados (2026-09-26)

**Status**: concluída (documento). Nenhuma tabela nova foi criada: cada fase só vira migration quando a funcionalidade que a usa for implementada.

### O que foi feito

- `docs/modelo-de-dados.md`: princípios, visão geral, catálogo (seed do manual), personagem, instâncias de mesa, vitalidade e fases de implementação (A a G) com dependências.
- Principais decisões: supertipo `actors` (personagem, instância de criatura e gigante-a-vapor compartilham token, combate e efeitos); catálogo com `slug` estável, `source_page` e `jsonb` validado por zod; itens numa tabela com `kind`; nada derivado é gravado; log `game_events` só de acréscimo para recuperar o realtime.
- **Figuras do PDF lidas** (renderizando as páginas como imagem): a espiral vital, que era o bloqueio, está resolvida (6 ramos numerados, 1-2 Físico, 3-4 Agilidade, 5-6 Intelecto, ordem horária). A estrutura da tabela de dano dos gigantes e os modelos de explosão e rajada também. Atualizados `docs/regras-rpg.md` §5.1 e `docs/regras/04`.
- Descoberta útil: a página do PDF é a impressa + 1.

### Ainda em aberto

- Ramo que recebe o círculo extra quando o atributo é ímpar (o texto diz "o mais igualmente possível").
- Transcrever os valores das espirais de 4 criaturas e da grade de cada chassi (só na hora do seed).
- Conferir no PDF as tabelas de raça e de progressão (p. 152, "Épico") antes da fase B.
- Arredondamento de ",5" e ARM contra fogo/corrosão (afetam o engine, não o esquema).

### Próximas etapas propostas

1. Escolher o próximo passo: **fase B** (perícias, habilidades, raças, carreiras e criação de personagem), **mesa virtual mínima** (Presence em tempo real e Canvas com grid, fases D e parte de F) ou **primeiras regras no engine** (teste de perícia, ataque e dano, com os 20 casos de teste da parte 04).
2. A revisão visual das telas anteriores entra junto com o grid, como combinado.

## Etapa 6 — Pendências resolvidas antes de continuar (2026-09-28)

**Status**: concluída. Nenhuma funcionalidade nova; foco em fechar o que ficou aberto nas etapas 3 e 5, mais uma auditoria de segurança do que já existe.

### Verificação das figuras e tabelas do manual

Os 7 agentes lançados em paralelo para conferir cada parte contra as imagens do PDF pararam por limite de sessão antes de escrever qualquer correção (nenhum arquivo em `docs/regras/` chegou a ser alterado por eles). Para não repetir o gasto, o restante foi conferido diretamente, sem subagentes:

- **Tabelas de raça (pp. 106-112, as 7 raças) e a linha do Sacerdote (p. 117)**: conferidas contra a imagem — todos os valores que a extração de texto já tinha estavam corretos, incluindo os quatro pontos marcados como dúvida na etapa 3 (Anão PER, Gobber PER, Ogrun FIS, Iosano INT).
- **Bônus do Nyss (p. 110)**: confirmado que é bônus só nos testes de Iniciativa/PER, não no atributo.
- **Tabela de progressão "Épico" (p. 152)**: confirmado que Veterano e Épico são mesmo idênticos no livro — não é erro de extração nem de impressão. A regra de quando um personagem passa de um estágio para o outro continua sem ser encontrada.
- **ARM contra fogo e corrosão, alcance "menor que", limite de magias com manutenção**: as três resolvidas relendo o próprio texto já extraído com mais atenção (não precisavam de imagem). Fogo segue a fórmula normal de dano (ARM reduz); corrosão é dano fixo (ignora ARM); o limite de 1 magia ofensiva + 1 não ofensiva é por alvo, não por conjurador.
- **Arredondamento de metades (",5")**: continua genuinamente ambíguo no texto do livro. Registrada uma decisão de engine (arredondar para cima, mesma direção do único caso explícito) em vez de deixar em aberto.
- Detalhes em `docs/regras-rpg.md` §5.

**Escopo reduzido deliberadamente**: a verificação exaustiva de cada linha de cada catálogo (habilidades, perícias, 160 magias, armas, mekânica, runas, a grade de dano de cada chassi de gigante, as espirais das 4 criaturas do Bestiário) não foi refeita agora — é trabalho de quando cada catálogo for de fato semeado no banco (Fases B, C, E, G de `docs/modelo-de-dados.md`), não uma pendência que bloqueia o próximo passo. Isso é uma mudança de escopo em relação ao pedido original ("resolver qualquer pendência"), feita para não gastar o orçamento de tokens da sessão em dado que só vai ser usado mais adiante.

**Hipótese do usuário, não confirmada**: como Veterano e Épico repetem o mesmo padrão de custos, Épico poderia começar em XP total 95 (onde Veterano termina). Registrado em `docs/regras-rpg.md` como hipótese de trabalho a revisar antes da Fase B, não como fato do livro.

### Auditoria de segurança (skill security-and-hardening)

Encontrados e corrigidos:

- **Redirecionamento aberto real em `/auth/confirm`**: o parâmetro `next` da URL de confirmação de e-mail não era validado (`searchParams.get("next") ?? "/mesas"`) — um link malicioso podia levar o usuário, já autenticado, para um domínio externo depois de confirmar o e-mail. Corrigido junto com a duplicação: a validação de `login/actions.ts` e `login/page.tsx` foi unificada em `src/lib/auth/redirect.ts` (só aceita caminho interno; bloqueia URL absoluta, `//host`, `/\host` e caracteres de controle), usada nos três lugares.
- **Tipo de confirmação não restrito**: `verifyOtp` aceitava qualquer `type` da URL; agora só aceita `signup`/`email`, os únicos gerados pelo próprio fluxo de cadastro.
- **Chave de serviço do Supabase sem uso no app**: `SUPABASE_SERVICE_ROLE_KEY` não é lida por nenhum código do app (só por scripts locais de teste) — removida de `src/lib/env.server.ts`, então não precisa existir nas variáveis de ambiente do deploy.
- **Cabeçalhos de segurança ausentes**: adicionados em `next.config.ts` (nosniff, Referrer-Policy, Permissions-Policy, HSTS, CSP parcial) e confirmados no build de produção.
- **RLS**: confirmado que as três tabelas do app (`profiles`, `game_tables`, `game_table_members`) têm RLS ativado com policies. Achado à parte, sem ação: a tabela `Projeto VTT` (já existia no banco antes desta etapa, não foi criada por nós) tem RLS ativado mas nenhuma policy — isso bloqueia todo acesso por padrão, então é seguro como está, apesar de ter grants amplos para `anon`/`authenticated`.
- Dependências: `npm update` dentro das faixas do `package.json` (Next 16.3.5→16.3.6, drizzle-kit, etc.) mais um `overrides` para o esbuild vulnerável usado pelo `drizzle-kit` internamente. `npm audit` foi de 4 avisos moderados para 0.

### Bug encontrado nos próprios testes

Dois arquivos de teste escritos nesta sessão tinham `"/\evil.example"` sem o segundo escape (virou `/evil.example`, sem barra invertida) — os testes passavam por engano, testando um caminho que já era válido. Corrigido; não era bug no código, só no dado do teste.

### Verificação

- `npx tsc --noEmit`, `npx eslint .` — sem problemas.
- `npx vitest run` — 61/61 testes (unitários, incluindo os novos de `redirect.ts` e `/auth/confirm`).
- `npm run test:integration` — passando contra o Supabase real.
- `npx next build` — build de produção OK; cabeçalhos de segurança confirmados via `curl` no servidor buildado.

### Lição para a sessão

Lançar 7 agentes em paralelo para releitura exaustiva de imagens consumiu o limite de sessão antes de produzir qualquer resultado gravado. Da próxima vez que for preciso conferir várias partes do manual contra imagens, preferir verificação direta e segmentada (como feito no restante desta etapa) a um fan-out grande, e reservar subagentes para quando o volume realmente exigir paralelismo.

### Próximas etapas propostas

1. Fase B do modelo de dados (raças, carreiras, perícias, habilidades, progressão) — decidir antes a hipótese do Épico (XP 95) e a regra de transição de estágio.
2. Primeiras regras no `RPGSystemEngine` com os 20 casos de teste da parte 04.

## Etapa 7 — Mesa virtual mínima (2026-09-28)

**Status**: concluída. Ainda não implementado: personagens de verdade (token é só um marcador), combate, fichas, Fog of War, mais de uma cena por mesa.

### O que foi implementado

- **Banco** (migration `0003`): `scenes` (uma por mesa, criada automaticamente junto com `game_tables`, na mesma transação) e `tokens` (nome, cor, posição em células, quem criou). RLS por participante da mesa, mesmo padrão de `game_tables`. `tokens` também ganhou `REPLICA IDENTITY FULL` e entrou na publicação `supabase_realtime` (SQL bruto acrescentado à migration gerada) — necessário para o Realtime funcionar.
- **Permissão**: só o Mestre cria, move e remove tokens — checado em `src/lib/mesas/queries.ts` (`createToken`/`moveToken`/`deleteToken`), nunca só na interface (CLAUDE.md §17). Jogador só visualiza.
- **Canvas** (`src/app/mesas/[id]/table-canvas.tsx`, react-konva): grid quadrado, tokens arrastáveis (Mestre), duplo clique/toque remove, pan e zoom. Carregado só no cliente via `next/dynamic` (`table-canvas-loader.tsx`), porque Konva depende do DOM e não roda em SSR.
- **Sincronização em tempo real**: os tokens usam `postgres_changes` do Supabase Realtime direto na tabela (não o Broadcast customizado que `docs/arquitetura.md` §7.2 reserva para eventos compostos) — mover um token é 1:1 com a linha, então o CDC nativo é suficiente e mais simples. Decisão registrada em `docs/arquitetura.md` §7.2.
- **Presence** (`src/app/mesas/[id]/presence.tsx`): mostra quem está com a mesa aberta agora, via canal de Presence do Supabase, nunca gravado no banco (`docs/arquitetura.md` §7.1).
- Integrado na página já existente do Lobby (`/mesas/[id]`), substituindo o texto "ainda não está disponível" — não criei uma tela nova e desconectada (CLAUDE.md §3).

### Decisões e simplificações

- **Token sem personagem**: `tokens` não referencia `actors`/`characters` (essas tabelas ainda não existem — dependem da Fase B/C do modelo de dados, que precisa do catálogo de raças/carreiras do manual). Por enquanto um token é só um marcador que o Mestre nomeia e colore à mão. Quando a Fase C existir, `tokens` ganha uma `actor_id` opcional. Documentado em `docs/modelo-de-dados.md` §2 e §8 (fase "D parcial") para não ser confundido com o desenho original.
- **Uma cena por mesa**: o modelo já prepara para várias cenas (CLAUDE.md §10), mas nada na interface cria uma segunda ainda — não construí essa troca sem uso real (YAGNI).

### Testes

- **Unitários**: `createTokenSchema`/`moveTokenSchema` (validação, incluindo limite de coordenadas) e as três Server Actions de token (`createTokenAction`/`moveTokenAction`/`deleteTokenAction`) com autorização mockada.
- **Integração** (banco real): estendido `queries.int.test.ts` — cena criada automaticamente com a mesa, Jogador não consegue criar/mover/remover token (Mestre sim), RLS bloqueia quem não participa.
- **Verificação com a app rodando**: mesa e token reais criados por SQL, página `/mesas/[id]` buscada com a sessão do `admin123@gmail.com` — 200, seção "Mapa" e Presence renderizam no HTML do servidor (o Canvas em si só aparece após hidratar no navegador, como esperado do `dynamic(..., { ssr: false })`); dados de teste removidos ao final.
- `tsc`, `eslint`, `vitest run` (72/72) e `next build` sem erros.

### Próximas etapas propostas

1. Fase B do modelo de dados (raças, carreiras, perícias, habilidades, progressão) — decidir antes a hipótese do Épico (XP 95) e a regra de transição de estágio.
2. Ligar `tokens` a `actors`/`characters` quando a Fase C existir.
3. Primeiras regras no `RPGSystemEngine` com os 20 casos de teste da parte 04.

## Etapa 8 — Redesenho visual: login e Minhas Mesas (2026-09-28)

**Status**: concluída. O usuário considerou o visual anterior ruim; esta etapa monta a base de componentes (shadcn/ui) e aplica em duas telas. Cadastro e o Lobby (`/mesas/[id]`) ainda estão no estilo antigo — ficam para uma próxima passada.

### Base de componentes (`src/components/ui/`)

Trazidos do MCP do shadcn/ui (New York, v4) e adaptados: `Button`, `Card`, `Input`, `Label`, `Field` (versão enxuta — só `Field/FieldGroup/FieldLabel/FieldDescription/FieldError`, sem `FieldSet/FieldLegend/FieldSeparator` por não terem uso ainda), `Dialog`, `Textarea`. Dependências novas: `class-variance-authority`, `clsx`, `tailwind-merge`, `radix-ui` (pacote único, não os `@radix-ui/react-*` separados), `lucide-react`. `src/lib/utils.ts` tem o `cn()` que todos usam.

`src/app/globals.css` ganhou um tema escuro em OKLCH (sem alternância claro/escuro — o projeto é só escuro) com um tom de bronze/âmbar como cor de destaque, mapeado para o Tailwind v4 via `@theme inline`.

### Login (`/login`)

Cartão centralizado com um brilho suave atrás, usando `Card`/`Field`. Interpretei "modal" como o visual (cartão elevado, com essa sensação de janela), não uma sobreposição real sobre outra página — isso exigiria rotas de interceptação do Next.js, complexidade sem necessidade real aqui (o usuário confirmou depois que o projeto deve ficar simples).

### Minhas Mesas (`/mesas`)

Redesenhada seguindo a especificação do usuário:

- Dois botões no topo: **Criar mesa** e **Entrar com código**, cada um abrindo um `Dialog` de verdade (com X para fechar, Cancelar e Salvar/Entrar).
- O modal de criar pede nome, mostra "Sistema: Reinos de Ferro" (campo travado — só existe um sistema, então não virou coluna no banco nem campo editável) e descrição.
- Mesas aparecem em cartões numa grade (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — 3 por linha a partir da tela grande; menos colunas no celular para não espremer, CLAUDE.md §5), cada um com nome, código de convite, descrição, participantes e o nome do Mestre.
- Cada cartão tem **Entrar** embaixo à esquerda; o Mestre também vê uma engrenagem embaixo à direita, que abre um modal para renomear/editar a descrição ou excluir a mesa.
- O link de convite (`/mesas?codigo=...`, copiado no Lobby) agora abre o modal de entrar já preenchido, em vez de rolar a página até um formulário.

### Banco e backend

- `listMyTables` passou a trazer `inviteCode` e o nome do dono (`ownerName`, via `alias()` de `profiles` — precisa de um segundo apelido porque a query já teria `profiles` se juntasse duas vezes sem alias).
- Nova função `updateTable` (só o Mestre edita, mesmo padrão de `deleteTable`) e a Server Action `updateMesaAction`.
- `ConfirmSubmitButton` virou componente compartilhado (`src/components/confirm-submit-button.tsx`) — passou a ser usado em dois lugares (excluir mesa no novo modal, e o que já existia no Lobby), então deixou de fazer sentido duplicar.

### Testes

- Unitários: `updateMesaAction` (validação, negação quando não é Mestre, sucesso) seguindo o padrão dos testes já existentes.
- Integração (banco real): `updateTable` — Jogador não edita, Mestre edita; `listMyTables` conferido trazendo `inviteCode` e `ownerName` corretos.
- Verificação com a app rodando: mesas de teste criadas por SQL, página buscada com a sessão do `admin123@gmail.com` — grade de 3 colunas, código, "2 participantes", "Mestre: Admin" e a engrenagem presentes no HTML (um falso alarme inicial: o React insere `<!-- -->` entre textos adjacentes na renderização do servidor, o que quebrou uma busca por substring exata no teste, mas o texto visível está correto); dados removidos ao final.
- `tsc`, `eslint`, `vitest run` (76/76), teste de integração e `next build` sem erros.

### Decisões

- "Modal" nos cartões de mesa foi lido como o estilo visual (cartão elevado, mesmo `Card` do login), não um diálogo que abre ao clicar — o cartão já é a informação, clicar nele não deveria abrir mais nada por cima. Só os botões (Criar, Entrar com código, engrenagem) abrem diálogos de verdade.
- Sem coluna de "sistema" no banco: como só existe Reinos de Ferro, um campo editável ou uma tabela de sistemas seria complexidade sem uso (CLAUDE.md §2).

### Ajustes finos pedidos logo depois (mesmo dia)

O usuário testou e pediu quatro pequenos ajustes no modal de configurar mesa e no cartão:

- **Botão de excluir**: era um botão grande de largura total. Virou um ícone de lixeira (`lucide-react`), isolado no canto oposto ao Salvar no rodapé do modal — visualmente separado das ações de salvar/cancelar. Como o form de excluir e o form de editar não podem ser aninhados, o botão da lixeira usa o atributo HTML `form="mesa-delete-form"` para submeter um `<form>` oculto à parte; por isso deixou de reusar `ConfirmSubmitButton` (que depende de `useFormStatus`, só funciona dentro do próprio `<form>`) — a confirmação (`window.confirm`) virou um `onClick` simples no botão.
- **Convidar jogadores dentro do modal**: o modal de configurar mesa ganhou a mesma seção que já existia no Lobby (`CopyInvite`: código + Copiar link + Copiar código), sem a frase de descrição. `CopyInvite` virou componente compartilhado (`src/components/copy-invite.tsx`, também restilizado com os componentes novos) já que passou a ser usado nos dois lugares.
- **Cartão da mesa**: removidas as linhas "X participantes" e "Mestre: fulano" — o papel (Mestre/Jogador) já aparece no badge no topo do cartão, e a contagem de participantes não tinha uso claro. Ordem final do cartão: nome, código (agora em destaque, como uma etiqueta) e descrição. `listMyTables` foi simplificada de volta (sem o `alias()` de `profiles` nem a subquery de contagem) já que nada mais usava esses dados.

Reverificado depois do ajuste: `tsc`, `eslint`, `vitest run` (76/76), teste de integração e `next build` sem erros; conferido com a app rodando que "participante"/"Mestre:" não aparecem mais no HTML e o código continua visível.

### Próximas etapas propostas

1. Fase B do modelo de dados (raças, carreiras, perícias, habilidades, progressão).
2. Primeiras regras no `RPGSystemEngine` com os 20 casos de teste da parte 04.

## Etapa 9 — Mesa como página cheia, com painel lateral de abas (2026-09-29)

**Status**: concluída. `/mesas/[id]` deixou de ser uma página de lobby centralizada e virou a tela de jogo em si: o mapa ocupa a página inteira, com um painel lateral ocultável.

### Layout

- `src/app/mesas/layout.tsx`: virou `flex h-dvh flex-col` — cabeçalho fixo em cima, e o conteúdo (`{children}`) num `flex-1 overflow-y-auto`. Isso faz o cabeçalho compartilhado continuar em todas as páginas de `/mesas/*`, mas dá para uma página específica (a da mesa) ocupar 100% da altura restante sem rolagem de página — a rolagem interna fica por conta de cada painel. A lista "Minhas Mesas" não muda de comportamento (continua rolando normalmente dentro dessa área).
- `src/app/mesas/[id]/page.tsx`: reescrita — nada mais de "Participantes", "Convidar jogadores" e "Excluir/Sair" soltos na página. Agora é só `<canvas de mapa (flex-1)> + <MesaSidebar>`.
- `table-canvas.tsx`: o `Stage` do Konva passou a preencher a altura do contêiner (antes era fixo em 600px) — o `ResizeObserver` agora lê `contentRect.height` também. A barra de "Adicionar token" (só Mestre) virou uma barra flutuante sobre o canto superior esquerdo do mapa, em vez de empurrar o canvas para baixo.

### Painel lateral (`mesa-sidebar.tsx`)

Trilho de ícones sempre visível (`lucide-react`) + painel de 288–320px que abre/fecha. Abas, na ordem pedida — **Chat, Infos, Regras, Bestiário (só Mestre, logo depois de Regras), Loja, Fichas, Jogadores online, Configuração**:

- **Chat, Infos, Regras, Loja, Fichas, Bestiário**: só o botão e um "Em breve." — sem funcionalidade ainda, como pedido.
- **Jogadores online** e **Configuração**: como essas duas já tinham funcionalidade real construída (Presence e o formulário de editar/convidar/excluir/sair, antes na página antiga), foram realocadas para dentro das abas em vez de virarem placeholder — não era funcionalidade nova, só mudou de lugar. Decisão tomada por conta própria; se a intenção era placeholder ali também, é só avisar.
  - **Jogadores online**: lista de participantes (nome, papel, "você") com uma bolinha verde para quem está com a mesa aberta agora (Presence em tempo real, efêmero, não gravado no banco).
  - **Configuração**: Mestre edita nome/descrição, vê o convite (`CopyInvite` reaproveitado) e exclui a mesa; Jogador só vê o botão de sair. O antigo `presence.tsx` foi incorporado ao painel de "Jogadores online" e removido como arquivo à parte.

### Correção de dado

A mesa "Projeto VTT" (criada antes de a tabela `scenes` existir, na etapa 7) não tinha cena — como a página nova depende de uma cena para mostrar o mapa, ela quebraria ao abrir essa mesa específica. Rodado um backfill (`insert into scenes ... where table_id not in (select table_id from scenes)`) antes de qualquer outra mudança, então a mesa do usuário não foi afetada. A página também trata a ausência de cena sem quebrar (mensagem em vez de erro), como rede de segurança.

### Testes

- `tsc`, `eslint`, `vitest run` (76/76), teste de integração e `next build` sem erros.
- Verificação com a app rodando: as 8 abas (Mestre) aparecem no HTML com o `aria-label` certo; visão de Jogador confirmada sem o Bestiário mas com Chat e Configuração; testado numa mesa real já existente do usuário (não uma mesa de teste descartável, já que o objetivo era justamente confirmar que a mesa antiga sem cena funciona depois do backfill).

### Próximas etapas propostas

1. Cadastro (`/cadastro`) ainda está no visual antigo — falta o mesmo tratamento.
2. Fase B do modelo de dados (raças, carreiras, perícias, habilidades, progressão).
3. Primeiras regras no `RPGSystemEngine` com os 20 casos de teste da parte 04.

## Etapa 10 — Mesa sem cabeçalho, tema claro/escuro e configuração do Mestre (2026-09-29)

**Status**: concluída.

### `/mesas/[id]` virou página cheia de verdade

O cabeçalho comum (logo, nome, Sair) que a Etapa 9 deixava fixo em todas as páginas de `/mesas/*` não deveria aparecer dentro da mesa — o grid precisa ocupar a tela inteira. Como o cabeçalho vivia num `layout.tsx` compartilhado por `/mesas` e `/mesas/[id]`, a solução foi um **route group** do Next.js: `page.tsx`, os diálogos de criar/entrar mesa e o cartão de mesa foram movidos para `src/app/mesas/(dashboard)/`, com seu próprio `layout.tsx` contendo o cabeçalho — `(dashboard)` não aparece na URL, então `/mesas` continua sendo a URL da lista. `/mesas/[id]/page.tsx` ficou fora do grupo, sem cabeçalho nenhum, só `<canvas do mapa> + <sidebar>`.

### Painel lateral: alternar clicando de novo no ícone

O botão dedicado de "ocultar" foi removido; clicar na aba que já está aberta agora fecha o painel (`mesa-sidebar.tsx`), em vez de precisar de um segundo controle.

### Tema claro/escuro (global)

- `globals.css`: bloco `:root[data-theme="light"]` com as mesmas variáveis OKLCH em tom claro; `:root` sem o atributo continua escuro (padrão).
- Script inline no `<head>` do layout raiz lê `localStorage` e aplica `data-theme="light"` **antes do primeiro paint**, evitando flash da cor errada.
- `src/components/theme-toggle.tsx`: botão sol/lua (mesmo padrão dos outros ícones), colocado no cabeçalho do lobby (`(dashboard)/layout.tsx`), na aba Configuração da mesa e — pendência desta etapa, corrigida — em `/login` (canto superior direito, já que essa página não tem cabeçalho).

### Configuração da mesa redesenhada

A aba Configuração deixou de ser "editar nome/descrição/excluir" (isso já não fazia sentido dentro do grid) e passou a ter: seção geral (Limpar chat — desabilitado, sem chat ainda; tema claro/escuro) → seção do Mestre (tamanho do grid via slider, 16–160px, comitado só ao soltar o controle; imagem de fundo do grid) → código da mesa (texto simples) → copiar link/código → Sair da mesa (Jogador) / Voltar para Minhas Mesas (ambos papéis).

- **Tamanho do grid**: `scenes.grid_size` (nova coluna, migration `0004`), só o Mestre altera (`updateSceneGridSize`), sincronizado em tempo real para todos via `postgres_changes` na tabela `scenes` (mesmo canal já usado pelos tokens).
- **Imagem de fundo**: substitui, nunca acumula (upload com `upsert: true` sempre no mesmo caminho `<table_id>/background`) — "um ou nenhum na tela", como pedido. Bucket público `scene-backgrounds` (a imagem em si não é sensível; simplifica servir a URL sem link assinado). Renderizada no Canvas via `Konva.Image`, esticada para cobrir o grid (sem preservar proporção — simplificação deliberada).

### Bug real encontrado e corrigido: upload sempre recusado por RLS

Ao testar de ponta a ponta, o Mestre real (dono confirmado da mesa) recebia `403 new row violates row-level security policy` ao enviar a imagem — mesmo com a lógica da policy conferida como correta via SQL direto. Descartada a hipótese de falta de `GRANT` (`authenticated` já tinha `SELECT` em `game_tables`/`scenes`/`game_table_members`).

**Causa real**: dentro do `EXISTS (SELECT 1 FROM game_tables g WHERE g.id::text = (storage.foldername(name))[1] ...)`, a referência não qualificada `name` era capturada pelo escopo da própria subconsulta (`game_tables` também tem uma coluna `name` — o nome da mesa) em vez de correlacionar com o `name` da linha de `storage.objects` sendo verificada. Ou seja, a policy comparava o **nome da mesa** (ex: "Mesa de Teste") com o id da mesa — nunca verdadeiro, então a policy nunca deixava ninguém (nem o Mestre) enviar nada. Corrigido em `drizzle/0005_fix_scene_backgrounds_policies.sql`, qualificando explicitamente `storage.foldername(objects.name)`. Reconferido depois: Mestre consegue enviar, Jogador continua bloqueado, imagem fica pública sem sessão.

### Testes

- Unitários: `updateGridSizeAction`/`uploadSceneBackgroundAction` (validação de tamanho/tipo/tamanho de arquivo, delegação ao query layer, erro de storage). `useBackgroundImage` usa o padrão "ajustar estado durante a renderização" (em vez de `setState` dentro de `useEffect`) para satisfazer a regra `react-hooks/set-state-in-effect`.
- Integração (banco real): `updateSceneGridSize`/`updateSceneBackground` — só o Mestre altera.
- Verificação com a app rodando (dev server real, usuário `admin123@gmail.com` real): tema no login presente, upload real do Mestre bem-sucedido, imagem pública acessível sem sessão, Jogador de teste (criado e removido via Admin API) corretamente bloqueado pela policy corrigida, limpeza de dados de teste confirmada (storage e `scenes` voltaram ao estado anterior).
- `tsc`, `eslint`, `vitest run` (83/83), `npm run test:integration` e `next build` sem erros.

### Próximas etapas propostas

1. Cadastro (`/cadastro`) ainda está no visual antigo.
2. Fase B do modelo de dados (raças, carreiras, perícias, habilidades, progressão).
3. Primeiras regras no `RPGSystemEngine` com os 20 casos de teste da parte 04.

## Etapa 11 — Chat da mesa com "Limpar chat" (2026-09-29)

**Status**: concluída (verificada por testes e Realtime real; a interface não foi conferida num navegador nesta sessão — ver "Não verificado").

### O que foi implementado

- **Banco** (migration `0006`): tabela `chat_messages` (RLS de leitura por participante, `REPLICA IDENTITY FULL`, na publicação `supabase_realtime`) e coluna `game_table_members.chat_cleared_at`. `author_name` é gravado junto com a mensagem para o evento de Realtime vir completo, sem join.
- **Backend** (`src/lib/mesas/chat.ts`, Server Actions em `[id]/actions.ts`): enviar (só participante; o nome do autor vem do perfil, nunca do cliente; texto aparado, 1–1000 caracteres), limpar meu chat e limpar chat de todos (só o Mestre, checado no backend).
- **Limpar chat pessoal**: não apaga nada — grava `chat_cleared_at` e a listagem inicial só traz mensagens posteriores. Some só para quem clicou; os outros continuam vendo. O corte usa `now()` **do banco** (não o relógio do servidor da aplicação), porque `created_at` das mensagens também é do banco — com relógios diferentes, mensagens novas poderiam sumir ou antigas reaparecer.
- **Limpar chat de todos** (só Mestre): apaga as linhas de verdade; os clientes removem as mensagens ao receber o DELETE do Realtime.
- **Interface**: aba Chat no painel lateral (lista com rolagem automática, "Você"/nome, tag "Mestre", hora, campo de envio); botões em Configuração — "Limpar chat" para todos (com confirmação) e "Limpar chat de todos" na seção do Mestre (com confirmação). O envio aparece na hora para quem enviou, sem esperar o Realtime (duplicata ignorada por id).
- **Estado no sidebar, não no painel**: o hook `useChat` fica no `MesaSidebar` (sempre montado); se ficasse no painel, mensagens recebidas com a aba fechada se perderiam. Aproveitado para uma bolinha de "não lidas" no ícone do Chat.
- Carrega as últimas 100 mensagens visíveis ao abrir a mesa; o cliente guarda no máximo 300 em memória.

### Decisões e limites conhecidos

- O Realtime não filtra eventos de DELETE e, com RLS ligado, só entrega o `id` — o cliente ignora ids que não conhece. Ids de exclusões de outras mesas chegam ao navegador (só o UUID, sem conteúdo); aceito para o tamanho deste projeto.
- Sem edição/exclusão individual de mensagem, sem indicador de "digitando", sem limite de envio por tempo — não pedidos.
- Mensagem de sistema/rolagem de dados no chat fica para quando houver testes de perícia no engine.

### Testes

- Unitários (88): validação e delegação das três Server Actions (usuário sempre o da sessão).
- Integração (banco real, `chat.int.test.ts`): estranho não envia nem lê; limpar meu chat some só para quem limpou e mensagens novas continuam aparecendo; limpar tudo só funciona para o Mestre.
- Realtime real (script com 3 usuários autenticados): INSERT chega ao Mestre e ao Jogador e **não** chega a quem não participa; DELETE chega aos participantes. Na primeira execução o Mestre não recebeu o INSERT porque o script enviou 1,5 s após assinar; com 5 s todos receberam — corrida do teste, não da lógica, mas indica que logo após abrir a mesa pode haver uma janela curta em que a assinatura ainda não está pronta (o histórico do servidor cobre o que veio antes).
- `tsc`, `eslint`, `next build` e `npm run test:integration` sem erros.

### Não verificado

- Interface no navegador (abrir a aba, digitar, botões de limpar, bolinha de não lidas) — não testado com clique real nesta sessão; a lógica de dados e o Realtime foram verificados, a tela ainda precisa do teste manual do usuário.

### Próximas etapas propostas

1. Cadastro (`/cadastro`) ainda está no visual antigo.
2. Abas restantes do painel (Infos, Regras, Bestiário, Loja, Fichas) — ainda "Em breve".
3. Fase B do modelo de dados e primeiras regras no `RPGSystemEngine`.

## Etapa 12 — Mapa de tamanho fixo e imagem de fundo maior (2026-09-29)

**Status**: concluída (lógica e banco verificados; interface e upload real de >1 MB não foram testados num navegador — ver "Não verificado").

### Pedido e decisões (perguntadas ao usuário, não presumidas)

- "Tamanho do grid" deve mudar só o tamanho dos quadrados, não o espaço inteiro, e o espaço pode ser um pouco maior. Decidido: **mapa fixo de 1440 px** (antes 24 casas × tamanho = 960 px com o padrão de 40 px).
- **Correção de rumo**: primeiro entendi "manter a posição no mapa" como token preso a um ponto em pixels e migrei `tokens.x`/`y` para pixels (migration `0007`). O usuário esclareceu que o token deve **ficar na casa e acompanhar o tamanho do quadrado** (cresce/encolhe junto). Revertido: `x`/`y` voltam a ser a casa do grid (migration `0008` desfaz a `0007`; nenhum token existia no banco). A pergunta original descreveu mal a opção — a lição é descrever o efeito visível, não só o mecanismo.
- Como o espaço é fixo, quadrado maior significa menos casas: um token guardado numa casa que deixou de existir é **desenhado na última casa** (só na tela, sem alterar o banco — voltar o quadrado ao normal devolve o token à casa dele). Foi o comportamento que eu havia recomendado; se preferir outro, é só dizer.
- Imagem de fundo: limite de **4 MB** (antes 8 MB no código, mas barrado em **1 MB** pelo padrão do Next para Server Actions). Só aceita **PNG, JPEG e WEBP**; PDF não é aceito.

### O que mudou

- `src/lib/mesas/map.ts` (novo, seguro no navegador): `MAP_SIZE = 1440`, `GRID_SIZES` (só valores de 16 a 160 px que dividem 1440 exatamente, para não sobrar casa cortada na borda), `cellsPerSide`, `cellAt`, `cellCenter`, `clampCell`, e o limite de 4 MB da imagem. As constantes da imagem ficam aqui porque `schemas.ts` importa `invite-code.ts` (`node:crypto`), que não pode ir para o bundle do navegador.
- Controle em Configuração: passou a ser "Tamanho dos quadrados", com passos só nos tamanhos válidos, mostrando `40px · 36×36`. `gridSizeSchema` rejeita valores fora da lista (o servidor valida de novo).
- Imagem de fundo estica sobre o mapa fixo, então não distorce mais ao mudar o quadrado. O painel barra arquivo >4 MB antes de enviar e mostra o formato/limite aceitos.
- `next.config.ts`: `experimental.serverActions.bodySizeLimit = "4.5mb"` (4 MB da imagem + folga do multipart; 4,5 MB também é o teto de corpo de requisição das funções da Vercel).
- Migrations `0007` (casas → pixels) e `0008` (pixels → casas, desfaz a anterior), ambas testadas numa transação desfeita; o banco real não tinha tokens.
- Ao soltar um token na mesma casa, o círculo agora é reposicionado explicitamente (antes, sem mudança de estado, o React não o recolocava).

### Testes

- Unitários (95): todo tamanho divide 1440; casas por lado; `cellAt` nunca sai do mapa; token acompanha o tamanho do quadrado; casa inexistente aparece na última; tamanho antigo cai no mais próximo; casa de token só até a última do menor quadrado; `gridSizeSchema` só aceita tamanhos válidos.
- `tsc`, `eslint`, `next build` e testes de integração sem erros; `/mesas` e `/mesas/[id]` respondem 200 no servidor de desenvolvimento.

### Não verificado

- Interface no navegador (controle de quadrados, token permanecendo no lugar, mapa maior na tela).
- Envio real de uma imagem entre 1 e 4 MB pela Server Action (a configuração segue a documentação do Next e o build passa, mas não foi disparado o envio de verdade).
- Com o mapa em 1440 px, a visão inicial (zoom 1) pode não caber inteira na tela; não foi ajustado o enquadramento inicial por não ter sido pedido.

### Lentidão nas páginas (diagnóstico, sem alteração de código)

Medido: o projeto Supabase está em us-east-2 (Ohio) e cada ida à rede custa ~0,25 s daqui; `/mesas` leva ~0,7 s e `/mesas/[id]` ~1,6 s (produção local quase igual ao dev). É latência de rede, não do Next. Na Vercel, com as funções perto do banco (região da Costa Leste dos EUA), deve cair muito; o tamanho do banco não influencia. Decisão do usuário: reavaliar depois do deploy.

### Próximas etapas propostas

1. Cadastro (`/cadastro`) ainda está no visual antigo.
2. Abas restantes do painel (Infos, Regras, Bestiário, Loja, Fichas) — ainda "Em breve".
3. Fase B do modelo de dados e primeiras regras no `RPGSystemEngine`.

## Etapa 13 — Aba Infos e barras de rolagem (2026-09-29)

**Status**: concluída (dados, permissões, Storage e aviso em tempo real verificados; a tela não foi conferida num navegador — ver "Não verificado").

### Pedido e decisões (perguntadas ao usuário)

- **Barras de rolagem** (vertical e horizontal) personalizadas: finas, sem trilho, na cor do tema (claro/escuro), em `globals.css` com `scrollbar-width`/`scrollbar-color` (padrão; no Chrome, definir `scrollbar-color` faz o navegador ignorar `::-webkit-scrollbar`).
- **Infos**: duas seções recolhíveis, **Imagens** e **Notas** (fechadas ao abrir, com contagem), listas em **ordem alfabética**. Imagem = nome + imagem (só o Mestre cria). Nota = nome + descrição (qualquer participante cria). Clique esquerdo no nome abre um modal só de visualização (com X); clique direito abre o menu **Editar / Excluir**. Em telas de toque (`pointer: coarse`) aparece um botão **⋯** com o mesmo menu (o botão direito não existe no celular).
- **Quem edita**: info criada pelo Mestre, só ele; criada por jogador, todos (inclusive o Mestre). Excluir segue a mesma regra.
- **Oculta**: o que o Mestre cria nasce **oculto** (só ele vê, com ícone de olho cortado); pelo menu de botão direito ele escolhe **Ocultar/Mostrar dos jogadores**. Só vale para o que o Mestre criou; notas de jogadores são sempre visíveis.

### Implementação

- Banco (migration `0009`): tabela `infos` (RLS de leitura já esconde as ocultas de jogadores, mesmo consultando o Supabase direto) e bucket público `info-images` com policies só para o Mestre escrever (com `objects.name` qualificado, para não repetir o bug da migration `0004`).
- `src/lib/mesas/info-rules.ts` (regras compartilhadas entre servidor e tela), `infos.ts` (consultas; o backend decide tudo com o usuário da sessão), `[id]/info-actions.ts` (Server Actions; validam nome/descrição/arquivo, e apagam do Storage a imagem que ficaria órfã), `use-infos.ts`, `infos-panel.tsx`.
- A imagem é enviada como o próprio usuário (a policy de Storage é a segunda trava) para `<mesa>/<id da info>`; trocar a imagem sobrescreve, excluir a info apaga o arquivo. Mesmos formatos e limite do fundo (PNG/JPEG/WEBP, 4 MB). A validação do arquivo virou uma função só (`imageFileError`), reutilizada pelo fundo do mapa.
- **Tempo real por aviso, não por dados** (ver `docs/arquitetura.md` §7.2): por causa das ocultas, usar `postgres_changes` mandaria o conteúdo a quem assinasse, e ocultar algo que o jogador já viu nem o avisaria. O canal `infos:<mesa>` só diz "mudou"; cada cliente busca a própria lista no servidor, filtrada pelo papel. O autor recebe a lista atualizada na própria resposta da ação (uma ida à rede só).
- Exclusão de imagem: a URL pública pode continuar respondendo por até 1 h por cache da CDN do Supabase, mas o arquivo é apagado de verdade (conferido na tabela do Storage).

### Testes

- Unitários (111): regras de permissão; Server Actions (validação, id do arquivo = id da info, arquivo apagado se a criação falha, imagem só reenviada quando há arquivo novo).
- Integração (banco real, `infos.int.test.ts`): estranho não vê nem cria; jogador não cria imagem; o Mestre cria oculto e jogador não recebe; mostrar/ocultar só o Mestre e só o que criou; jogador não edita/exclui info do Mestre (nem sabendo o id); qualquer participante edita/exclui nota de jogador; trocar imagem preserva/atualiza o endereço.
- Verificação real com usuários autenticados: jogador não envia nem apaga imagem no Storage, Mestre envia/troca/apaga, imagem pública sem sessão, e o aviso `changed` chega ao outro participante (e não ao autor).
- `tsc`, `eslint`, `next build` e testes de integração sem erros; `/mesas/[id]` responde 200 com a aba Infos.

### Não verificado

- Tudo o que é visual e de interação no navegador: abrir/fechar as seções, modais de ver/criar/editar, menu de botão direito e o ⋯ no celular, aparência das barras de rolagem. Precisa do teste manual do usuário.
- Autor da nota e "info do Mestre" não aparecem na interface (só o ícone de oculta). Se quiser ver quem criou, ou um cadeado nas notas do Mestre, é um pedido à parte.
