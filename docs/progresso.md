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

## Etapa 14 — Catálogo do manual no banco (2026-10-02), 1ª parte da criação de personagem

**Status**: catálogo concluído e no banco. A criação de personagem em si (wizard, ficha, lista, janela separada) **ainda não foi feita**; esta etapa é a base de dados que ela exige (CLAUDE.md §9: as opções vêm do banco, não são digitadas).

### Pedido e escopo combinado

O usuário quer criar personagem pela aba Fichas: modal com o passo a passo do livro (1 raça, 2 arquétipo, 3 duas carreiras recebendo seus benefícios, 4 pontos de atributo, 5 toques finais: nome, idade, nacionalidade, altura, peso, aparência), ao salvar abrir a ficha num modal (X à direita; à esquerda um botão para abrir em janela separada, reaproveitada ao clicar no nome na lista). Todos veem as fichas; só o dono mexe na mecânica. **Sem compra de equipamento** na criação (fica para a aba Loja). **Dotado entra**, com as magias já no banco. Ainda sem resposta: um personagem ou vários por jogador; o que o dono pode alterar depois de criar (perguntar ao chegar na ficha).

### O que foi feito

- **Catálogo em JSON** (`data/catalog/`), gerado por script a partir de `docs/regras/` e revisado: 7 raças (atributos por estágio, idiomas, benefícios e restrições estruturados), 4 arquétipos (10 benefícios cada), 50 perícias (11 militares, 29 profissionais, 10 gerais), 149 habilidades, 160 magias e 10 listas de magias, 30 carreiras, 13 tipos de conexão e a tabela de progressão por XP.
- **Carreiras estruturadas**: pré-requisitos (raça, arquétipo, nação, "apenas inicial"), iniciais com **escolhas** ("1 entre…", "+ 2 entre…"), progressão com nível máximo por perícia, bens (CO), segunda carreira restrita (Lâmina Tempestuosa, Presa de Ferro, Soldado de Trincheira), variantes do **Feiticeiro (4 elementos, com bônus de FIS/VEL da Pedra e da Tempestade)** e do **Sacerdote (Morrow/Menoth)**.
- **Validação**: `src/lib/catalog/schemas.ts` (zod, `strict`) e `catalog.test.ts` (11 testes): tamanhos do livro, identificadores únicos, e **toda referência existe** (habilidades, perícias, magias, listas, raças, arquétipos). Esse teste já achou um erro real (carreiras sem dinheiro inicial) durante a montagem.
- **Banco** (migration `0010`): tabela única `catalog_entries (kind, slug, name, data)`, RLS de leitura para logados, sem escrita pelo app. Carga com `npm run db:seed` (apaga e recarrega numa transação, repetível). Conferido no banco real: os 424 itens são **idênticos** aos arquivos, sem login não lê, usuário comum não escreve nem apaga.
- Páginas do PDF conferidas **como imagem** onde o texto extraído era ambíguo (Explorador, Ladrão, Sacerdote, Feiticeiro).

### Inconsistências do livro (pedem decisão)

Ver `docs/regras-rpg.md` §5.4: "Senso de Direção" (Explorador) não existe como perícia, "Esfriar" (Feiticeiro de Gelo) não existe como magia, e dois pontos de leitura (Ladrão, Sacerdote de Menoth). Tudo marcado nos dados; nenhuma foi tratada como regra.

### Testes e verificação

- `tsc`, `eslint`, `next build` sem erros; 122 testes unitários passando.

### Próximos passos desta funcionalidade

1. Motor: atributos derivados (DEF, ARM, Iniciativa, VON, espiral vital) e validação da criação (3 pontos, limites por raça, pré-requisitos de carreira/arquétipo, nação), como funções puras com testes.
2. Tabelas do personagem (`characters` e filhas) e a Server Action de criação, com o backend validando de novo cada escolha.
3. Interface: aba Fichas (lista), wizard em modal, ficha em modal e janela separada.

## Etapa 15 — Aba Fichas: criação de personagem (2026-10-03)

**Status**: implementada e verificada por testes, banco real e renderização no servidor. **O assistente de criação e o modal nunca foram clicados num navegador** (a extensão do Chrome não conecta nesta sessão): precisam do teste manual do usuário.

### Como funciona

- **Aba Fichas** no painel lateral: botão "Criar personagem" e a lista de personagens da mesa (nome, raça, arquétipo, carreiras, dono). Todos os participantes veem todas as fichas; só o dono altera a própria. A lista atualiza sozinha para os outros (aviso `characters:<mesa>` + busca no servidor, como em Infos).
- **Assistente (modal, 5 passos do livro, p. 105/148)**: 1 raça (humano escolhe o Potencial Excepcional), 2 arquétipo + benefício inicial, 3 duas carreiras (com variante de Feiticeiro/Sacerdote, escolhas de perícia, idiomas, habilidade extra do Iosano e parâmetro do Virtuoso/Estudo Adicional), 4 três pontos de atributo, 5 toques finais (nome, idade, nacionalidade, altura, peso, aparência). As opções vêm do catálogo no banco; o motor valida em tempo real e só deixa avançar com o passo correto; carreiras indisponíveis aparecem desabilitadas com o motivo.
- **Ao salvar abre a ficha** num modal: X à direita e, à esquerda, o botão "abrir em janela separada" (`/mesas/<mesa>/fichas/<personagem>`, uma janela por personagem). Clicar no nome na lista traz a janela se já estiver aberta; senão abre o modal. A janela se atualiza quando alguém muda a ficha.
- **A ficha não guarda cálculo**: o banco tem só as **escolhas** (`characters.choices`) e os **detalhes** (`details`); o backend monta tudo na hora (`src/lib/engine/character.ts`): atributos, DEF (VEL+AGI+PER, +1 Gobber), Iniciativa, ARM, Vontade, alcance de comando, vitalidade, totais de perícia, habilidades, benefícios, magias, conexões, dinheiro inicial. O teste de integração confere que nada derivado vai para o banco.
- **Motor** (funções puras, também usadas pela tela para mostrar opções; o backend revalida tudo antes de gravar): perícia que vem das duas carreiras começa no nível 2; Dotado: ARC 3 (tecelão) ou 2 (focalizador, se tiver Conjurador de Guerra); Feiticeiro de Pedra/Tempestade: +1 FIS/VEL e +1 no máximo; restrições de raça (Nyss/Trolloide Dotado, armas do Gobber), de arquétipo, de nação e segunda carreira obrigatória (Lâmina Tempestuosa etc.); magias ≤ 2 × INT; pré-requisitos de habilidade lidos por regra (o teste garante que todas as do livro são entendidas).
- Carreiras com nação (cygnarano/khadorano): ao escolher, a nacionalidade é preenchida; o backend exige que bata.

### Decisões minhas (sem resposta do usuário; fáceis de mudar)

- **Sem limite de personagens por jogador** (o contrário bloquearia quem quer mais de um; se quiser "um só", é uma checagem).
- **O dono só edita os detalhes** (nome, idade, nacionalidade, altura, peso, aparência). Atributos, raça e carreiras ficam travados até existir ganho de XP. O Mestre só vê (como o usuário descreveu: "somente o seu você consegue mexer").
- Sem excluir personagem (não pedido).

### Ainda não feito

Equipamentos no catálogo e compra (aba Loja); pontos de façanha, dinheiro e dano/cura na vitalidade durante a sessão; ganho de XP e progressão; personalizações opcionais da criação aprovadas pelo Mestre (trocar habilidade/perícia/magia inicial); excluir personagem.

### Infraestrutura de testes (achado)

A "falha intermitente" dos testes de integração (etapa 4) tinha causa: a latência até o banco em Ohio oscila de ~130 ms a ~1 s e os testes fazem dezenas de consultas, estourando os limites (30 s por teste, 10 s por gancho). Subidos para 120 s e 60 s em `vitest.integration.config.ts`. Execuções que estouraram deixaram dados de teste no banco (13 perfis "Teste…", 2 mesas e 1 personagem), que foram **removidos** (só o que era inequivocamente de teste; as mesas do Admin ficaram).

### Verificação

- 138 testes unitários (16 do motor de criação, 11 do catálogo), 5 de integração no banco real (inclui personagens com o catálogo do banco), `tsc`, `eslint` e `next build` sem erros.
- Servidor de desenvolvimento: `/mesas/[id]` responde 200 com a aba Fichas; a ficha em janela separada renderiza para um personagem real (nome, raça, carreiras, derivados, perícias, magias, tradição, "Editar detalhes"), responde 404 se não existe e redireciona ao login sem sessão.
- **Não verificado**: o assistente e os modais com cliques de verdade, a abertura da janela separada e a atualização entre janelas, o visual em telas pequenas.

## Etapa 16 — Ficha em abas, dossiê, imagem, espiral vital e ações (2026-10-03)

**Status**: concluída e **testada num navegador de verdade** (Microsoft Edge controlado por Playwright, fora do projeto): 32 de 33 verificações passaram na última rodada; a que falhou (Mestre marcando dano) passou na rodada anterior e falhou por o teste ler o banco antes de o salvamento terminar na rede lenta (padrão confirmado nas outras duas falhas, que sumiram quando o teste passou a esperar).

### O que o usuário pediu e foi feito

- **Mestre edita**: o Mestre abre e edita a ficha de qualquer personagem da mesa (detalhes, imagem, notas, dano, ações). O backend decide por papel (dono ou Mestre); outro jogador não recebe a ficha.
- **Dossiê** (prévia ao clicar no nome, para todos): imagem à esquerda, nome em cima, à direita idade, nacionalidade, filiação, organização, altura, peso e crimes. **Só o dono e o Mestre** têm o botão "Abrir ficha". Mudança de regra em relação à etapa 15: a ficha completa **não** é mais visível a todos (a RLS de `characters` também passou a ser dono ou Mestre).
- **Imagem do personagem**: opcional na criação, e incluir/trocar/remover em Pessoal. Bucket `character-images` (public read; escrita só dono ou Mestre via policy, com `objects.name` qualificado). Mesmo limite do fundo e das infos (PNG/JPEG/WEBP, 4 MB). Verificado no navegador: o upload chegou ao Storage.
- **Ficha em abas**: Ficha (nome, raça, arquétipo, carreiras, XP; atributos em círculos com linhas ligando aos secundários; Iniciativa, Defesa, Armadura, Vontade, Comando; vitalidade), Combate, Perícias, Habilidades e benefícios, Notas, Pessoal. Modal grande com X à direita e botão de janela separada à esquerda; janela separada com as mesmas abas e atualização entre janelas.
- **Vitalidade = espiral vital do livro** (6 ramos numerados, 1-2 Físico, 3-4 Agilidade, 5-6 Intelecto): clicar num círculo marca o dano (de fora para dentro), clicar no último marcado desfaz; mostra enfraquecido por aspecto e debilitado; o dano fica salvo e Mestre e dono veem o mesmo. Círculos que o ramo não tem aparecem riscados.
- **Combate**: vitalidade, buffs e debuffs (efeito base do arquétipo, modificadores raciais e os aspectos enfraquecidos como debuff), Armas (vazio: dependem do equipamento/Loja), **ações do turno** e poderes (façanhas).
- **Ações do turno, automáticas** (livro p. 201): 2 rápidas, ou 1 rápida + 1 de ataque, ou 1 completa; os botões só liberam o que ainda cabe; "Desfazer" e "Novo turno". Ações que uma habilidade deixa sem custo (Saque Rápido, Recarga Rápida, Granadeiro, Ás Comandante, Avanço Cuidadoso, Legado de Bragg, Alquimista de Campo, Conjurador Rápido do Dotado) aparecem como "Sem custo" e **não gastam** ação; Besteiro barateia recarregar besta (completa → rápida). Dados em `data/catalog/actions.json`, só com o que o livro diz (pp. 201-202 e a tabela de habilidades que concedem ações).
- **Perícias**: todas as do jogo; as do personagem marcadas com nível; as outras mostram o valor do atributo (podem ser usadas sem treino) ou **0 se exigem treino**; perícia social tem lista suspensa para escolher o atributo.
- **Notas** (título e texto): criar, editar, excluir. **Pessoal**: dados e imagem, editáveis. Criação ganhou Filiação, Organização e Crimes e a imagem; o modal de criação ficou maior.
- **Decisões do usuário no catálogo**: "Esfriar" → Calafrio; "Senso de Direção" dentro de Sobrevivência (ver `docs/regras-rpg.md` §5.4). Novo ponto provisório: qual ramo da espiral ganha o círculo a mais quando o atributo é ímpar (o livro não diz; usado o de número menor).

### Testes

- Unitários (146): motor (espiral, ações do turno, ações grátis por habilidade, perícias que o personagem não tem), catálogo (referências de ações e das decisões do usuário).
- Integração no banco real, cenário mínimo como pedido (**2 perfis, 1 mesa, 2 personagens**; os outros testes também foram reduzidos a 2 perfis): dossiê para todos, ficha só dono/Mestre, edição por dono ou Mestre, estado (dano limitado ao ramo, ações válidas), imagem, notas.
- **Navegador (Edge via Playwright)**: assistente completo (bloqueios corretos), ficha abre ao salvar, 6 abas, atributos em círculos, espiral, dano salvo, imagem no Storage, ação gasta, 50 perícias com "exige treino = 0" e listas sociais, notas, edição em Pessoal, janela separada, dossiê (sem "Abrir ficha" em personagem de outro; com no próprio), Mestre abre a ficha do jogador.
- `tsc`, `eslint`, `next build` sem erros.

### Achados de ambiente (não são defeitos do app)

- A rede daqui até o Supabase oscila (quedas de conexão e latência de ~0,1 a 1 s); testes e scripts precisam de tentativas e esperas.
- **404 na janela separada em desenvolvimento**: o cache do Turbopack (`.next/dev`) pode guardar uma compilação antiga dessa rota e servi-la mesmo reiniciando. Se acontecer: parar o `npm run dev`, apagar a pasta `.next` e subir de novo (confirmado: com o cache limpo a rota responde 200). Rodar `next build` com o servidor de desenvolvimento ligado também mexe nesse cache.
- A extensão do Chrome não serve (o usuário não usa Chrome); o Playwright controla o Edge já instalado, sem baixar navegador.

### Ainda não feito

Equipamentos no catálogo e a Loja (e, com eles, armas na aba Combate); efeitos reais de buffs/debuffs; tracking de pontos de façanha e de dinheiro; ganho de XP e progressão; excluir personagem.

## Etapa 17 — Loja: catálogo de equipamentos (2026-10-05)

**Status**: implementada e verificada por testes; **não clicada num navegador** (fica para o teste do usuário). A ficha ficou para o final, a pedido do usuário.

### Como funciona

- **Aba Loja** no painel lateral (todos da mesa): busca pelo nome (ignora acentos e maiúsculas), filtro de categoria e a lista agrupada nas **14 categorias da Lista de Preços do livro** (Armaduras, Armas corpo-a-corpo, Armas de ataque à distância, Munições e acessórios, Vestuário, Equipamentos, Montarias, Alimentação e acomodação, Mekânica, Runas mekânicas, Dispositivos mecânicos, Ingredientes, Compostos e Armas alquímicas). Cada item mostra **Compra** e **Venda** em CO; armaduras mostram o tipo (Leve/Média/Pesada); "5+" = a partir de; "+10" = acréscimo sobre outro item.
- **Venda = metade do preço** (Negociação sem treino, pp. 182-183), calculada no backend (`src/lib/engine/shop.ts`); o teste de Negociação que melhora a revenda fica para quando houver venda de verdade.
- **Dados**: `data/catalog/equipment.json` (294 itens), gerado da Lista de Preços do PDF (pp. 241-245) com pymupdf. A Baioneta, repetida no livro, entra uma vez; as pontas da lança explosiva e os rebites viram itens com o nome do pai. Novo tipo `equipment` em `catalog_entries` (migration `0014_catalog_equipment`), carregado por `npm run db:seed`. A tela busca a lista uma vez por página (ação `getShopAction`, só para quem participa da mesa).

### Ainda não feito

Comprar/vender de verdade (dinheiro e inventário do personagem), estatísticas de armas e armaduras na Loja e na ficha, preços de usado/refinado (vestuário) e de cárter mekânico (10x).

### Verificação

- 148 testes unitários (2 novos: tamanho da lista por categoria e preços conferidos no livro), `tsc` e `eslint` sem erros. Migration aplicada e seed com 294 itens no banco.

## Etapa 18 — Banco em português e enxugamento (2026-10-05)

Pedido do usuário: banco legível, sem crescer à toa, e só testes de regras.

- **Tabelas e colunas em português**, renomeadas no lugar (migration `0015_banco_em_portugues`, sem perder dados): `perfis`, `mesas`, `membros`, `mensagens`, `personagens`, `infos`, `cenas`, `tokens`. No código, as chaves TypeScript continuam as mesmas (o Drizzle faz a ponte).
- **Catálogo: uma tabela por tipo**, com colunas de verdade: `racas`, `arquetipos`, `carreiras`, `pericias`, `habilidades`, `magias`, `listas_de_magias`, `conexoes`, `acoes`, `progressao`, `equipamentos`. A coluna `id` é o identificador que a ficha guarda em `personagens.escolhas`. Regras aninhadas (ex.: o que a carreira concede) ficam em colunas jsonb. Saiu a tabela genérica `catalog_entries`. Seed: `npm run db:seed` (`scripts/seed-catalog.ts`, Node roda TS direto).
- **Notas da ficha** viraram a coluna `personagens.notas` (lista de título + texto); saiu a tabela `character_notes`.
- **Chat**: o banco guarda só as **últimas 100 mensagens por mesa**; cada envio apaga as mais antigas (`src/lib/mesas/chat.ts`).
- **Testes**: ficaram só os de regras (engine e catálogo, 41). Saíram os de integração com o banco real e os de telas/ações, junto com `vitest.integration.config.ts`.
- Achado: há uma tabela `"Projeto VTT"` no schema público que não é do app (não mexi).

## Etapa 19 — Loja: comprar e vender (2026-10-05)

**Status**: implementada; tipos, lint e testes de regra ok. **Não clicada no navegador** (teste do usuário).

- **Aba Loja** → botão "Abrir loja" → modal: personagem (o jogador vê os seus; o Mestre, todos), dinheiro, abas **Comprar** (categorias à esquerda, busca, preço já com a % negociada) e **Inventário** (vender).
- **Personagem** ganhou `dinheiro` (CO com uma casa decimal; começa com as CO das carreiras iniciais — os já existentes receberam na migration `0016_loja`) e `inventario` (id do equipamento + quantidade).
- **Comprar**: desconta na hora; bloqueia sem saldo. **Vender**: só o que tem; recebe metade (sem Negociação).
- **Negociação** (pp. 182-183), decisões do usuário: só para quem tem a perícia; o jogador escolhe o atributo; o servidor rola 2d6 + atributo + Negociação e aplica a tabela (compra 100→75%, revenda 50→75%); **compra e venda são rolagens separadas**; o resultado vai para o **chat**. Vale enquanto a Loja está aberta (sem "visita"); dentro dela não se repete o teste (o livro: "1 teste, sem repetir").
- **Mestre**: dá item de graça, tira item e define o dinheiro (clicando no valor).
- Regras em `src/lib/engine/shop.ts` (com teste); backend em `src/lib/mesas/shop.ts`.

Ainda não: equipar (armas/armadura mudando DEF/ARM e aparecendo em Combate), munição consumida, usado/refinado.

## Etapa 20 — Mapa, Regras (Magias), dossiê e limpeza (2026-10-05)

Pedidos do usuário. Tipos, lint e testes de regra ok; **não clicado no navegador**.

- **Tokens removidos** (código e tabela, migration `0017_remover_tokens`). Voltam quando houver criaturas/personagens no mapa.
- **Fundo do mapa**: a imagem não estica mais; o mapa assume a proporção dela (lado maior = 1440 px) e o grid é cortado em casas inteiras sobre ela. Na Configuração, o Mestre tem **"Remover imagem"** (apaga o arquivo do Storage e volta ao grid normal).
- **Aba Regras → botão "Magias"**: modal com as 160 magias, busca por nome e filtro por **carreira** (as listas do livro: Feiticeiro de Fogo, Sacerdote de Morrow…); Custo, ALC, ADE, POD, Manutenção e Ofensiva na linha; clicar expande a descrição (sem outro modal).
- **Dossiê**: abre já com o nome do personagem (sem "Dossiê" enquanto carrega) e sem o nome do jogador. **Lista de Fichas** mostra a foto do personagem.
- **Limpeza**: página inicial agora só redireciona (mesas ou login); cadastro com o mesmo visual do login; removidos estilos antigos (`form-styles.ts`) e exports sem uso.

## Etapa 21 — Mesa travando (entrar/criar) (2026-10-06)

**Problema relatado**: entrar ou criar mesa demorava até dar erro.

**Causa (medida, não suposta)**: no banco havia conexões presas há 11 minutos em `ClientRead`, sempre nas consultas paralelas da página da mesa. O driver `postgres` empilha consultas numa conexão ocupada (pipelining) e o pooler do Supabase em modo transação trava com isso; o catálogo sem cache em desenvolvimento (11 consultas a cada tela, mudança da etapa 18) multiplicou o problema. Diagnóstico reproduzido fora do Next: a página travava com pipelining 100 e 1, e funcionava com 0.

**Correção**:
- `src/lib/db/index.ts`: `max_pipeline: 0` e cliente único em `globalThis`.
- Catálogo lido uma vez por processo (também no dev). Depois de `npm run db:seed`, reiniciar o `npm run dev`.
- `createTable` virou um comando só (mesa + Mestre + cena), já que transação não funciona sem pipelining (e é 1 ida ao banco em vez de 5).
- `getTableForMember`: as duas consultas em paralelo.
- Encerradas as 6 conexões presas no banco.

**Verificado no Chrome**: criar mesa → entra nela (7 s na primeira vez, com compilação do dev); recarregar a mesa: 2-3 s; Loja abre com os 294 itens em 3 s. O tempo que sobra é a latência até o banco nos EUA (~170 ms por consulta, ~1 s para abrir conexão).

## Etapa 22 — Mestre/XP, Progressão, detalhes da Loja, janelas soltas, chat em tempo real (2026-10-07)

Tipos, lint e 43 testes de regra ok. **Testado no Chrome**: chat em tempo real (mensagem de outra conta chega sem F5), detalhes da Loja, XP gravado, Progressão, janela solta (sem fundo escuro, arrasta pelo topo, continua aberta ao trocar de aba).

- **Chat em tempo real (bug)**: o filtro do Realtime (`mesa_id=eq.…`) parou de casar depois da renomeação das colunas (etapa 18), então nenhuma mensagem chegava a quem não enviou. Agora a assinatura é sem filtro e a mesa é conferida no navegador (a RLS já limita o que cada um recebe); o mesmo para a cena do mapa. Também passou a aplicar o login ao Realtime antes de assinar (`createAuthedRealtimeClient`).
- **Aba Mestre** (antes "Bestiário"): botões **XP** e **Bestiário** (desativado até a ficha estabilizar). XP: os prêmios do livro (p. 151: Jogo +1, Trabalho de Equipe +1, Marco +1, conclusão de história +1 a +3) somam o valor; o Mestre escolhe quem recebe e pode mudar o valor de cada um (ou não dar). Fica em `personagens.xp` (migration `0019_xp`) e aparece na ficha. Sem aviso no chat (decisão do usuário).
- **Regras → Progressão por XP**: tabela do livro (p. 152) por estágio, o que cada progressão dá e o limite de perícia; regra de não guardar progressões.
- **Loja**: clicar no item abre o que o livro diz dele (perícia, POD, modificadores, alcance, munição, descrição, regras especiais, runas, fabricação…), com a página. Extraído do PDF (pp. 245-287) direto para `data/catalog/equipment.json` (`details`, `sourcePage`; colunas `detalhes` e `pagina`, migration `0018`). 226 de 294 itens têm descrição; os outros (roupas, utensílios simples, pacotes de munição) só aparecem na Lista de Preços do livro. Texto duplicado do PDF (sombra em cor quase igual) foi descartado na extração.
- **Janelas soltas**: todas as janelas da mesa (`DialogContent floating` + `Dialog modal={false}`) não escurecem o fundo, não fecham ao clicar fora (só X/Esc) e são arrastadas pela faixa do topo. Os painéis laterais ficam montados (escondidos) para a janela não fechar ao trocar de aba.
- **Ficha em janela separada**: o código já pede janela (`popup=yes`); no teste com clique real abriu janela, não guia.
- Catálogo no `npm run dev` expira em 1 minuto (um seed aparece sem reiniciar).

## Etapa 23 — Ficha: novo visual, Equipamentos, bens das carreiras, excluir (2026-11-18)

Tipos, lint e 44 testes de regra ok. Visual de Combate/Perícias/Habilidades conferido no Chrome; **Equipamentos, bens na criação e exclusão ainda não clicados** (extensão do Chrome desconectada).

- **Ficha** (prévia do usuário): abas fixas no topo e sem rolagem lateral; Combate com vitalidade em bolinhas por aspecto, Turno, buffs em etiquetas e ações por tipo (clicar abre a descrição); Perícias em colunas alinhadas (nome | nível | atributo | valor), sem busca nem filtro, atributo em sigla, perícia social com quadradinho de outra cor que abre a escolha; Habilidades em lista com seta; Ficha com Atributos e Derivados lado a lado (texto maior, siglas nos secundários) e a espiral embaixo. Modal com altura fixa.
- **Ataque** separado em "Ataque corpo-a-corpo" (ACO) e "Ataque à distância" (ADI), cada um com a fórmula do livro. Os dois gastam a mesma ação de ataque: o livro (pp. 201-202) diz que é um ataque só, corpo-a-corpo **ou** à distância.
- **Bens das carreiras** (`careers.json` → `initial.gear.kit` e `choices`): itens da Lista de Preços, itens de texto e escolhas. Decisões do usuário: munição vira pacotes da loja (revestimento de papel); porta-mapas = Estojo para mapa, lupa = Lente de aumento, kit do alquimista viajante = Kit de alquimista de viagem; o fuzil do Fuzileiro e o tipo das 5 granadas do Alquimista são escolhidos na criação; o que não está na lista entra como item de texto. Na criação, as escolhas aparecem no passo das carreiras e são obrigatórias; ao salvar, os bens vão para o inventário (`src/lib/engine/inventory.ts`).
- **Aba Equipamentos**: dinheiro e itens; itens da loja abrem o que o livro diz; itens de texto têm nome e descrição editáveis e podem ser excluídos.
- **Excluir personagem**: aba Pessoal, com confirmação (apaga a imagem antes, por causa da policy do Storage).
- Personagens criados antes desta etapa (ex.: Thomas) não têm os bens da carreira: o Mestre pode dar pela Loja ou o personagem pode ser recriado.

## Etapa 24 — Progressão por XP, confirmação única, espiral no Combate (2026-11-19)

Tipos, lint e 47 testes de regra ok. **No Chrome**: a bolinha verde aparece na ficha do Thomas (6 XP → 3 progressões) e a de 2 XP lista só as perícias profissionais das carreiras dele, com o máximo de Herói 2. As escolhas em si não foram gravadas no teste (ficam para o jogador).

- **Progressão** (pp. 151-152): a bolinha verde com seta, no canto das abas da ficha, mostra quantas progressões o XP liberou; clicar abre a próxima, na ordem da tabela. +2 perícias profissionais (os 2 pontos podem ir na mesma), +1 perícia militar/habilidade/conexão/magia, +1 atributo, +1 benefício de arquétipo, ou benefício **ou** nova carreira +2 perícias. As opções vêm só das listas das carreiras do personagem, respeitam o nível máximo do estágio (perícia 2/3/4), o máximo de cada carreira, o máximo racial de atributo, os pré-requisitos de habilidade e o limite de magias (2 × INT; 3 × INT com Acadêmico Arcano). Carreira nova não dá os itens iniciais, só abre as listas.
- **Gravado só como escolha** (`personagens.escolhas.advances`): o motor (`evaluateCharacter` com XP e Épico) aplica e revalida tudo a cada montagem; o servidor só aceita a próxima progressão pendente.
- **Estágios** (decisão do usuário; o livro não diz): Veterano aos 50 XP; Épico quando o Mestre marca (caixinha "Épico" na janela de XP, coluna `personagens.epico`, migration `0020`).
- **Confirmação única**: `confirm()` (`src/components/confirm.tsx`) abre um modalzinho do app no lugar do `window.confirm`, em todas as exclusões (mesa, personagem, nota, info, item, fundo, chat, sair da mesa). "Excluir personagem" foi para dentro do modo Editar da aba Pessoal.
- **Combate**: a espiral vital voltou, pequena, no canto da vitalidade, e marca o dano ali também.
- **Ajustes (2026-11-19)**: bolinha de progressão minimalista (só a borda verde e um ˄ verde). Abas na ordem pedida: Ficha, Combate, Perícias, Habilidades e benefícios, Equipamentos, Magias, Notas, Pessoal. **Magias** virou aba própria (as magias conhecidas abrem a descrição do livro) e só aparece para quem conjura. **Equipamentos**: o dono e o Mestre editam o dinheiro, mudam a quantidade (+/−) e adicionam itens achados na aventura (da Lista de Preços, buscando pelo nome, ou de texto com nome e descrição), uma operação só no servidor (`editInventory`).

### Pedido registrado (próximo bloco do combate)
Combate por iniciativa, pedido do usuário: o Mestre **inicia o combate**; todos que estão no grid rolam iniciativa e entram numa lista que define os turnos; quando o personagem faz suas ações e **encerra**, passa para o próximo. Depende de voltar a ter personagens/criaturas no grid (os tokens foram tirados a pedido) e das armas no Combate. Perguntar os detalhes antes de construir.

## Etapa 25 — Personagem no mapa e Épico (2026-11-19)

Tipos, lint e 47 testes de regra ok. **No Chrome**: o Thomas foi arrastado da lista de Fichas para o mapa e apareceu na casa (foto em círculo e nome embaixo).

- **Personagem no mapa**: na aba Fichas, o dono (ou o Mestre) arrasta o personagem e solta no mapa: ele entra na casa onde foi solto. No mapa, arrastar move de casa em casa; clique duplo tira (com confirmação). Todos da mesa veem em tempo real. Tabela `tokens` (cena, personagem, casa x/y; um por personagem por cena; migration `0021`), `src/lib/mesas/tokens.ts`. Visual pedido pelo usuário: a imagem do personagem num círculo do tamanho da casa, sem esticar, e o nome pequeno embaixo.
- **Épico** (decisão do usuário): vira Épico aos 100 XP (Herói até 49, Veterano 50-99); a tabela de Épico continua de 5 em 5 depois do 95 (100 a 145), na mesma sequência do Veterano. Saíram a caixinha "Épico" do Mestre e a coluna `epico` (migration `0022`).

## Etapa 26 — Combate por iniciativa (2026-11-19)

Tipos, lint e 49 testes de regra ok. **No Chrome**: Mestre iniciou o combate com o Thomas no mapa (2d6 + Iniciativa = 21), encerrou o turno (rodada 2) e encerrou o combate.

- O Mestre **inicia o combate** (botão no canto do mapa): todos os personagens no mapa rolam 2d6 + Iniciativa (da ficha); empate rola de novo; ordem fixa do maior para o menor (pp. 197-198). Rolagens vão para o chat (decisão do usuário).
- Lista de turnos no canto do mapa, para todos, em tempo real (estado em `cenas.combate`, migration `0023`). O dono do personagem da vez ou o Mestre **encerra o turno**; ao virar a rodada, quem entrou no mapa no meio rola e é inserido pela posição do total; quem saiu do mapa deixa a ordem. Ao chegar a vez de um personagem, as ações do turno dele zeram sozinhas (decisão do usuário). O Mestre **encerra o combate**.
- Regras em `src/lib/engine/combat.ts` (com teste); servidor em `src/lib/mesas/combat.ts`.
- Ainda não: adiar ativação, rodada surpresa, criaturas (Bestiário), armas/ataques no Combate. A janela separada da ficha também atualiza quando as ações zeram (BroadcastChannel do navegador).

## Etapa 27 — Rolagens como cartão no chat (2026-11-19)

- **Modelo das rolagens** (pedido do usuário): cartão quadrado no chat com o título centralizado em cima (ex.: "Iniciativa"), o total grande no meio e o nome embaixo; passar o mouse (ou focar pelo teclado) mostra os dados e a soma sobre o próprio cartão. Coluna `mensagens.rolagem` (jsonb: título, total, nome, detalhe; migration `0024`); `texto` guarda a versão em texto. `sendChatRolls` grava vários de uma vez.
- No início do combate cada personagem ganha seu cartão de Iniciativa (sem o texto "Combate iniciado"); quem entra no meio também.
- Mensagens seguidas da mesma pessoa continuam o bloco, sem repetir nome e horário.
- Tipos, lint e testes ok. Conferência visual no Chrome não feita (a extensão perdia o grupo de abas a cada comando).
- **Ajustes**: o chat não recebe mais "Combate encerrado". Dossiê com os dados em duas colunas (Idade | Nacionalidade, Filiação | Organização, Altura | Peso) e "Observações (Crimes)" embaixo só quando preenchido; a foto continua comprida.
- **Combate na tela**: "Iniciar combate" foi para a aba Mestre da barra lateral; a lista de turnos aparece no mapa ao iniciar e cada um pode recolhê-la na própria tela (mostra rodada e de quem é a vez). A aba Combate da ficha perdeu o bloco "Turno" (Desfazer/Novo turno): a vez fica na lista e as ações zeram sozinhas; Vitalidade e Buffs/debuffs ficam lado a lado.
