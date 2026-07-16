# PLAN_MUNDO_VIVO_V2 — Arquitetura de Evolução do Motor Narrativo

> Mapa de execução para os 4 Gaps arquiteturais do ecossistema Mundo Vivo do Nexus Literário (Base44).
> Documento de design — nenhuma linha deste plano deve ser implementada sem aprovação por gap.

## Princípio transversal (ler antes de tudo)

Todo subsistema que roda no fluxo manual (`orquestrador/entry.ts`) precisa de um espelho no fluxo autônomo (`simulacaoAutonoma/entry.ts`). Historicamente essa **paridade 1:1** foi a maior fonte de bugs do projeto. Regra: qualquer campo novo em um `response_json_schema` do Diretor Narrativo, qualquer novo passo de persistência, entra **nos dois arquivos** no mesmo commit. Reutilizar sempre as funções auxiliares já existentes em vez de reescrever:

| Função existente | Arquivo | Reutilizar para |
|---|---|---|
| `alocarPersonagens(sdk, novos)` | orquestrador | Gap 2 (forjar persona de personagem nascido de memória) |
| `invocarSuperagente(sdk, character, …)` | orquestrador | Gap 4 (já lê as últimas 15 `CharacterMemory` — reconciliação parcial automática) |
| `arquitetoDeGrafos(sdk, universeId, dados)` | ambos | Gaps 1–4 (espelhar objetos/memórias/eventos no grafo) |
| `sincronizarEstadoGlobal(sdk, …)` | orquestrador | Gap 3/4 (estado de tempo/clima/cenário) |
| `cobrarTributo(sdk, wallet, intencao)` | orquestrador | Gap 4 (cobrança dos ticks de fundo) |
| `compactarMemorias(sdk, character)` | orquestrador | Gap 4 (comprimir memórias off-screen que estouram `LIMITE_MEMORIAS`) |

---

## GAP 1 — Memórias renderizadas como história (flashback legível)

### Estado atual
`CharacterMemory` é criada via `bulkCreate` no fim de ambos os fluxos (bloco `// Atualização de memória compartimentada` no orquestrador; `// Atualização de Memória` na simulacaoAutonoma). É consumida só internamente por `invocarSuperagente` (últimas 15). Nunca chega à UI. `NarrativeBlock.type` é o enum `["USER","AI","SYSTEM"]`; `BlockItem.jsx` renderiza `USER` como bolha à direita e todo o resto como prosa serifada.

### Solução técnica
Introduzir o conceito de **Memória Evocada**: quando um gatilho da cena (um cheiro, um objeto, um nome) faz um personagem reviver algo, essa lembrança emerge como um bloco de história distinto (flashback), em primeira pessoa daquele personagem.

1. **Entidade `NarrativeBlock.jsonc`**: adicionar `"MEMORIA"` ao enum de `type`; adicionar campos opcionais:
   - `memoria_character_name` (string) — de quem é a lembrança.
   - `memoria_ref` (string) — `id` da `CharacterMemory` de origem (quando surge de uma memória já gravada) ou vazio (quando é gerada no próprio turno).
2. **Diretor Narrativo** (o `InvokeLLM` do "Orquestrador Narrativo Principal" no orquestrador, e o "Diretor Narrativo" na simulacaoAutonoma): estender o `response_json_schema` com:
   ```
   memorias_evocadas: array de {
     character_name: string,        // quem lembra (deve estar em cena/afetado)
     memoria: string,               // a lembrança em 1ª pessoa (será o texto do flashback)
     gatilho: string                // o que na cena disparou a lembrança
   }
   ```
3. **Persistência** (nos dois arquivos, logo após criar o `NarrativeBlock` de prosa): para cada item de `memorias_evocadas`, criar um `NarrativeBlock` `{ type: 'MEMORIA', content: memoria, pov_character_name: character_name, memoria_character_name: character_name }` E também gravar a mesma lembrança em `CharacterMemory` (para alimentar `invocarSuperagente` no futuro). Ordenação por `created_date` garante que o flashback apareça inline na `StoryPage` (a query `["blocks", id]` já ordena por `created_date`, 500).
4. **Frontend `BlockItem.jsx`**: novo branch para `block.type === "MEMORIA"` — card recuado, borda âmbar/sépia, itálico, ícone `Brain`/`History` (lucide-react) e rótulo "Memória de {memoria_character_name}". Visual deliberadamente distinto da prosa AI para o leitor entender que é uma camada temporal interna.
5. **(Opcional) Evocação ativa pelo usuário**: novo `SlashCommand` `/lembrar <personagem>` com `intencao_forcada: 'Continuar'` e `instrucao_adicional_sistema` que força o Diretor a evocar a memória mais marcante daquele personagem. Reaproveita o Interceptador de Slash Commands já existente (bloco `// Interceptador de Slash Commands`).

### Adaptação dos prompts
No prompt do Diretor Narrativo (ambos), acrescentar diretriz:
> "MEMÓRIA EVOCADA: se a cena natural e organicamente faz um personagem reviver uma lembrança (gatilho sensorial, objeto, nome, lugar), retorne em `memorias_evocadas` essa lembrança em primeira pessoa do personagem. Ela será renderizada como um flashback destacado — escreva-a como prosa literária curta, não como anotação. Não force: só evoque quando o gatilho existir de fato no texto do turno."

---

## GAP 2 — Spawn de personagem nascido de uma memória

### Estado atual
Personagens nascem por 3 caminhos: (a) `novos_personagens` do Diretor → `alocarPersonagens` + `Character.bulkCreate` (bloco `// Persistência` do orquestrador); (b) Forjador de Almas `CRIAR_NOVO` na simulacaoAutonoma; (c) menção direta na prosa autônoma (`ineditos` na simulacaoAutonoma). Nenhum deles nasce de uma **lembrança** de outro personagem.

### Solução técnica
Estender o mecanismo de Memória Evocada do Gap 1: uma lembrança pode conter uma **pessoa** que ainda não é um `Character`. Se a narrativa permitir que essa pessoa reapareça, o sistema a materializa com persona completa **derivada de como foi lembrada** (a psique dela nasce do trauma/afeto da memória).

1. Estender o item de `memorias_evocadas` (schema do Gap 1) com:
   ```
   personagem_evocado: {
     name: string,
     papel_na_memoria: string,      // "pai morto", "mentora desaparecida", "traidor"
     pode_reaparecer: boolean       // true se a história pode trazê-lo fisicamente de volta
   } | null
   ```
2. **Persistência** (nos dois arquivos): após materializar os flashbacks, filtrar os `personagem_evocado` com `pode_reaparecer === true` cujo `name` **não** esteja no `Set` de personagens existentes (o orquestrador já monta `const existentes = new Set(characters.map(c => c.name))`). Para cada um:
   - Chamar `alocarPersonagens(sdk, [{ nome, contexto: <texto da memória + papel_na_memoria> }])` — **reutiliza** o Sistema de Voz Única já existente, mas o `contexto` agora é a lembrança, então a verbosidade/vícios/estilo nascem coerentes com quem lembrou.
   - `Character.create` com `motivo_alocacao: 'Nascido de Memória de <quem lembrou>'`, `primeira_memoria` = o texto da lembrança, `estado_simulacao: 'ocioso'` (ou `'viajando'` se a memória sugere que ele está a caminho — ver Gap 4).
   - Se a prosa os traz fisicamente à cena, incluir o `name` em `characters_in_scene` no `Story.update` final.
3. Espelhar no grafo: o `dadosBrutos` enviado a `arquitetoDeGrafos` já contém a prosa; garantir que o nome do personagem evocado apareça no payload para virar nó `Personagem` ligado por uma aresta nova (ex. verbo `lembrado_por`) ao personagem que o evocou.

### Adaptação dos prompts
Acrescentar ao mesmo bloco de diretriz do Gap 1:
> "PERSONAGEM NASCIDO DE MEMÓRIA: se a lembrança evocar uma pessoa que não está entre os personagens já cadastrados e a história plausivelmente permite que ela reapareça (está viva, é relevante, foi só perdida de vista), preencha `personagem_evocado` com `pode_reaparecer: true`. O sistema vai forjar a personalidade dessa pessoa de forma coerente com a lembrança. Se a pessoa está definitivamente morta e não retornará, `pode_reaparecer: false` (ela vira só nó de memória no grafo)."

---

## GAP 3 — Persistência de cenário e objetos manipuláveis

### Estado atual
`story.cenario_atual` e `story.clima_atual` são strings sobrescritas a cada turno por `sincronizarEstadoGlobal` (orquestrador) / pelos campos `cenario_atualizado`/`clima_atualizado` do Diretor (simulacaoAutonoma). "Objeto" existe apenas como `tipo` de `GraphNode`, criado pelo `arquitetoDeGrafos` como espelho visual — sem estado próprio, sem posse, sem durabilidade entre turnos.

### Solução técnica
Criar a entidade de primeira classe **`WorldObject`** (estado durável), separada do `GraphNode` (espelho visual). O `GraphNode` continua sendo a projeção no grafo; o `WorldObject` é a fonte de verdade manipulável.

1. **Nova entidade `base44/entities/WorldObject.jsonc`**:
   ```
   universe_id (string, req)      // dono
   name (string, req)
   node_id (string)               // link para o GraphNode espelho (formato objeto_snake_case)
   tipo (string)                  // arma | artefato | chave | documento | consumivel | ...
   estado_atual (string)          // "enferrujada", "carregada", "quebrada em duas"
   localizacao (string)           // nome do cenário onde está
   posse_character_id (string)    // quem carrega agora (nullable)
   posse_character_name (string)
   propriedades (array<string>)   // "corta aço", "brilha no escuro"
   historico (array<string>)      // log append-only de manipulações por turno
   estado_simulacao (string)      // "intacto" | "consumido" | "perdido" | "destruido"
   ```
2. **Injeção no prompt do Diretor** (ambos): antes de gerar a prosa, buscar `WorldObject.filter({ universe_id })` cujos `localizacao` == `story.cenario_atual` OU `posse_character_id` ∈ personagens em cena, e injetar um bloco `[OBJETOS PRESENTES E SEU ESTADO DURÁVEL]` para o Diretor respeitar o estado real (ex.: uma espada já quebrada não pode ser brandida inteira).
3. **Diretor Narrativo** — estender o `response_json_schema` (ambos) com:
   ```
   objetos_manipulados: array de {
     name: string,
     tipo: string,                 // preenchido só se objeto inédito
     novo_estado: string,
     nova_localizacao: string,     // opcional
     novo_dono_character_name: string, // opcional (pegou, roubou, entregou)
     acao: string                  // "empunhou", "quebrou", "escondeu"
   }
   ```
4. **Persistência (upsert)** nos dois arquivos, após a prosa: para cada `objetos_manipulados`, buscar `WorldObject` por `name`+`universe_id`; se existe → `update` (novo estado/localização/posse + `push` no `historico`); se não existe → `create` com `node_id = objeto_<snake_case>`. Passar os objetos ao `arquitetoDeGrafos` via `dadosBrutos` para o nó `Objeto` refletir `estado_atual`.
5. **(Opcional) Cenário durável**: para preparar o Gap 4 (múltiplos locais), considerar uma entidade leve `Local` (universe_id, name, descricao_persistente, clima_local, objetos_presentes, personagens_presentes). No V2 pode ficar como stretch — o mínimo do Gap 3 é `WorldObject`. Se `Local` for adiado, manter `cenario_atual`/`clima_atual` na `Story`.
6. **Frontend (mínimo)**: `NodeDetails.jsx` já mostra nós `Objeto`; adicionar leitura do `estado_atual`. Opcional: painel "Objetos da cena" análogo ao `CharacterPanel.jsx`, alimentado por `WorldObject.filter`.

### Adaptação dos prompts
> "OBJETOS DURÁVEIS: os itens listados em [OBJETOS PRESENTES] têm estado persistente e real. Respeite-o (um item quebrado continua quebrado; um item que outro personagem carrega não está livre para pegar). Se um objeto for usado, alterado, movido ou trocar de dono neste turno, ou se um objeto inédito e relevante surgir, registre em `objetos_manipulados`. Só registre objetos com peso narrativo — não catalogue poeira."

---

## GAP 4 — Simulação paralela / off-screen (o maior desafio)

### Estado atual
Ambos os fluxos processam **uma única cena**: `characters.filter(c => characters_in_scene.includes(c.name) || c.name === current_pov_name)`. Quem está fora da lista fica **congelado**. `estado_simulacao` (`ocioso|interagindo|viajando|investigando`) e `ultima_interacao_com` **já existem** na `Character.jsonc` mas `estado_simulacao` só é escrito uma vez (quando o personagem é escolhido) e `ultima_interacao_com` não é usado. O estado do mundo (`data_hora_atual`, `cenario_atual`, `clima_atual`) é singular — um lugar, um momento.

### Solução técnica — arquitetura em 3 camadas

#### Camada A — Localização por personagem (pré-requisito barato)
Adicionar à `Character.jsonc`:
- `localizacao_atual` (string) — onde o personagem está no mundo, mesmo fora de cena.
- `viagem_destino` (string) e `viagem_ticks_restantes` (number) — para quem está `viajando`.
- `ultimo_tick_offscreen` (string) — timestamp do último processamento de fundo (evita reprocessar).

Quando o fluxo on-screen atualiza `characters_in_scene`, também seta `localizacao_atual = cenario_atual` para quem está em cena. Isso dá ao mundo um mapa implícito: agrupar off-screen por `localizacao_atual`.

#### Camada B — Motor de fundo (`simulacaoBackground/entry.ts`, função nova)
Processa quem está **fora** da cena on-screen, barato e resumido (nunca prosa completa):

1. Entrada: `{ storyId }`. Só roda se `story.background_vivo === true` (novo flag opt-in na `Story.jsonc`) — evita custo surpresa.
2. Buscar `Character.filter({ universe_id })` e separar `offscreen = personagens NÃO em characters_in_scene` com `estado_simulacao !== 'ocioso'`.
3. Agrupar `offscreen` por `localizacao_atual` (clusters de "meanwhile").
4. **Um `InvokeLLM` por cluster** (não por personagem — controle de custo), o "Cronista dos Bastidores": recebe os personagens do local, seus `estado_simulacao` e últimas memórias, e retorna um **resumo compacto** do que aconteceu entre eles neste intervalo + memórias isoladas por participante + eventual mudança de `estado_simulacao`/`ultima_interacao_com`.
5. Tratamento por estado:
   - `interagindo`: gera memória isolada para cada participante (reusa `CharacterMemory.bulkCreate`) e um `NarrativeBlock` `type: 'OFFSCREEN'` (novo no enum) de baixa proeminência ("Nos bastidores: …").
   - `viajando`: decrementa `viagem_ticks_restantes`; ao chegar a 0, seta `localizacao_atual = viagem_destino`, `estado_simulacao = 'ocioso'`, grava memória de chegada. Se `viagem_destino === story.cenario_atual`, adiciona o personagem a `characters_in_scene` (ele "entra em cena") e dispara reconciliação (Camada C).
   - `investigando`: gera memória de progresso da investigação (pistas encontradas).
6. Cobrança: reusar padrão `cobrarTributo`/constantes de custo, com custo reduzido por cluster (ex. 1 crédito de integração por cluster). Admin isento (mesmo `isAdmin` já usado).
7. Espelhar no grafo via `arquitetoDeGrafos` os eventos de bastidores relevantes (opcional, throttled — não a cada tick, para não inflar o grafo).

#### Camada C — Reconciliação quando os caminhos se cruzam
Quando um personagem com memórias off-screen acumuladas **reentra** na cena on-screen:
1. **Reconciliação automática (já quase de graça)**: `invocarSuperagente` **já lê as últimas 15 `CharacterMemory`**. Como a Camada B grava memórias isoladas durante a ausência, o personagem, ao voltar, **já age** coerente com o que viveu fora de cena, sem código novo. Este é o maior ganho de reuso do plano.
2. **Reconciliação visível ao leitor** (novo): no fluxo on-screen, ao detectar que um personagem recém-entrou (estava em `localizacao_atual` diferente e agora está em `characters_in_scene`), buscar as `CharacterMemory` dele criadas desde `ultimo_tick_offscreen` e emitir um bloco `MEMORIA`/`OFFSCREEN` de briefing ("O que {nome} viveu enquanto esteve fora") — **reutiliza o renderizador do Gap 1**.
3. **Consistência de mundo**: garantir que `data_hora_atual` avançou de forma coerente entre a cena on-screen e os ticks de fundo (usar o mesmo `sincronizarEstadoGlobal` como árbitro do relógio global).

### Agendamento e custo (decisão de infra)
Três opções, em ordem de recomendação:
- **(Recomendado) Cron do Base44** chamando `simulacaoBackground` a cada N minutos, só para stories com `background_vivo`. Cadência controlada, custo previsível.
- **Amortizado**: o fluxo on-screen processa 1 cluster de bastidores por turno do usuário (piggyback). Custo zero adicional de infra, mas só avança quando o usuário joga.
- **Frontend `setInterval`** (como o autopilot atual em `Composer.jsx`): simples, mas só roda com a aba aberta.

### Entidades e arquivos do Gap 4
- `Character.jsonc`: `localizacao_atual`, `viagem_destino`, `viagem_ticks_restantes`, `ultimo_tick_offscreen` (e passar a **usar** `estado_simulacao` e `ultima_interacao_com`).
- `Story.jsonc`: `background_vivo` (boolean, opt-in).
- `NarrativeBlock.jsonc`: `"OFFSCREEN"` no enum de `type`.
- Novo `base44/functions/simulacaoBackground/entry.ts`.
- `orquestrador/entry.ts` + `simulacaoAutonoma/entry.ts`: setar `localizacao_atual` ao atualizar cena; disparar reconciliação (Camada C) na reentrada.
- Frontend: `BlockItem.jsx` branch `OFFSCREEN` (feed "Nos bastidores" recolhível); toggle de `background_vivo` perto do botão Bot no `Composer.jsx`.
- Cron: função agendada Base44 (ou tabela de rotina) chamando `simulacaoBackground` por story ativa.

### Adaptação dos prompts
Prompt do "Cronista dos Bastidores" (novo, resumido, barato):
> "Você é o Cronista dos Bastidores. Estes personagens estão FORA da cena que o autor observa, no local {localizacao}. Sem prosa longa: relate em 1–2 frases o que se passou entre eles neste intervalo, coerente com o estado (`interagindo`/`viajando`/`investigando`) e as memórias de cada um. Gere memória subjetiva isolada por participante (cada um só percebe o que viveu). Se dois personagens interagiram, registre em `ultima_interacao_com`. Nada aqui deve contradizer o cânone nem o que já aconteceu na cena principal."

---

## Ordem de implementação sugerida

1. **Gap 1** (menor risco, alto valor visível): enum + schema + `BlockItem`. Base para os Gaps 2 e 4.
2. **Gap 2** (reusa Gap 1 + `alocarPersonagens`): pequeno acréscimo de persistência.
3. **Gap 3** (`WorldObject`): isolado, não depende dos outros.
4. **Gap 4** (o maior): Camada A → B → C, atrás do flag `background_vivo`, começando admin-only/BYOK para conter custo.

## Decisões em aberto (para o usuário decidir antes do Gap 4)
- Agendamento do motor de fundo: Cron dedicado, amortizado no turno, ou `setInterval` no frontend?
- Custo: ticks de fundo cobram da `UserWallet` de usuários comuns, ou ficam admin/BYOK-only no V2?
- Cenário durável (entidade `Local`): entra no Gap 3 agora ou vira V3?
