# PROJECT_CONTEXT.md — Nexus Literário

> Checkpoint documental do estado do projeto. Atualizado a cada bloco relevante de trabalho concluído.
> Mantido em paridade em 3 lugares: este arquivo local, a cópia no sandbox Base44, e a memória do projeto (Claude).

**Última atualização: 2026-07-17 — Landing page pública em `/landing`, com fundo de partículas-grafo interativo.**

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

## Exportação de livro (PDF) — "Lapidar e exportar como livro" (2026-07-17)

Verificação da ferramenta a pedido do usuário revelou que o livro saía com ~3 páginas (a história inteira era comprimida em **um único `InvokeLLM`** do `compilarCanone`, limitado pelos tokens de saída) e que o Compilador de Cânone não conhecia os blocos `MEMORIA`/`OFFSCREEN` do Mundo Vivo. Reescrita (checkpoint `6a598f6c4b59f7090410bcc4`):

- **`compilarCanone`**: busca de blocos **sem teto de 500** (paginação por cursor `$gte created_date` + dedupe por id, só acionada acima de 500, com fallback); SYSTEM filtrado antes do payload; novos params opcionais `manifesto` (só contagem, sem LLM), `modoCompilacao`, `blocoInicio`/`blocoFim` (faixa do lote), `contextoAnterior` (continuidade), `parte`/`totalPartes`; diretriz de **FIDELIDADE INTEGRAL** (não resumir/omitir); diretrizes para MEMORIA (flashback em 1ª pessoa de quem lembra) e OFFSCREEN por modo; payload agora inclui `contexto` (`memoria_character_name` = quem lembra / local dos bastidores); schema ganhou `resumo_para_continuidade`. Sem params novos, comporta-se como antes (botão "Compilar capítulo" da StoryPage intacto).
- **`exportarLivro`**: repassa os novos params; modo `manifesto: true` devolve `{titulo_historia, nome_universo, total_de_blocos_uteis}`.
- **`BookExporter.jsx`**: dialog "Estilo de compilação" com 3 modos escolhíveis pelo usuário — **Integrado** (bastidores como "Enquanto isso..."), **Sem bastidores** (OFFSCREEN fora do livro), **Interlúdios** (bastidores em seções `## Interlúdio — {local}`); loop de compilação dirigido pelo frontend (1 request = 1 capítulo de `BLOCOS_POR_CAPITULO = 24` blocos, com corrente de continuidade entre lotes ⇒ livro de qualquer tamanho sem timeout de função), barra de progresso "Compilando capítulo i de N", 1 retry por lote, cancelável. `PolishingStudio`/`bookPdf` inalterados (já paginavam infinito e já renderizam `#`/`##`).
- Verificado: node --check nos 2 entry.ts, ESLint limpo, vite build verde com a nova UI no bundle. **Confirmado ao vivo pelo usuário após Publish (2026-07-17): funcionando.**

## Reset do Sistema — página `/admin` (2026-07-17)

Botão administrativo de reset total, a pedido do usuário. Checkpoint `6a59ae33f9ed5c719e37d9bf`.

- **Escopo do apagamento**: `Universe`, `Story`, `Character`, `NarrativeBlock`, `CharacterMemory`, `WorldObject`, `Local`, `GraphNode`, `GraphEdge`, `KnowledgeSource`, `OntologyType` — apagados por completo (`deleteMany({})` em loop até esgotar, com trava de segurança de 200 iterações/entidade). `UserWallet.nexus_tokens` é zerado (`updateMany`) sem apagar as carteiras. **`SlashCommand` é preservado** de propósito (configuração, não conteúdo do multiverso).
- **Nova função `base44/functions/resetSistema/entry.ts`**: mesmo bypass de admin já usado em `orquestrador`/`simulacaoAutonoma`/`simulacaoBackground` (`role === 'admin'` ou id/email do dono). Modo `{ preview: true }` é só-leitura (contagens + lista de universos/histórias). Modo destrutivo exige a frase exata `"APAGAR TUDO"` em `confirmacao` — dupla trava junto com o admin bypass.
- **Novo `src/pages/AdminPage.jsx`** (rota `/admin` em `App.jsx`, ícone `Shield` discreto no header do `Home.jsx`, visível só pra `user.role === 'admin'`): fluxo em 4 passos — (1) `AlertDialog` com as contagens atuais, (2) gera um **Mega Livro** compilando TODAS as histórias de TODOS os universos (reaproveita `compilarCapitulosDaHistoria`, extraído de `BookExporter.jsx` pro novo `src/components/narrative/compilarLivro.js` — mesmo pipeline de capítulos sem limite, sempre modo `integrado` pra não perder bastidores/flashbacks), com barra de progresso e cancelamento, (3) abre o `PolishingStudio` (inalterado) pro admin revisar/baixar o PDF, (4) só então libera a confirmação final — digitar "APAGAR TUDO" exatamente pra habilitar o botão de reset de fato.
- **Refatoração de reuso**: `BookExporter.jsx` passou a importar `compilarCapitulosDaHistoria`/`juntarCapitulosEmLivro` de `compilarLivro.js` em vez de ter o loop inline — comportamento idêntico, só compartilhado com a página de Admin.
- **Cuidado de implementação**: o botão de confirmação final usa um `Button` comum, NÃO o `AlertDialogAction` do Radix — `AlertDialogAction` fecha o dialog via `DialogPrimitive.Close` no mesmo clique (closure desatualizada faria o estado voltar pra "idle" antes do reset assíncrono terminar). Só os botões de "Cancelar" usam `AlertDialogCancel`.
- Verificado: `node --check` na função nova, ESLint limpo, `vite build` verde com a nova página no bundle. Não testei nem o preview nem o modo destrutivo ao vivo (13 universos/histórias reais no sistema, sem escopo por universo no reset). **Confirmado ao vivo pelo usuário após Publish (2026-07-17): funcionando.**

## Landing page pública — `/landing` (2026-07-17)

A pedido do usuário: landing de marketing pra atrair entusiastas de RPG, leitura e multiverso/IA. Checkpoint `6a59c43452283ff45c4547a8`.

- **Roteamento público**: `src/App.jsx` ganhou `PUBLIC_PATHS = ['/landing']`, checado no topo de `App()` **antes** do `AuthProvider` — renderiza um `<Routes>` isolado (só `QueryClientProvider`+`Router`, sem auth) pra essa rota, mesmo padrão já usado no app-irmão Patrimônios AMZ (`appId 69b9bbe612ad0c22812b5339`). `/` (Home autenticada) continua idêntico, sem nenhuma mudança.
- **Fundo interativo** `src/components/landing/GraphParticleBackground.jsx`: canvas com nós coloridos usando as MESMAS 8 cores do Megagrafo real (`TIPO_CORES` de `src/components/graph/graphUtils.js` — reaproveitado, não duplicado), conectados por arestas finas quando próximos (visual de grafo), com repulsão suave ao cursor + uma aresta de destaque (âmbar) ligando nós próximos até o próprio ponteiro do mouse. Respeita `prefers-reduced-motion`. Adaptado do `FluidBackground.jsx` do Patrimônios (mesmo ciclo de vida canvas/RAF/resize/cleanup), recolorido pra parecer o grafo do produto, não um fundo genérico.
- **Conteúdo** (`src/pages/Landing.jsx` + `src/components/landing/sections/*.jsx`): Hero ("Seu multiverso tem vida própria"), Facts strip, 6 Pilares (Vozes Únicas, Memórias-Flashback, Nascidos de Lembranças, Objetos & Cenários Duráveis, Bastidores Vivos, Grafo Omniversal 3D — todos recursos reais, não promessas), 3 cards de público-alvo (RPG / leitura-escrita / multiverso e IA), Comparativo vs. "chat de RPG genérico", Preços (reaproveita `PACOTES`/`formatBRL` de `src/components/billing/pricing.js` — fonte única, nunca diverge do Mercado Multiversal real), FAQ, CTA final. Todos os CTAs chamam `base44.auth.redirectToLogin("/")`.
- **Rodapé institucional AMZ**: `src/lib/company.js` (novo, dados portados do Patrimônios: Mateus da Silva Gonçalves · Amz Data Software · CNPJ 53.646.811/0001-20 · ceo@amzdatasoftware.com · (91) 98134-2990) + `src/components/landing/LandingFooter.jsx`.
- Verificado: ESLint limpo, `vite build` verde, bundle confirmado com headline/preços/dados da empresa via grep. **Sem tool de preview ao vivo neste MCP** — a verificação visual (fundo reagindo ao mouse, responsividade) fica pro usuário conferir em `/landing` após o Publish.
- Fora de escopo (não pedido): páginas de Termos/Privacidade; tornar `/` pública.

### Ajustes pós-entrega
- **Fix (2026-07-17)**: o canvas do fundo aparecia como uma caixinha de ~300x150px no canto superior esquerdo em vez de cobrir a tela. Causa: `<canvas>` é um elemento substituído no CSS — `position: fixed; inset: 0` sozinho não o estica (mantém o tamanho intrínseco padrão), diferente de uma div comum. Fix: adicionado `w-full h-full` explicito no className passado em `Landing.jsx`. Checkpoint `6a59c59554077b861bbf2aca`.
- **Reescrita do efeito visual (2026-07-17)**, a pedido do usuário (referências: imagem de lente gravitacional / buraco negro deformando uma malha, e uma nebulosa estelar): `GraphParticleBackground.jsx` agora tem 3 camadas: (1) estrelas de fundo com cintilação, estáticas (profundidade); (2) **malha de "espaço-tempo"** — grade de linhas que se curva de verdade em direção ao cursor dentro de um raio de gravidade (função de queda quadrática), com um brilho radial no ponto do cursor; (3) grafo do multiverso (nos coloridos com as 8 cores do `TIPO_CORES`) sendo **puxado** pela gravidade do mouse (não mais repelido), com arestas entre nós próximos e uma aresta de destaque âmbar até o cursor. Checkpoint `6a59da120da843ca77b9c3eb`. Verificado: ESLint limpo, vite build verde, cores confirmadas no bundle via grep. Conferência visual final (curvatura da malha, atração dos nós) fica pro usuário após novo Publish.

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

- `6a59c43452283ff45c4547a8` — landing page pública /landing com fundo de partículas-grafo
- `6a59ae33f9ed5c719e37d9bf` — botão "Reset do Sistema" (/admin) + Mega Livro de backup automático
- `6a598f6c4b59f7090410bcc4` — livro PDF: compilação por capítulos sem limite + 3 estilos + MEMORIA/OFFSCREEN no compilador
- `6a597c8818b98a3c172a1950` — fix de match flexível de nome no subconjunto (validado ao vivo logo em seguida)
- `6a597a3b873a5a0359848704` — subconjunto de personagens_no_sublocal
- `6a593c9e52372b0ea7680204` — endereço hierárquico de Local (path por slug)
- `6a5903f005f644563ee5146b` — Gap 4: bastidores off-screen
- `6a58ca7d0eeabe01b4b97d8b` — Gap 3: objetos duráveis
- `6a58c6dfb9d0568844a16d96` — Gap 1 UI: bloco MEMORIA
- `6a58c351d27aaa2374b5a82d` — Gap 1 + Gap 2: memória evocada + personagem nascido de memória
