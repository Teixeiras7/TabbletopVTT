# Modelo de dados — Reinos de Ferro TabletopVTT

Status: proposta (etapa 5). Só o que está marcado como **implementado** existe no banco. O resto é desenho para orientar as próximas etapas; cada grupo de tabelas só é criado quando a funcionalidade que o usa for implementada (CLAUDE.md §3 e §23).

Base: `docs/regras-rpg.md` e `docs/regras/`. Convenções de CLAUDE.md respeitadas: catálogo x instância (§10), regras como dados estruturados e nunca código no banco (§9), valores derivados calculados pelo engine (§12), backend como autoridade (§8, §17).

## 1. Princípios

1. **Catálogo x instância.** Definições vêm do manual e são iguais para todas as mesas (só leitura para o app). O que muda durante o jogo (dano, posição, efeitos, munição) pertence a uma instância, dentro de uma mesa.
2. **Nada derivado é gravado.** DEF, ARM, Iniciativa, VON, ACO, ADI, alcance de comando, total de perícia, capacidade da espiral vital, sistemas enfraquecidos de gigante e estágio (Herói/Veterano/Épico) são calculados pelo engine a partir do que está gravado.
3. **Regras em dados estruturados.** Efeitos, pré-requisitos e propriedades de itens ficam em colunas `jsonb` com formato validado por zod (mesmos tipos do engine). Nunca JavaScript, nunca `hp += 10`.
4. **Identificador estável no catálogo.** Toda linha de catálogo tem um `slug` (ex.: `arma-de-mao`, `durao`) usado como chave. Isso permite seed idempotente e referências dentro de JSON. Cada linha guarda `source_page` para rastrear no manual.
5. **Tudo do jogo pertence a uma mesa** (`table_id`). Permissão: Mestre edita qualquer ator da mesa; jogador edita apenas o próprio personagem; quem não participa não vê nada (mesmo padrão já usado em `game_tables`).
6. **Poucas tabelas.** Onde o formato varia por tipo (itens, magias, habilidades), uma tabela com `kind` + `jsonb` em vez de dez tabelas quase iguais. Onde a consulta é frequente e o formato é fixo (atributos por raça, perícias por carreira), tabelas relacionais.

## 2. Visão geral

```text
profiles ──< game_table_members >── game_tables                  (implementado)
                                        │
                                        ├──< scenes ──< tokens              (implementado, marcador simples — ver nota)
                                        │
                                        ├──< actors  (supertipo, ainda não existe)
                                        │      ├── characters        (PJ e PdM detalhado)
                                        │      ├── creature_instances ─── creatures (catálogo)
                                        │      └── giant_instances    ─── chassis, cortexes (catálogo)
                                        │
                                        ├──< combats ──< combat_participants >── actors
                                        ├──< active_effects >── actors
                                        └──< game_events            (log append-only)

Catálogo (global, seed do manual):
races, archetypes, careers, skills, abilities, spells, spell_lists, items,
creatures, chassis, cortexes, conditions, progression_table
```

**Nota (etapa 7)**: `tokens` foi implementado antes de `actors` existir. Hoje um token é só `label` + `color` + posição, sem ligação com personagem/criatura — é um marcador que o Mestre nomeia à mão. Quando `actors`/`characters` existirem (fases B/C), `tokens` ganha uma `actor_id` opcional; até lá, isso é uma simplificação deliberada (CLAUDE.md §3: usar o que existe, não simular personagem como pronto), não um desvio do desenho.

### Por que um supertipo `actors`

Personagens, criaturas e gigantes-a-vapor têm em comum o que o jogo pede o tempo todo: posição no mapa, iniciativa, dano, efeitos ativos, serem alvo de ataque. Sem um supertipo, cada uma dessas tabelas precisaria de três chaves estrangeiras opcionais (personagem, criatura ou gigante) ou de um par `tipo + id` sem integridade. Com `actors(id, table_id, kind)`, tokens, combate e efeitos apontam para uma única chave; cada subtipo tem `actor_id` como chave primária. É o mesmo princípio de catálogo x instância do CLAUDE.md §10: "Orc #1" e "Orc #2" são dois `actors`.

## 3. Já implementado (nomes em português desde a etapa 18; `src/lib/db/schema.ts` é a referência)

| Tabela | Conteúdo |
|---|---|
| `perfis` | id = id do Supabase Auth, `nome` |
| `mesas` | `nome`, `descricao`, `dono_id` (= Mestre), `codigo_convite` único |
| `membros` | participantes (o criador também); papel derivado: dono = Mestre, demais = Jogador. `chat_limpo_em` = "limpar chat" pessoal |
| `mensagens` | chat: `mesa_id`, `autor_id`, `autor_nome`, `texto`. Só as **últimas 100 por mesa** ficam |
| `personagens` | `escolhas` (ids do catálogo), `detalhes` (nome, idade…), `estado` (dano, ações gastas), `notas` (lista título + texto), `imagem_url`. Nada calculado é gravado |
| `infos` | aba Infos: `tipo` (imagem/nota), `nome`, `descricao`, `imagem_url`, `criado_por`, `oculta` |
| `cenas` | mapa da mesa: `tamanho_grid`, `fundo_url` |
| `tokens` | marcador no grid: `cena_id`, `rotulo`, `cor`, `x`/`y` (casa) |
| catálogo | `racas`, `arquetipos`, `carreiras`, `pericias`, `habilidades`, `magias`, `listas_de_magias`, `conexoes`, `acoes`, `progressao`, `equipamentos` (ver §4) |

## 4. Catálogo (seed do manual)

**Implementado**: uma tabela por tipo (`racas`, `arquetipos`, `carreiras`, `pericias`, `habilidades`, `magias`, `listas_de_magias`, `conexoes`, `acoes`, `progressao`, `equipamentos`), com colunas reais e jsonb só para regras aninhadas. `id` (texto, ex.: `armadura-completa`) é o que a ficha guarda. Fonte: `data/catalog/*.json` (gerados de `docs/regras/`, conferidos por `src/lib/catalog/catalog.test.ts`), carregados por `npm run db:seed` (apaga e recarrega numa transação). Sem policy: só o backend lê. `equipamentos` é a Lista de Preços (pp. 241-245, 294 itens: categoria, preço em CO, preço mínimo "5+", acréscimo "+10", tipo de armadura), ainda sem estatísticas de arma/armadura. Criaturas, gigantes e condições ainda não estão no catálogo; o desenho abaixo é o plano para eles.

Desenho original (mantido como referência do que ainda falta):

Fonte da verdade: arquivos de seed no repositório (`data/catalog/*.json`), validados por zod e aplicados por upsert em `slug`. O banco não é editado à mão. Cada conjunto só entra depois que as tabelas do manual correspondentes forem conferidas contra o PDF (ver `docs/regras-rpg.md` §5).

| Tabela | Campos principais | Fonte |
|---|---|---|
| `races` | slug, nome, tamanho de base, restrições (jsonb) | regras/01 |
| `race_attributes` | race, atributo, inicial, limite Herói, Veterano, Épico | regras/01 |
| `archetypes` | slug, nome, efeito base, benefícios (jsonb: efeito, custo em PdF, frequência) | regras/01 |
| `careers` | slug, nome, pré-requisitos (jsonb), iniciais e bens (jsonb), `spell_list_id` | regras/01, 02 |
| `career_skills` | career, skill, inicial?, nível inicial, nível máximo | regras/01, 02 |
| `career_abilities` | career, ability, inicial? | regras/02 |
| `skills` | slug, nome, categoria (militar, profissional, geral), regra de atributo (jsonb), multi-escolha, uso sem treino, nível máximo por estágio | regras/03 |
| `abilities` | slug, nome, pré-requisitos (jsonb), repetível, efeitos (jsonb), texto | regras/02, 03 |
| `spells` | slug, nome, custo, alcance e área (jsonb, tipados), POD, manutenção, ofensiva, efeitos (jsonb) | regras/05 |
| `spell_lists` / `spell_list_entries` | lista por carreira, elemento ou divindade; magia pertence a várias listas | regras/05 |
| `items` | slug, `kind`, nome, custo em CO, `stats` (jsonb validado por `kind`), `source_page` | regras/06, 07 |
| `creatures` | slug, nome, PE, atributos já resolvidos (jsonb), vitalidade (ver §7), base, habilidades e armas por referência | regras/09 |
| `chassis` | slug, categoria, atributos, base, combustível, tabela de dano (ver §7) | regras/08 |
| `cortexes` | slug, classe, custo, INT/PER, flags | regras/08 |
| `conditions` | slug (derrubado, imóvel, nocauteado, abalado, angústia, pânico, fogo, corrosão…), definição (jsonb: modificadores, restrições, regra de término) | regras/04 |
| `progression_table` | estágio, XP total, tipo de progressão concedida | regras/02 |

Notas:
- **`items.kind`**: `weapon`, `armor`, `shield`, `ammo`, `gear`, `clothing`, `mount`, `consumable`, `mechanika` (cárter, capacitor, placa rúnica), `alchemy` (receita, ingrediente), `giant_weapon`. Propriedades de arma (`reach`, `twoHanded`, `strengthMin`, `feat`, `chargeBonus`…) são tags em `stats`, interpretadas pelo engine. Variantes por empunhadura ou montaria são "modos de uso" dentro de `stats`, não linhas duplicadas.
- **Atributos de criatura** são totais já resolvidos no livro (Detectar, Esgueirar-se prontos; FIS = FOR, MAE = ACO), então não se recalcula a partir de perícias.
- **Conexões** (regras/03) são textuais, sem mecânica numérica: tabela pequena de tipos, sem automação.

## 5. Personagem

Persistente entre sessões, pertence a uma mesa (`table_id`) e a um usuário. PdM detalhado (Abrangente, Carreira Única, Batalha) é um `character` com `is_npc = true` e dono = Mestre; PdM Simples e monstros são criaturas.

| Tabela | Conteúdo |
|---|---|
| `characters` | personagem de um jogador numa mesa: `table_id`, `owner_id`, `name`, `choices` (jsonb: só as escolhas da criação), `details` (jsonb: idade, nacionalidade, filiação, organização, altura, peso, crimes, aparência), `image_url` (Storage `character-images/<mesa>/<personagem>/image`) e `state` (jsonb: dano marcado por ramo da espiral vital e ações já gastas no turno). **Nada calculado é gravado**: a ficha é montada na hora pelo engine. **Dossiê** (nome, imagem, dados pessoais): todo participante. **Ficha completa, notas, estado e edição**: só o dono e o Mestre (RLS e backend). Lista atualizada por aviso `characters:<mesa>` |
| `character_notes` | notas do personagem (título e texto); só o dono e o Mestre leem e editam |
| `character_attributes` | character, atributo, valor **base** (comprado). Bônus temporários são efeitos, não alteram esta linha |
| `character_careers` | character, career, posição (1 ou 2), carreira inicial? |
| `character_skills` | character, skill, especialidade (Ofício, Conhecimento), nível |
| `character_abilities` | character, ability, vezes escolhida (repetíveis, Vínculo) |
| `character_spells` | character, spell |
| `character_connections` | character, tipo, descrição |
| `character_advancements` | character, sequência, tipo de progressão, escolha (jsonb), data. **Só acrescenta.** Registra o que foi escolhido em cada ganho de XP; o backend revalida cada escolha (CLAUDE.md §13) |
| `inventory_items` | character, item, quantidade, `equipped_slot` (null = só no inventário), `in_use`, estado da instância (jsonb: munição carregada, carga do capacitor) |
| `bonds` | Vínculo (regras/03): character, alvo (arma mekânica, armadura de conjurador ou gigante), espaço |

Estados do item (CLAUDE.md §14): **possuído** = existe linha em `inventory_items`; **no inventário** = `equipped_slot` nulo; **equipado** = `equipped_slot` preenchido; **em uso** = `in_use` (arma em punho, granada com pino puxado); **consumido** = quantidade zerada e linha removida. Custo de ação vem do catálogo e o engine só cobra em combate.

## 6. Instâncias de mesa

| Tabela | Conteúdo |
|---|---|
| `actors` | id, table_id, kind (`character`, `creature`, `giant`) |
| `creature_instances` | actor_id (PK), creature, rótulo ("Orc #1"), vitalidade atual, escolhas sorteadas na criação (ex.: armas do Mestre do Saque), pontos de façanha |
| `giant_instances` | actor_id (PK), chassis, cortex, controlador (actor), caixas de dano marcadas, foco, impressão e melhorias (jsonb), itens montados (jsonb), efeitos catastróficos ativos |
| `scenes` | table, nome, tamanho de célula do grid **(implementado; fundo/névoa/dimensões ficam para quando o Canvas precisar)** |
| `tokens` | scene, x, y **(implementado sem `actor` — ver nota da §2; face e tamanho por base ficam para quando houver personagem/criatura de verdade)** |
| `active_effects` | table, actor alvo, definição (slug de `conditions` ou jsonb inline), origem (magia, habilidade, item, ator), duração (rodadas restantes, até início do turno, encontro, mantida), rodada de início |
| `combats` | table, scene, estado, rodada atual, ator ativo |
| `combat_participants` | combat, actor, iniciativa rolada, posição na ordem, ação adiada?, ações gastas no turno (jsonb: rápidas, ataque, completa) |
| `game_events` | table, `seq` crescente, tipo, ator, payload (jsonb), data. **Log só de acréscimo** |

Adicionar a mesma criatura várias vezes cria várias `creature_instances`, cada uma com o próprio `actor`, vitalidade e efeitos (CLAUDE.md §11). A definição em `creatures` nunca é duplicada.

### Efeitos ativos

Um efeito guarda o suficiente para o engine decidir tudo sem código específico:

```ts
// ilustrativo, formato final definido junto com o engine
type Effect = {
  name: string;                 // efeitos de mesmo nome não acumulam; fontes diferentes acumulam (regras/04 §2.5)
  source: EffectSource;         // magia | habilidade | item | ator
  target: "self" | "aura" | ...;
  modifiers: { stat: Stat; value: number; when?: Condition }[];
  restrictions?: Restriction[]; // ex.: "não pode ser derrubado"
  duration: { kind: "rounds" | "until_turn_start" | "encounter" | "permanent" | "maintained"; n?: number };
  end?: { roll: "1d6"; endsOn: [1, 2] };  // término de efeito contínuo
};
```

### `game_events`

É o que torna o realtime recuperável (`docs/arquitetura.md` §7.2): o servidor grava o resultado de cada ação (rolagem, ataque, dano, efeito aplicado) com um `seq`, publica o evento no Broadcast e, se um cliente reconectar, ele pede "tudo depois do seq N". Também serve de histórico da sessão e de auditoria das decisões do engine. Presence (quem está online) **não** é gravada.

## 7. Vitalidade: três formatos, um contrato

| Formato | Quem usa | Estado gravado |
|---|---|---|
| **Espiral vital** | personagens e criaturas poderosas | marcas de dano por ramo: `marks[1..6]` |
| **Valor simples** | criaturas comuns (ex.: Dregg Instiga-dor, vitalidade 12) | dano sofrido (número) |
| **Tabela de dano em grade** | gigantes-a-vapor | caixas marcadas por coluna |

O catálogo diz qual formato a criatura usa; a instância guarda só o estado. O engine expõe a mesma operação para os três (aplicar dano, saber se está debilitado, recuperar).

### Espiral vital (lida no PDF, p. 104, 148, 211 e ficha)

- **6 ramos numerados de 1 a 6, dois por aspecto**: 1-2 Físico, 3-4 Agilidade, 5-6 Intelecto. O 1d6 do dano escolhe o ramo diretamente. A ordem numérica é a ordem horária.
- Cada aspecto tem tantos círculos disponíveis quanto o atributo primário (FIS, AGI, INT), divididos o mais igualmente possível entre seus dois ramos. Os círculos não usados são riscados **de fora para dentro**.
- Dano marca o círculo mais externo disponível do ramo sorteado, indo para dentro; ramo cheio transborda para o próximo ramo em sentido horário com círculo livre (6 volta ao 1).
- Tamanho máximo desenhado na ficha (contagem na figura): **Físico 10 círculos, Agilidade 8, Intelecto 8**. Bate com o Estivador (gigante-de-trabalho pesado, FIS 10). A divisão em dois ramos iguais (5+5, 4+4) é inferência da figura, não texto do livro.
- Aspecto sem círculos disponíveis = enfraquecido (Físico −2 FOR; Agilidade −2 nos ataques; Intelecto −2 DEF e não mantém magia). Todos os aspectos zerados = debilitado, depois incapacitado com rolagem de lesão.
- **Capacidade é derivada do atributo**, então mudar o atributo (permanente) recalcula a capacidade sem migrar dado; as marcas ficam em `marks`.
- **Em aberto**: quando o atributo é ímpar, qual ramo fica com o círculo a mais. O texto diz só "o mais igualmente possível". O engine terá essa escolha isolada em uma constante, para ser trocada sem mexer no banco.

### Tabela de dano do gigante-a-vapor (p. 291-292)

Grade de 6 colunas (1d6 escolhe a coluna) com caixas de cima para baixo. Caixa em branco = casco; caixa com letra = sistema (**A** nodo de arco, **C** córtex, **M** movimento, **B** armas da cabeça, **E**/**D** armas do braço esquerdo/direito). Dano marca do topo para baixo; coluna cheia transborda para a direita (6 volta à 1). Um sistema está enfraquecido quando todas as suas caixas estão marcadas (derivado, não gravado). No catálogo, cada chassi guarda a grade como `columns: Cell[][]` com `Cell = "hull" | "A" | "C" | "M" | "B" | "E" | "D"`; a instância guarda as marcas por coluna. Os valores de cada chassi vêm do PDF na hora do seed.

## 8. Fases de implementação

| Fase | Tabelas | Depende de | Destrava |
|---|---|---|---|
| A (feito) | profiles, game_tables, game_table_members | — | Minhas Mesas, Lobby |
| D parcial (feito, etapa 7) | `scenes`, `tokens` (sem `actor`, marcador simples) + Presence em tempo real | — (adiantada; ver nota da §2) | grid com tokens do Mestre e "quem está online" |
| B | `skills`, `abilities`, `races`, `race_attributes`, `archetypes`, `careers` (+ filhas), `progression_table` | conferir tabelas de raça e progressão no PDF | criação de personagem, Compendium |
| C | `characters` e filhas, `actors`, `inventory_items`, `items` (armas e armaduras primeiro) | fase B | ficha, inventário, equipamentos |
| D completa | ligar `tokens.actor_id` a `actors` | fases B, C | token = personagem/criatura de verdade |
| E | `creatures`, `creature_instances`, `conditions`, `active_effects` | fase C | Bestiário, condições |
| F | `combats`, `combat_participants`, `game_events` | fases D e E | combate e realtime recuperável |
| G | `spells`, `spell_lists`, `chassis`, `cortexes`, `giant_instances`, mekânica, alquimia | fases C a F | magia, gigantes |

`game_events` pode entrar antes da fase F se o Canvas precisar de resincronização (fase D). Cada fase é uma migration própria e vem com testes de permissão e persistência (CLAUDE.md §21).

## 9. Decisões e pendências

**Decididas neste desenho** (revisáveis antes da fase correspondente):
- Supertipo `actors` para tokens, combate e efeitos.
- Papel Mestre/Jogador continua derivado do dono da mesa, sem coluna.
- Personagem pertence a uma mesa (XP e progressão são por campanha). Se depois for preciso reutilizar personagem entre mesas, o ajuste é local em `characters`.
- Catálogo em tabelas com `slug` e `jsonb`, seed em arquivos versionados; itens em uma tabela com `kind`.

**Pendentes** (ver `docs/regras-rpg.md` §5):
- Ramo que recebe o círculo extra em atributo ímpar (§7).
- Tabela de progressão "Épico" idêntica à do "Veterano": não modelar o limite entre estágios antes de conferir a p. 152 no PDF.
- Arredondamento de metades com ",5" e ARM contra fogo/corrosão: afetam o engine, não o esquema.
- Catálogo próprio de uma mesa (regras da casa) não está modelado; se vier, será `table_id` opcional nas linhas de catálogo.
- Companhia de aventureiros (regras/02) é dado de mesa opcional; entra só se for pedida.
