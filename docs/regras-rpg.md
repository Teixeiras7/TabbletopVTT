# Regras de Reinos de Ferro — análise do manual

Fonte: *Reinos de Ferro RPG — Livro Básico* (Jambô, 2014, 344 p.), arquivo em `manual/`. Cobertura: capítulos 3 a 8 e o Bestiário (páginas 103 a 335). Os capítulos 1 e 2 (história e ambientação) não foram analisados por não conterem regras de jogo.

Este arquivo é o ponto de entrada. O detalhe completo (tabelas de catálogo com todos os campos, valores exatos, páginas) está em `docs/regras/`, um arquivo por parte. Nada aqui foi inventado: o que o texto não deixa claro está em **Dúvidas** e não deve ser tratado como fato (CLAUDE.md §7).

## 1. Como esta análise foi feita

- Texto extraído do PDF com `pdftotext` (layout preservado) e lido por partes.
- A extração perde a geometria de algumas tabelas e figuras. Onde isso aconteceu, cada parte registra a ambiguidade em sua própria seção "Dúvidas e ambiguidades".
- A leitura inicial foi só de texto. Depois, as páginas com figuras foram renderizadas como imagem e vistas (espiral vital, tabela de dano do gigante, modelos, bloco de criaturas); o resultado está em §5.1. O que ainda depende de conferência visual está listado lá.
- Página do PDF = página impressa + 1 (ex.: impressa 211 = PDF 212). Para reler uma figura: renderizar a página do PDF com `uv run --with pymupdf` (não instala nada global).
- Citações de página usam a numeração impressa no rodapé, que coincide com o sumário. Algumas partes foram extraídas por intervalo do PDF e podem apresentar deslocamento de ±1 página.

## 2. Índice dos arquivos de detalhe

| Arquivo | Conteúdo | Páginas |
|---|---|---|
| `regras/01-atributos-racas-carreiras.md` | atributos, criação de personagem, raças, arquétipos, carreiras (início) | 103-134 |
| `regras/02-progressao-habilidades.md` | carreiras (fim), experiência e progressão, catálogo de habilidades | 135-164 |
| `regras/03-pericias-conexoes.md` | habilidades S-V e Vínculo, perícias (regras e catálogo), conexões | 164-191 |
| `regras/04-o-jogo-combate.md` | testes, iniciativa, turno, movimento, ações, ataques, dano, lesões, condições, pontos de façanha, terreno, medo, luz. **Núcleo do engine** | 193-221 |
| `regras/05-magia.md` | tradições, área de controle, conjuração, catálogo de 160 magias e listas por carreira | 223-240 |
| `regras/06-equipamento-armas-armaduras.md` | preços, armaduras, armas corpo-a-corpo e à distância | 241-264 |
| `regras/07-equipamentos-mekanica-alquimia.md` | munição, equipamento, montarias, mekânica, alquimia | 265-288 |
| `regras/08-gigantes-a-vapor.md` | gigantes-a-vapor: atributos, dano, controle, desenvolvimento | 289-314 |
| `regras/09-mestre-bestiario.md` | regras mecânicas do Mestre (PdMs, encontros) e Bestiário | 315-335 |

A parte 04 traz ao final **20 casos de teste extraídos dos exemplos do livro**, prontos para virar testes do engine.

## 3. Glossário de siglas

Definidas no capítulo 4 (p. 193): FIS Físico, AGI Agilidade, INT Intelecto, FOR Força, VEL Velocidade, MAE Maestria, DES Destreza, ARC Arcano, PER Percepção, VON Força de Vontade, DEF Defesa, ARM Armadura, POD Poder, ALC Alcance, ADE Área de Efeito, BAB base-a-base, LdV linha de visão, PdF ponto de façanha, PJ/PdM personagem jogador/do Mestre, NA número-alvo, CO coroa de ouro.

Siglas que as partes marcaram como "não definidas" e que o capítulo 4 resolve:
- **BAB** = base-a-base (bases se tocando).
- **ACO / ADI** = jogada de ataque corpo-a-corpo / à distância (p. 203).
- **RJ** = rajada, tipo de ataque de área com modelo próprio (p. 208).
- **MAE** = Maestria; **DES** = Destreza.

## 4. Resumo do núcleo mecânico

Resumo para orientar a modelagem. Valores exatos, exceções e páginas estão em `regras/04-o-jogo-combate.md`.

- **Dados**: d6. Testes usam 2d6. "Dado adicional" soma dados à jogada; "ampliar" dá 1 dado adicional e só pode ser aplicado uma vez por jogada.
- **Teste de perícia**: `2d6 + atributo + nível da perícia` contra um número-alvo. Teste de atributo é o mesmo sem a perícia. Testes opostos comparam totais. NA típicos: 10-12 moderada, 13-15 complexa, 16+ difícil.
- **Automáticos e críticos**: 1 em todos os dados é falha automática; 6 em todos é sucesso automático (não vale para jogada de um só dado). Crítico: acerto com dois dados iguais.
- **Ataque**: `2d6 + atributo + perícia + modificador da arma` contra a DEF do alvo (corpo-a-corpo usa MAE, à distância usa DES, mágico usa ARC).
- **Dano**: `2d6 + POD` (corpo-a-corpo soma também a FOR). Cada ponto acima da ARM do alvo vira 1 ponto de dano. Explosão de ADE usa ½ POD.
- **Vitalidade**: espirais vitais em 3 aspectos (Físico, Agilidade, Intelecto), com pontos de vida iguais ao atributo primário. Zerar um aspecto o enfraquece; zerar tudo deixa debilitado e depois incapacitado, com rolagem na tabela de lesões (3d6).
- **Turno**: rodadas em ordem de iniciativa (`2d6 + Iniciativa`). Cada turno tem três fases: Manutenção, Controle, Ativação.
- **Ações**: por turno, 2 rápidas, ou 1 rápida + 1 de ataque, ou 1 completa. Habilidades podem conceder ações ou ataques específicos. Movimento em polegadas (1" = 2 m).
- **Efeitos contínuos**: no máximo um de cada tipo por personagem; término por 1d6 (1-2 termina) na Manutenção. Efeitos com mesmo nome não acumulam; de fontes diferentes acumulam.
- **Pontos de façanha**: 3 por sessão (máximo 3), ganhos por proezas, gastos em opções fixas (refazer teste, esquiva heroica, ação rápida extra, etc.).
- **Progressão**: por XP, em três estágios (Herói, Veterano, Épico), com escolhas de atributos, habilidades e perícias por carreira (personagem tem carreira dupla). Ver parte 02.
- **Magia**: catálogo de 160 magias com custo, alcance, área, duração e POD; conjurar é ação rápida; foco e fadiga limitam o uso. Ver parte 05.

## 5. Dúvidas consolidadas

Cada parte tem a lista completa. Aqui estão as que **bloqueiam ou distorcem** decisões de modelagem e engine. Enquanto não forem resolvidas (conferindo o PDF ou por decisão registrada), o engine não deve implementá-las como fato.

### 5.1 Figuras e tabelas

**Resolvido pela leitura das imagens**

1. **Espiral vital** (ficha, pp. 148 e 211): 6 ramos numerados de 1 a 6, dois por aspecto (1-2 Físico, 3-4 Agilidade, 5-6 Intelecto), então o 1d6 do dano escolhe o ramo direto; a ordem numérica é a horária (transbordo 6 → 1). Cada aspecto tem tantos círculos disponíveis quanto o atributo, riscando os não usados de fora para dentro. Máximo desenhado: Físico 10, Agilidade 8, Intelecto 8. Detalhes em `modelo-de-dados.md` §7.
2. **Tabela de dano dos gigantes** (pp. 291-292): grade de 6 colunas, caixas de casco em branco e caixas de sistema com letra (A, C, M, B, E, D). A estrutura está entendida; os valores de cada chassi ainda precisam ser lidos da imagem na hora do seed.
3. **Modelos** (p. 342): explosão (raios de 3", 4" e 5") com o modelo de desvio numerado de 1 a 6 (1 = direção do ataque) e rajada (6", 8", 10").
4. **Tabelas de raça e progressão** (item 5, 8 de §5.2): confirmadas corretas.

**Ainda dependem de conferência visual**

1. **Espirais das criaturas** Dregg Mestre do Saque, Filho do Porco Xamã, Senhor da Guerra e Thrullg (pp. 330-331, 335): a figura é legível, mas os valores ainda não foram transcritos. Só são necessários no seed do Bestiário.
2. **Valores da grade de cada chassi** (item 2 acima).
3. **Tabelas desalinhadas na extração**: raças (pp. 106-112), Comandar, Ciência Forense, Navegação e Sobrevivência (parte 03), Preço da Cura (p. 234), custos das runas (p. 276), linha do Sacerdote (p. 117). Conferir antes de virar seed.

### 5.2 Resolvido por imagem ou por releitura do texto (etapa 6)

5. **Tabelas de raça** (pp. 106-112, todas as 7 raças): conferidas contra a imagem. Os valores da extração de texto (Anão PER 3|4/6/7, Gobber PER 3|4/4/5, Ogrun FIS 6|7/8/9, Iosano INT 4|6/6/7, e todos os demais) **estavam corretos**; não havia erro de pareamento.
6. **Linha do Sacerdote** (p. 117, tabela "Lista de Carreiras"): confirmada — Humano / Dotado† / "apenas inicial" = não.
7. **Nyss, bônus de Iniciativa/PER** (p. 110): confirmado "+1 **nos testes de** Iniciativa e PER" — é bônus só no teste, não no valor do atributo/derivado. (Achado extra na mesma página: Nyss tem +3 ARM contra dano de frio e −3 ARM contra dano de fogo.)
8. **Tabela de progressão "Épico"** (p. 152): conferida por imagem — **não é erro**. As tabelas de Veterano e Épico são mesmo idênticas na faixa de XP (50-95) e nas progressões concedidas; cada estágio usa a mesma cadência de custos. A transição de um estágio para o outro é um evento separado (não determinado só pelo "XP Total" desta tabela) e continua sem regra explícita encontrada — não modelar o limite Herói→Veterano→Épico como um valor fixo de XP total até achar essa regra.
    - **Hipótese de trabalho do usuário (2026-09-28, não confirmada no texto)**: como as duas tabelas repetem o mesmo padrão, Épico poderia começar em XP total 95 (onde Veterano termina), em vez de ter um evento de transição separado. Revisar antes de implementar a Fase B — não tratar como decidido.
9. **ARM contra fogo e corrosão** (p. 214): resolvido pelo próprio texto. Fogo causa "uma **jogada de** POD 12 de dano de fogo" — mesma formulação da regra geral de dano (`2d6 + POD` vs ARM, ver §8.1 da parte 04) — logo **ARM reduz dano de fogo**. Corrosão causa "**1d3 pontos de dano**" (sem "jogada"), formulação diferente e mais direta — tratado como dano fixo que **ignora ARM**.
10. **Alcance "menor que" o ALC** (p. 228): resolvido pelo próprio texto — é literal, "menor que" (`distância < ALC`), não "menor ou igual".
11. **Limite de 1 magia ofensiva + 1 não ofensiva com manutenção** (p. 229): resolvido pelo próprio texto — o limite é **por alvo** (quantas magias com manutenção podem afetar um personagem ao mesmo tempo: no máximo 1 ofensiva + 1 não ofensiva), não um limite de quantas o conjurador consegue manter ao mesmo tempo (isso é limitado à parte por fadiga/foco).

### 5.3 Ainda em aberto (decisão registrada, não é erro de leitura)

12. **Arredondamento de metades** com ",5" (ex.: ½ POD ímpar): a regra geral diz "inteiro mais próximo", que não define o caso exato de ,5; só Esquiva Heroica diz explicitamente "para cima". **Decisão**: seguir "para cima" como padrão do engine (mesma direção do único caso explícito do livro), isolado numa constante nomeada para poder mudar sem tocar no resto do código.
10. **POD de magias**: coluna "—" convive com POD citado no texto (ex.: Congelamento Profundo, Fogo Estelar). Tratar o POD do texto como válido e reconciliar no modelo.
11. **Recarga da besta**: "ação completa" na arma, "ação rápida" na regra geral. Tratada a regra específica como prevalente (interpretação, não fato).
12. **Flecha explosiva** definida com valores diferentes nas pp. 264 e 287.
13. **DEF base 5** (derrubado/imóvel): não está dito se bônus de cobertura, ocultação e elevação somam à base.
14. **Peso e carga**: o livro não tem coluna de peso nem regra de carga de equipamento (só levantar/carregar por FOR).
15. **Frio Intenso** (magia, p. 235) não consta em nenhuma lista de carreira: omissão do manual ou perda de extração.
16. **XP por inimigo**: o capítulo do Mestre não traz tabela de XP por criatura; ganho de XP fica com o Mestre.

## 6. O que o engine já pode assumir com segurança

Regras claras, com exemplos numéricos no livro, sem dependência das dúvidas acima:

- Teste de perícia/atributo, números-alvo, sucesso e falha automáticos, crítico, testes opostos.
- Jogada de ataque e comparação com DEF; dano `2d6 + POD` contra ARM (excluindo fogo/corrosão até resolver a dúvida 6).
- Iniciativa, ordem de turno e as três fases; economia de ações (2 rápidas / 1+1 / 1 completa).
- Dano de queda, tabela de lesões (3d6), tabela de objetos e estruturas, testes de medo, tabela de luz, pontos de façanha.
- Regra de acúmulo e prioridade de efeitos (nome igual não acumula; fontes diferentes acumulam; "não pode" vence "pode").

A rolagem de dados (`src/lib/engine/dice.ts`) já existe e expõe os dados individuais, o que as regras de 1/6 automático e crítico exigem.

## 7. Próximas decisões que dependem desta análise

- **Modelo de dados**: escrito em `docs/modelo-de-dados.md`, com fases de implementação.
- **Verificação por imagem (etapa 6)**: as tabelas de raça, a linha do Sacerdote, o bônus do Nyss e a tabela de progressão foram conferidas contra o PDF e confirmadas corretas. As ambiguidades de arredondamento, ARM vs. fogo/corrosão e os limites de magia foram resolvidas relendo o próprio texto com mais atenção — nenhuma delas dependia de figura.
- **Seed do catálogo**: as tabelas em `docs/regras/` são a fonte, mas só depois da conferência visual dos itens pendentes de §5.1.
- **Ordem sugerida no engine**: testes de perícia e ataque/dano primeiro (regras firmes), depois turno e ações, depois efeitos e condições, por último magia.
