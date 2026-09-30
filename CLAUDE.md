# Antes de qualquer coisa, utilize os recursos que temos quando necessário.

RTK, Agent Skills, Ponytail, Headroom, Impeccable, shadcn UI MCP

# Reinos de Ferro TabletopVTT

## 1. Objetivo do projeto

Este projeto é um TabletopVTT para jogar Reinos de Ferro com um grupo pequeno de jogadores.

O projeto será desenvolvido completamente do zero.

O objetivo é oferecer uma experiência de mesa virtual prática, responsiva e agradável, permitindo que o sistema automatize a maior parte possível das regras, cálculos e estados necessários durante uma sessão.

A solução deve ser simples o suficiente para ser mantida por uma equipe pequena e funcionar com baixo custo, sem sacrificar a qualidade da experiência.

A arquitetura deve ser simples.

A interface deve ter qualidade de produto real.

---

## 2. Princípios gerais

Prioridades:

1. funcionamento correto;
2. fidelidade às regras de Reinos de Ferro;
3. integração entre funcionalidades;
4. experiência de uso;
5. simplicidade técnica;
6. performance;
7. facilidade de manutenção.

Evite:

* overengineering;
* abstrações sem necessidade;
* dependências desnecessárias;
* duplicação de lógica;
* sistemas genéricos demais;
* funcionalidades fictícias;
* complexidade criada apenas por preferência arquitetural.

Antes de modificar uma parte importante do projeto, analise o que já existe e preserve o que estiver funcionando.

Prefira soluções simples, claras e fáceis de manter.

---

## 3. Desenvolvimento por etapas

O projeto será desenvolvido de forma incremental, através de etapas.

Cada etapa deve trabalhar sobre o estado atual do projeto.

Ao iniciar uma etapa:

* leia este `CLAUDE.md`;
* leia os documentos relevantes em `docs/`;
* analise o código existente;
* compreenda as decisões já tomadas;
* não recrie funcionalidades existentes;
* preserve as integrações já funcionando;
* implemente apenas o necessário para a etapa atual.

Cada funcionalidade deve ser integrada à estrutura existente.

Não crie telas ou sistemas isolados apenas para "integrar depois" quando a integração puder ser feita desde o início.

Funcionalidades futuras podem possuir estruturas preparadas para integração, mas não devem ser simuladas como concluídas.

Ao finalizar uma etapa:

* execute os testes disponíveis;
* execute lint e verificação de tipos quando disponíveis;
* execute build quando apropriado;
* corrija problemas introduzidos;
* atualize a documentação relevante;
* atualize `docs/progresso.md`.

---

## 4. Interface e experiência

A interface deve ter aparência de um produto real.

Evite aparência de:

* projeto acadêmico;
* dashboard administrativo genérico;
* template pronto;
* excesso de cards;
* excesso de elementos decorativos;
* interface sem hierarquia.

Priorize:

* hierarquia visual;
* tipografia adequada;
* espaçamento consistente;
* componentes reutilizáveis;
* organização clara;
* feedback visual;
* loading;
* estados vazios;
* erros;
* transições sutis;
* animações discretas;
* boa utilização do espaço.

A qualidade visual deve existir desde as primeiras telas.

Não deixe a parte visual para o final.

---

## 5. Responsividade

O sistema deve funcionar corretamente em:

* desktop;
* tablet;
* celular.

Mobile não deve ser tratado apenas como uma versão reduzida do desktop.

Considere:

* toque;
* rolagem;
* tamanho dos elementos interativos;
* navegação;
* painéis;
* ficha;
* inventário;
* combate;
* Canvas.

As funcionalidades principais devem continuar utilizáveis em telas pequenas.

---

## 6. Infraestrutura e deploy

O sistema deve ser projetado desde o início pensando em deploy na Vercel.

A arquitetura final deve ser compatível com a infraestrutura escolhida para o projeto.

Quando uma funcionalidade exigir infraestrutura externa, avalie uma solução simples e adequada ao tamanho do projeto.

Não aumente a complexidade arquitetural apenas para evitar uma dependência externa.

A escolha concreta das tecnologias deve ser registrada em `docs/arquitetura.md`, e não transformada em regra fixa neste arquivo.

---

## 7. Reinos de Ferro e o manual

O manual fornecido de Reinos de Ferro é a principal fonte das regras do RPG.

Antes de implementar regras importantes, consulte o manual e a documentação derivada dele.

Não invente regras.

Não substitua regras do manual por convenções de outros RPGs.

Quando uma regra não estiver clara:

* registre a dúvida;
* documente a interpretação;
* não trate uma suposição como fato;
* evite implementar comportamentos irreversíveis baseados apenas em suposição.

As regras analisadas devem ser documentadas em:

`docs/regras-rpg.md`

---

## 8. Arquitetura orientada às regras

As regras do RPG são parte central do sistema.

O frontend não deve ser responsável pela lógica principal das regras.

Fluxo esperado:

```text
Interface
    ↓
Backend
    ↓
RPGSystemEngine
    ↓
Validação / cálculo / execução
    ↓
Persistência
    ↓
Atualização da interface
```

O backend deve ser a autoridade sobre ações e estados importantes.

O frontend pode apresentar opções, enviar solicitações e mostrar resultados, mas não deve decidir sozinho qual estado do RPG é válido.

---

## 9. Banco de dados e RPGSystemEngine

### Banco de dados

O banco deve armazenar dados estruturados do sistema e da sessão.

Exemplos:

* carreiras;
* perícias;
* habilidades;
* armas;
* armaduras;
* itens;
* magias;
* criaturas;
* condições;
* efeitos;
* progressão;
* personagens;
* inventário;
* equipamentos;
* instâncias;
* tokens;
* estado da mesa;
* estado de combate.

### RPGSystemEngine

O `RPGSystemEngine` deve executar as regras.

Exemplos:

* testes;
* cálculos;
* modificadores;
* requisitos;
* validações;
* ataques;
* defesa;
* dano;
* cura;
* efeitos;
* condições;
* progressão;
* ações;
* combate.

O engine deve ser desacoplado da interface.

Sempre que possível, mantenha a lógica do engine independente de banco, HTTP e detalhes de UI.

Não armazene JavaScript executável no banco.

Não faça algo como:

```text
character.hp += 10
```

Prefira dados estruturados que descrevam a regra e permitam ao engine interpretá-la.

---

## 10. Catálogo x instâncias

O sistema deve separar definições reutilizáveis de elementos específicos de uma mesa.

Exemplo:

```text
Creature
    Orc

CreatureInstance
    Orc #1
    Orc #2
    Orc #3
```

`Creature` representa a definição da criatura.

`CreatureInstance` representa uma ocorrência específica dentro de uma mesa.

As instâncias devem possuir estado independente.

Exemplo:

* Orc #1: 12 HP;
* Orc #2: 5 HP;
* Orc #3: 20 HP.

Informações específicas da sessão, como posição, HP, condições e estado de combate, devem pertencer à instância quando aplicável.

Esse princípio deve ser usado para outros elementos quando fizer sentido.

---

## 11. Compendium e Bestiário

O Compendium deve permitir consultar o conteúdo estruturado do RPG dentro do próprio VTT.

O Bestiário deve permitir ao Mestre pesquisar criaturas e utilizá-las na mesa.

Fluxo esperado:

```text
Criatura do catálogo
        ↓
Seleção do Mestre
        ↓
CreatureInstance
        ↓
Token
        ↓
Canvas
```

Adicionar a mesma criatura várias vezes deve criar instâncias independentes.

Não duplique a definição original apenas porque ela foi utilizada em mais de um lugar.

---

## 12. Personagens

Personagens devem utilizar dados reais do banco.

A ficha deve estar integrada:

* à sessão;
* ao banco;
* ao inventário;
* aos equipamentos;
* ao `RPGSystemEngine`;
* à progressão;
* às condições e efeitos.

Valores derivados devem ser calculados pelo sistema sempre que possível.

Evite duplicar informações derivadas sem necessidade.

---

## 13. Progressão

A progressão deve seguir as regras do sistema.

Quando houver uma escolha:

1. o backend identifica opções válidas;
2. o engine verifica requisitos;
3. a interface apresenta as opções;
4. o jogador escolhe;
5. o backend valida novamente;
6. o resultado é persistido.

O usuário não deve precisar digitar manualmente opções que já existem no catálogo.

---

## 14. Inventário e equipamentos

Diferencie corretamente:

* item possuído;
* item no inventário;
* item equipado;
* item em uso;
* item consumido.

O sistema deve representar diferentes comportamentos de itens e equipamentos sem criar exceções específicas para cada item.

Durante combate, custos de ação devem ser tratados pelas regras e pelo `RPGSystemEngine`.

Fora de combate, a economia de ações de combate não deve ser aplicada automaticamente.

---

## 15. Ações e combate

Não trate todas as ações como um simples contador genérico.

Quando uma habilidade, efeito ou regra conceder uma ação, o sistema deve verificar qual tipo de ação realmente está sendo concedida.

Uma regra que concede uma ação específica não deve automaticamente permitir qualquer ação disponível.

O engine deve considerar, quando aplicável:

* tipo da ação;
* contexto;
* requisitos;
* custo;
* alvo;
* estado;
* efeitos;
* restrições.

---

## 16. Condições, buffs e debuffs

Condições, buffs, debuffs e efeitos devem utilizar dados estruturados.

Quando necessário, um efeito pode representar:

* tipo;
* alvo;
* atributo;
* valor;
* duração;
* origem;
* condição;
* restrição;
* início;
* término.

O engine deve determinar:

* quais efeitos estão ativos;
* quais modificadores se aplicam;
* quando um efeito expira;
* quando pode ser removido;
* como altera os cálculos.

A estrutura deve ser reutilizável, mas não deve virar um sistema genérico sem relação com as regras reais do projeto.

---

## 17. Mestre e Jogador

Não deve existir seleção manual de função.

Regra:

```text
Criador da mesa → Mestre
Demais participantes → Jogadores
```

O backend deve determinar e proteger essas permissões.

O frontend apenas apresenta as ações permitidas.

Nunca confie somente na interface para segurança.

---

## 18. Multiplayer em tempo real

A sessão deve possuir uma fonte de verdade no servidor.

O sistema deve suportar sincronização em tempo real de estados relevantes da mesa.

A arquitetura deve diferenciar:

### Presence

Informações efêmeras, como:

* usuário conectado;
* presença na mesa;
* estados temporários de participação;
* outras informações que não precisam ser persistidas.

### Eventos em tempo real

Mensagens/eventos necessários para sincronizar a sessão, como:

* movimentação;
* alterações de estado;
* resultados de ações;
* mudanças relevantes no Canvas;
* eventos de combate.

### Persistência

O banco deve continuar sendo responsável pelo estado persistente da mesa.

O cliente não deve determinar sozinho estados importantes.

Não utilize polling como solução principal para a sincronização contínua da mesa quando existir uma solução de realtime adequada.

A tecnologia concreta de realtime deve ser definida em `docs/arquitetura.md`.

---

## 19. Canvas

O Canvas deve ser modular.

Estrutura inicial:

```text
Background
Grid
Tokens
Fog of War
```

Inicialmente utilize grid quadrado.

O Canvas deve cuidar da representação visual e das interações espaciais.

O backend continua sendo a autoridade sobre os dados da sessão.

Não coloque a lógica principal das regras do RPG ou do combate dentro do Canvas.

Priorize performance em computadores modestos e dispositivos móveis.

---

## 20. Documentação

A documentação deve ficar organizada em `docs/`.

Estrutura principal:

```text
docs/
├── arquitetura.md
├── regras-rpg.md
├── modelo-de-dados.md
└── progresso.md
```

`CLAUDE.md` contém regras permanentes do projeto.

Os arquivos em `docs/` contêm decisões, modelos, regras analisadas e progresso.

Não coloque no `CLAUDE.md` decisões temporárias ou detalhes específicos de implementação que possam mudar durante o projeto.

---

## 21. Testes

Funcionalidades importantes devem possuir testes.

Priorize:

* autenticação;
* permissões;
* regras do RPG;
* cálculos;
* progressão;
* inventário;
* equipamentos;
* combate;
* condições;
* efeitos;
* multiplayer;
* persistência.

Não considere uma funcionalidade concluída apenas porque a interface existe.

Ela deve funcionar de ponta a ponta.

---

## 22. Performance

O sistema deve funcionar bem em computadores modestos e dispositivos móveis.

Evite:

* consultas desnecessárias;
* renderizações excessivas;
* processamento pesado no frontend;
* duplicação desnecessária de estado;
* dependências sem necessidade.

Considere performance durante todo o desenvolvimento.

Não espere a etapNEXT_PUBLIC_SUPABASE_URL=a final para descobrir problemas estruturais de desempenho.

---

## 23. Regra principal

Antes de implementar qualquer funcionalidade, considere:

> Esta solução é necessária, está coerente com as regras de Reinos de Ferro, integra-se ao que já existe e mantém o projeto simples?

Quando a resposta for não, reavalie a abordagem.

O projeto deve evoluir de forma progressiva, integrada e coerente.

**Não implemente por implementar.**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
