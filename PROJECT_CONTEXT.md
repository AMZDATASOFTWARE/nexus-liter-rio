# PROJECT_CONTEXT.md — Nexus Literário

> Checkpoint documental do estado do projeto. Atualizado a cada bloco relevante de trabalho concluído.
> Mantido em paridade em 3 lugares: este arquivo local, a cópia no sandbox Base44, e a memória do projeto (Claude).

**Última atualização: 2026-07-17 — Mundo Vivo V2 (Gaps 1–4 do `PLAN_MUNDO_VIVO_V2.md`) implementado e validado ao vivo.**

## O que foi feito nesta sessão

Implementação completa do `PLAN_MUNDO_VIVO_V2.md` (documento na raiz, mesclado em `main` via PR #1), aplicada direto no sandbox Base44 via MCP, verificada com `node --check` + validação de schema de entidade + `vite build` a cada passo, e testada ao vivo numa história real (não só leitura estática de código).

### Gap 1 — Memória evocada como flashback legível
- `NarrativeBlock` ganhou o tipo `MEMORIA` + campos `memoria_character_name`/`memoria_ref`.
- Diretor (orquestrador e simulacaoAutonoma) ganhou `memorias_evocadas` no schema — memórias viram blocos visuais distintos (`BlockItem.jsx`, card sépia com ícone Brain).
- `memoria_ref` aponta pro registro `CharacterMemory` de origem.

### Gap 2 — Personagem nascido de memória
- `memorias_evocadas[].personagem_evocado` (nome, papel, `pode_reaparecer`) — se `true`, o sistema forja a persona completa via `alocarPersonagens` (mesmo Sistema de Voz Única de sempre) e o personagem entra em cena.
- Validado ao vivo: "Irmã de Lyra" nasceu de uma memória evocada da Lyra, com verbosidade/vícios/perfil linguístico próprios.

### Gap 3 — Persistência de objetos
- Nova entidade `WorldObject` (estado, localização, posse, histórico, `estado_simulacao`) — fonte de verdade durável, separada do espelho visual `GraphNode`.
- Diretor ganhou `objetos_manipulados`; upsert nos dois fluxos.

### Gap 4 — Simulação paralela/off-screen (o maior)
- Nova entidade **`Local`** (cenário durável, com **`path` hierárquico por slug**, ex: `taverna_do_cais_interior.banheiro_da_taverna_do_cais`) e `Character` ganhou `localizacao_atual`/`localizacao_path`/`viagem_destino`/`viagem_ticks_restantes`/`ultimo_tick_offscreen`.
- Nova função **`simulacaoBackground`** ("Cronista dos Bastidores"): processa 1 cluster off-screen por tique (amortizado no turno, nunca cron), decrementa viagens, reconcilia chegadas (path-aware), gera memórias isoladas por participante, compacta memórias que estouram o limite, espelha no grafo só em eventos fortes (chegada/partida).
- Gate de custo: só roda para admin ou BYOK nesta versão (`background_vivo` é opt-in por história).
- Frontend: card "Nos bastidores" colapsável (ciano, tracejado) + toggle de Globo no header da `StoryPage`.

### Bugs encontrados e corrigidos DURANTE a validação ao vivo (não estavam no plano original)
1. **Cena que perde gente por omissão do Diretor**: `characters_in_scene` era sobrescrito pela lista do Diretor a cada turno — quem não era citado na prosa sumia da cena. Fix: união (cena anterior ∪ confirmados ∪ entrantes) − saídas **explícitas** (`personagens_que_saem_de_cena`), nunca por omissão.
2. **Deriva de texto de cenário quebrando a reconciliação**: comparação por igualdade/substring de texto livre ("Taverna do Cais" vs "Interior da Taverna do Cais, foco na janela") falhava. Fix: **endereço hierárquico por path** (`Local.path`), resolvido pelo próprio Diretor via `cenario_identidade` (`mesmo_local_que` / `sublocal_dentro_de`), comparado por prefixo de segmento (`pathContem`), não mais por texto.
3. **Arrasto indevido pro sublocal mais específico**: ao entrar num sublocal (ex: banheiro dentro da taverna), TODO o elenco da cena era carimbado no path mais fundo. Fix: novo campo `personagens_no_sublocal` — só quem efetivamente segue pro cômodo mais específico é atualizado; o resto permanece no local pai. Validado ao vivo (Lyra sozinha no banheiro; Bram/Doran ficaram na sala principal; Nara nem foi tocada).
4. **Match de nome frágil no subconjunto**: exigir igualdade exata de nome no filtro do subconjunto falhava silenciosamente se o Diretor variasse o nome. Fix: match flexível (mesma convenção já usada em outros pontos do código pra nomes de personagem).

## Universo de teste (mantido de propósito)

**`Teste_Gap4_Bastidores`** (universe_id `6a591ccbaa734aa83561f81c`) — história `Teste Gap 4 — Bastidores` (`6a591cf3607a644cc7790ce3`), com personagens `Lyra_Teste`, `Bram_Teste`, `Nara_Teste`, `Doran_Teste`, `Irmã de Lyra` (nascida de memória). **Mantido intencionalmente** como laboratório pra testes futuros de Mundo Vivo/hierarquia de locais — não é um universo de conteúdo real do usuário.

## Pendências conhecidas (não corrigidas, aceitas conscientemente)

- `Local`s ancestrais não são atualizados quando um descendente é tocado (ex: `personagens_presentes` da "Taverna do Cais (interior)" pode ficar levemente desatualizado quando a ação foca no banheiro). Staleness cosmética, não afeta a lógica de reconciliação.
- `personagens_em_cena` do Diretor ainda pode ocasionalmente incluir alguém só mencionado/lembrado na prosa (mitigado por diretriz de prompt, não eliminado 100%).
- Painel dedicado de objetos no frontend (Gap 3, opcional) não foi feito — `NodeDetails.jsx` já mostra `estado_atual` dos nós Objeto.
- Slash command `/lembrar <personagem>` (evocação ativa pelo usuário, Gap 1 opcional) não foi feito.

## Status de publicação

Tudo commitado no sandbox e sincronizado no GitHub (`main`). **Publish no builder do Base44 ainda pendente** — sandbox e publicado divergem até o usuário publicar manualmente.

## Checkpoints Base44 desta sessão (mais recente primeiro)

- `6a597c8818b98a3c172a1950` — fix de match flexível de nome no subconjunto (validado ao vivo logo em seguida)
- `6a597a3b873a5a0359848704` — subconjunto de personagens_no_sublocal
- `6a593c9e52372b0ea7680204` — endereço hierárquico de Local (path por slug)
- `6a5903f005f644563ee5146b` — Gap 4: bastidores off-screen
- `6a58ca7d0eeabe01b4b97d8b` — Gap 3: objetos duráveis
- `6a58c6dfb9d0568844a16d96` — Gap 1 UI: bloco MEMORIA
- `6a58c351d27aaa2374b5a82d` — Gap 1 + Gap 2: memória evocada + personagem nascido de memória
