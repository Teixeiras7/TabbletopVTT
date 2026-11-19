# Arquitetura — Reinos de Ferro TabletopVTT

Status: decisões da etapa 0, mantidas e detalhadas nas etapas seguintes. Implementados até aqui: fundação técnica, autenticação e mesas (ver `docs/progresso.md`). Realtime, Canvas e engine de regras seguem como decidido abaixo e ainda não foram construídos.

## 0. Contexto no momento desta decisão

Diretório do projeto continha apenas `CLAUDE.md` e `manual/` (PDF do livro básico). Nenhum repositório git, nenhuma stack, nenhuma dependência, nenhuma configuração. As decisões abaixo partem do zero, não de código existente.

Restrições que guiaram as escolhas:

- mesa pequena, poucos usuários simultâneos (não é um produto multi-tenant de grande escala);
- multiplayer contínuo de verdade (sem polling, sem "atualiza só no reload");
- deploy alvo: Vercel;
- equipe pequena mantendo o projeto — cada peça de infraestrutura extra tem custo de manutenção;
- backend deve ser autoridade sobre regras e estado (ver CLAUDE.md §8);
- performance aceitável em hardware modesto e mobile.

## 1. Visão geral

```text
Next.js (Vercel)
  ├─ Frontend (App Router, React, Canvas)
  └─ Backend (Route Handlers / Server Actions)
          │
          ├─ RPGSystemEngine (TypeScript puro, sem I/O)
          │
          ├─ Drizzle ORM ──────────────► Postgres (Supabase)
          │
          └─ Supabase Realtime ─────────► Presence + Broadcast
```

Duas peças de infraestrutura gerenciada: **Vercel** (hosting/deploy) e **Supabase** (Postgres + Auth + Realtime + Storage). Nenhum servidor próprio para manter, nenhum processo de longa duração para operar.

## 2. Frontend — Next.js (App Router) + React + TypeScript

**Decisão**: Next.js no App Router, TypeScript, Tailwind + shadcn/ui para componentes de interface (fora do Canvas).

**Por quê**:
- é o caminho nativo para Vercel (zero configuração de deploy);
- Server Components reduzem JS enviado ao cliente para as partes não interativas da UI (fichas, listas, compendium), o que ajuda em hardware modesto;
- Route Handlers cobrem a API do backend sem precisar de um servidor separado;
- shadcn/ui já está disponível nas ferramentas do projeto e evita reconstruir componentes básicos (evita over-engineering em UI).

**Alternativas descartadas**: SPA Vite + backend separado (mais uma peça de deploy/CORS/infra sem ganho real para este tamanho de projeto); Remix (sem vantagem sobre Next.js aqui, ecossistema Vercel é mais direto com Next.js).

## 3. Backend — Route Handlers / Server Actions do próprio Next.js

**Decisão**: não haverá um servidor backend separado. A autoridade sobre regras vive em Route Handlers (`app/api/**`) e Server Actions, que chamam o `RPGSystemEngine`.

**Fluxo de uma ação de jogo** (ex.: ataque, teste de perícia, movimento):

```text
Cliente envia ação
      ↓
Route Handler / Server Action (Vercel Function)
      ↓
Carrega estado relevante do Postgres (via Drizzle)
      ↓
RPGSystemEngine valida e calcula o resultado
      ↓
Persiste o novo estado (Postgres)
      ↓
Publica o evento resultante no canal Realtime da mesa (Supabase Broadcast)
      ↓
Todos os clientes conectados à mesa recebem o evento e atualizam a UI
```

O cliente nunca decide o resultado sozinho; ele envia intenção, recebe confirmação via evento.

**Por quê não um processo com estado em memória (ex.: servidor de sala tipo Colyseus/PartyKit/Durable Object)**:
Seria a opção "mais correta" para um jogo com muita frequência de eventos por segundo (ex.: MMO), mas para uma mesa pequena de RPG de mesa (eventos esporádicos: uma rolagem, um movimento, uma ação por vez, não 60 updates/s) isso é complexidade desnecessária: mais uma infraestrutura para hospedar, operar e pagar, fora do fluxo padrão Vercel. Funções serverless sem estado, com Postgres como fonte de verdade e Realtime para distribuir eventos, cobrem a necessidade real sem introduzir um serviço a mais para a equipe manter. Se no futuro a frequência de eventos ou a necessidade de lock por mesa crescer, esse é o ponto de escalada natural (ver seção 13).

## 4. Banco de dados — Postgres via Supabase

**Decisão**: Postgres gerenciado pela Supabase.

**Por quê**:
- Postgres é o banco relacional padrão, modela bem catálogo x instância (CLAUDE.md §10) com FKs normais;
- a Supabase entrega, no mesmo serviço, Postgres + Auth + Realtime (Presence/Broadcast) + Storage — evita integrar três fornecedores separados para um projeto pequeno;
- tier gratuito/baixo custo é compatível com "mesa pequena, poucos usuários";
- compatível com Vercel (conexão via variáveis de ambiente, sem infra própria).

**Alternativas descartadas**: Vercel Postgres/Neon puro (resolveria o banco, mas não entrega Presence/Broadcast — precisaria de mais um serviço de realtime, ex. Pusher/Ably, aumentando o número de integrações); MongoDB (o domínio é fortemente relacional — personagens, itens, efeitos, instâncias — Postgres modela isso com menos gambiarra).

## 5. ORM — Drizzle

**Decisão**: Drizzle ORM.

**Por quê**:
- é essencialmente SQL tipado: schema como código TypeScript, migrations explícitas, sem "magia" de decorators ou geração de client separado;
- roda bem em ambiente serverless/edge da Vercel;
- mantém o `RPGSystemEngine` fácil de manter desacoplado — o engine recebe dados já carregados (objetos TS simples), nunca importa o ORM diretamente (CLAUDE.md §9).

**Alternativa descartada**: Prisma — também seria uma escolha válida, mas adiciona uma etapa de geração de client e um runtime mais pesado sem trazer benefício adicional para este projeto.

## 6. Autenticação — Supabase Auth

**Decisão**: Supabase Auth (email/senha, com opção de magic link).

**Por quê**:
- já faz parte do serviço escolhido para banco/realtime — um único provedor, um único conjunto de credenciais de usuário reaproveitado em DB, Auth e Realtime;
- suficiente para "mesa pequena" (não há necessidade de SSO corporativo, múltiplos provedores OAuth, etc. — pode ser adicionado depois sem mudar a arquitetura);
- o backend (Route Handlers) valida a sessão em cada requisição e é quem decide se o usuário é Mestre ou Jogador da mesa (CLAUDE.md §17) — nunca o frontend.

**Alternativa descartada**: Auth.js/NextAuth — funcionaria, mas adicionaria um provedor de auth a mais para configurar e manter em paralelo ao Supabase, sem necessidade real aqui.

## 7. Realtime — Supabase Realtime, com três responsabilidades separadas

Conforme exigido no CLAUDE.md §18, Presence, eventos em tempo real e persistência são tratados como três responsabilidades distintas, nunca misturadas:

### 7.1 Presence (efêmero, não persistido)

Quem está conectado à mesa agora, cursor/seleção temporária, "fulano está digitando/rolando dado". Usa o canal de Presence do Supabase Realtime. Nada disso é gravado no Postgres.

### 7.2 Eventos em tempo real (broadcast, não é a fonte de verdade)

Depois que uma ação é validada e persistida no Postgres, o backend publica um evento (Broadcast) no canal da mesa: `token:moved`, `attack:resolved`, `condition:applied`, etc. Os clientes usam isso apenas para atualizar a UI imediatamente — é uma notificação, não a fonte de verdade. Se um cliente perder um evento (reconexão), ele resincroniza buscando o estado atual no Postgres, nunca "adivinha" a partir de eventos perdidos.

### 7.3 Persistência (fonte de verdade)

Postgres, via Drizzle, no backend. Estado de personagens, instâncias, combate, inventário — tudo o que precisa sobreviver a um reload ou reconexão vive aqui. O cliente nunca escreve diretamente no banco; sempre passa pela Route Handler/Server Action que aciona o `RPGSystemEngine`.

**Por que não usar `postgres_changes` (CDC) do Supabase como único mecanismo**: funciona, mas amarra o evento em tempo real 1:1 à estrutura das tabelas, dificultando eventos "compostos" (ex.: um ataque que altera HP, aplica uma condição e gera um log, em uma única notificação coerente para o cliente). Publicar o evento explicitamente a partir do backend, depois de o `RPGSystemEngine` decidir o resultado, dá controle sobre o que é enviado e mantém o Postgres como fonte de verdade em vez de gatilho de UI.

**Exceção deliberada (etapa 7 — tokens do mapa; tokens removidos na etapa 20, a regra continua valendo para a cena e o chat)**: os tokens do grid (`src/app/mesas/[id]/table-canvas.tsx`) usam `postgres_changes` diretamente na tabela `tokens`, não Broadcast customizado. A ressalva acima ("eventos compostos") não se aplica aqui: mover/criar/remover um token é 1:1 com uma linha da tabela, sem efeitos colaterais — exatamente o caso em que `postgres_changes` é simples e correto. Guardar o padrão de Broadcast explícito para quando o evento tiver múltiplos efeitos (ex.: resolução de ataque). Requer `ALTER TABLE tokens REPLICA IDENTITY FULL` e a tabela na publicação `supabase_realtime` (feito na migration `0003`), e a RLS de `tokens` já restringe quem recebe o evento a quem participa da mesa.

**Uso atual de cada mecanismo** (por que cada um):
- `postgres_changes`: cena (tamanho do quadrado e fundo) e chat — dados que **todos os participantes podem ver**, 1:1 com a linha.
- Broadcast como **aviso sem dados** (`infos:<mesa>`, evento `changed`): aba Infos. Existe porque parte das infos é **oculta para jogadores**; com `postgres_changes`, o conteúdo de cada linha iria para quem estivesse assinando, e um `UPDATE` que oculta uma info que o jogador já viu nem chegaria a ele (a RLS esconde a linha nova). Aqui o canal só diz "mudou" e cada cliente busca a própria lista no servidor, já filtrada para o papel dele. Um cliente mal-intencionado que mande o aviso só provoca uma busca a mais.

## 8. Gerenciamento de estado no frontend

**Decisão**: TanStack Query (React Query) para estado de servidor (dados vindos do Postgres/API) + estado local do React (`useState`/`useReducer`/Context) para estado de UI puramente efêmero (painel aberto, zoom do Canvas, seleção local).

**Por quê**:
- o backend já é a autoridade (CLAUDE.md §8) — o frontend não precisa de uma store global complexa espelhando regras de negócio, só precisa cache + revalidação de dados de servidor e reação a eventos Realtime (que disparam invalidação/atualização do cache do React Query);
- evita um store tipo Redux/Zustand só para reimplementar o que o backend já decide.

**Alternativa descartada**: Zustand/Redux como fonte única de estado global — desnecessário aqui porque não há lógica de negócio no cliente para centralizar; se surgir estado puramente de UI complexo (ex.: ferramentas do Canvas com muitas interações locais), Zustand pode ser adicionado pontualmente para essa fatia, sem virar a arquitetura inteira.

## 9. Canvas — Konva / react-konva

**Decisão**: `react-konva` sobre um `<canvas>` HTML5, com camadas: Background, Grid, Tokens, Fog of War (conforme CLAUDE.md §19).

**Por quê**:
- resolve seleção/drag/hit-testing de tokens sem reimplementar um mini scene-graph na mão;
- integra com React de forma direta (componentes por camada), mantendo o Canvas modular como pedido;
- suficiente em performance para o volume esperado (uma mesa pequena, dezenas de tokens, não milhares) em hardware modesto;
- mais simples que PixiJS/WebGL puro, que exigiria mais código de baixo nível para um ganho de performance que este projeto não precisa agora.

**Alternativa descartada**: WebGL/PixiJS — escalada natural se, no futuro, o número de tokens/efeitos visuais exigir GPU; não implementar isso agora (YAGNI).

A lógica de regras nunca fica dentro do código do Canvas — o Canvas só renderiza estado e envia intenções (mover, selecionar) para o backend.

## 10. RPGSystemEngine

**Decisão**: módulo TypeScript puro (`lib/engine/`), sem import de Drizzle, sem import de Next.js/HTTP, sem acesso a rede.

```text
lib/engine/
  ├─ types.ts        // tipos de domínio (Character, CreatureInstance, Effect, Action...)
  ├─ checks.ts        // testes de perícia/atributo
  ├─ combat.ts         // ataque, dano, defesa
  ├─ progression.ts    // progressão de carreira/perícias
  ├─ effects.ts        // aplicação/expiração de condições e efeitos
  └─ index.ts
```

Cada função recebe dados estruturados (o estado relevante já carregado) e retorna um resultado estruturado (novo estado + eventos a persistir/emitir). Quem carrega do banco e quem persiste é a camada de Route Handler, nunca o engine. Isso mantém o engine testável com `vitest` sem precisar de banco nem servidor rodando, e mantém a regra do CLAUDE.md §9 de não guardar lógica executável no banco — regras são dados estruturados interpretados pelo engine, nunca `character.hp += 10` solto em algum handler.

## 11. Testes

**Decisão**: Vitest para unit tests (prioridade máxima: `RPGSystemEngine` — cálculos, testes, combate, progressão, condições), Testing Library para componentes React críticos, Playwright reservado para poucos fluxos e2e de fato críticos (login, ação básica de combate ponta a ponta) quando essas telas existirem — não escrever e2e para tudo desde o início.

**Por quê**: CLAUDE.md §21 prioriza autenticação, permissões, regras do RPG, cálculos e persistência — isso é exatamente o que o engine e as Route Handlers cobrem; testar a fundo aqui, sem tentar cobrir 100% de UI com e2e caro de manter.

- **Testes de integração contra o banco real** ficam em `*.int.test.ts` e rodam com `npm run test:integration` (config própria, carrega `.env.local`); o `npm test` não os inclui. Criam os próprios dados e apagam ao final.

## 12. Compatibilidade com Vercel

- Next.js App Router: suporte nativo.
- Route Handlers/Server Actions: rodam como Vercel Functions, sem servidor próprio.
- Drizzle + Postgres (Supabase): conexão via variável de ambiente (`DATABASE_URL`), compatível com funções serverless (usar o driver/pooler recomendado pela Supabase para ambiente serverless, para evitar esgotar conexões).
- **Migrations precisam de conexão separada, fora do pooler em modo transaction.** Descoberto na prática (etapa 2): rodar `drizzle-kit migrate` contra o pooler em modo "transaction" (porta 6543, o mesmo usado em runtime) engole comandos DDL silenciosamente — o comando reporta sucesso e grava a migração como aplicada, mas a tabela nunca é criada. `drizzle.config.ts` usa `DIRECT_URL` (mesma credencial, porta 5432, modo "session", sem `pgbouncer=true`) só para migrations; `DATABASE_URL` (pooler) continua sendo a conexão de runtime do app.
- **Sem pipelining no pooler em modo transação** (achado na etapa 21): com várias consultas em paralelo, o driver `postgres` empilha consultas numa conexão ocupada; o pooler (Supavisor, porta 6543) deixa a conexão do servidor presa em `ClientRead` e o pool trava (a mesa levava minutos e dava erro). `src/lib/db/index.ts` usa `max_pipeline: 0`. Efeito colateral: `db.transaction`/`sql.begin` não funcionam (o driver não reserva a conexão); o que precisa ser atômico vira **um comando só** (CTE), como `createTable`. O cliente e o catálogo ficam em `globalThis` para o `npm run dev` não abrir um pool novo a cada recarga.
- Realtime: o cliente conecta diretamente ao Supabase Realtime (WebSocket gerenciado pela Supabase, não pela Vercel) — a Vercel não precisa segurar conexões persistentes, o que evita o principal ponto de atrito de WebSockets em serverless.
- Variáveis de ambiente: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (uso restrito ao servidor).
- **Next.js 16 renomeou o arquivo `middleware.ts` para `proxy.ts`** (mesma função, export renomeado de `middleware` para `proxy`) — usado para renovar a sessão do Supabase a cada request e bloquear rotas protegidas no edge/servidor antes de renderizar.

## 12.1 Segurança (revisão da etapa 6)

- **Autorização no backend.** O banco é acessado com a conexão privilegiada (ignora RLS), então toda checagem de permissão fica no servidor (`src/lib/mesas/queries.ts`); a RLS das tabelas é só defesa em profundidade caso o cliente Supabase passe a consultá-las. Quem não participa de uma mesa recebe "não encontrada".
- **Redirecionamentos** só para caminhos internos (`src/lib/auth/redirect.ts`, usado por login e confirmação de e-mail); bloqueia `//host`, `/\host` e URLs absolutas.
- **Cabeçalhos** em `next.config.ts`: nosniff, Referrer-Policy, Permissions-Policy, HSTS e uma CSP parcial (`frame-ancestors`, `base-uri`, `form-action`, `object-src`). CSP com `script-src` exigiria nonce (o Next injeta scripts inline); fica para quando houver necessidade.
- **Sessão** via `@supabase/ssr`: os cookies não são `httpOnly` porque o cliente do navegador também os lê (limitação conhecida da biblioteca); tokens de acesso são de curta duração, com rotação do refresh token.
- **Segredos**: o app não usa a chave de serviço do Supabase (`SUPABASE_SERVICE_ROLE_KEY`); ela só serve a scripts locais de teste e não deve ir para o deploy.
- **Pendências para antes de abrir ao público**: limitar tentativas de login e de código de convite (o Supabase Auth já limita por IP, mas chamadas vindas da Vercel compartilham IPs de saída; avaliar um limitador compartilhado, como Upstash), cadastrar em Authentication > URL Configuration do Supabase apenas os domínios reais em `Site URL`/`Redirect URLs`, e revisar a política de senha no painel.

## 13. Riscos e pontos de escalada futura

- **Volume de eventos por mesa**: se no futuro o jogo exigir sincronização muito frequente (ex.: arrastar token em tempo real quadro a quadro, não só posição final), Broadcast do Supabase ainda resolve, mas vale reavaliar; um servidor de sala com estado em memória (Durable Object/PartyKit) só se justifica se isso se tornar o caso comum, não o de exceção.
- **Pooling de conexões Postgres em serverless**: precisa usar o pooler da Supabase (ou Drizzle com driver HTTP) desde o início para não esgotar conexões sob concorrência, mesmo que baixa.
- **Regras do sistema ainda não analisadas**: o `RPGSystemEngine` acima é estrutural; o conteúdo real (fórmulas de teste, dano, progressão) depende da leitura do manual (`manual/Reinos de Ferro - Livro Básico...pdf`), ainda não feita nesta etapa. Isso vai para `docs/regras-rpg.md` em etapa futura, não deve ser suposto aqui.
- **Modelo de dados detalhado**: também não definido nesta etapa (fica para `docs/modelo-de-dados.md`), depende das regras reais do sistema.

## 14. Resumo das escolhas

| Camada | Escolha |
|---|---|
| Frontend | Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui |
| Backend | Route Handlers / Server Actions do Next.js (sem servidor separado) |
| Banco | Postgres (Supabase) |
| ORM | Drizzle |
| Autenticação | Supabase Auth |
| Realtime | Supabase Realtime (Presence + Broadcast separados da persistência) |
| Estado no frontend | TanStack Query + estado local React |
| Canvas | react-konva (Background/Grid/Tokens/Fog em camadas) |
| RPGSystemEngine | TypeScript puro, sem I/O, em `lib/engine/` |
| Testes | Vitest (prioridade: engine) + Testing Library + Playwright pontual |
| Deploy | Vercel (app) + Supabase (dados/auth/realtime) |
