# PROJECT_CONTEXT.md — Nexus Literário

> Checkpoint documental do estado do projeto. Atualizado a cada bloco relevante de trabalho concluído.
> Mantido em paridade em 3 lugares: este arquivo local, a cópia no sandbox Base44, e a memória do projeto (Claude).

**Última atualização: 2026-07-17 — Ilustração de capa gerada por IA nos PDFs, com estilo classificado automaticamente por universo.**

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

## Ilustração de capa por IA (2026-07-17)

A pedido do usuário, com pesquisa de referência extensiva antes de planejar (Storyloft, técnica Style Prompt/Content Prompt de Zimmerman, NovelAI, IP-Adapter/LoRA/`--cref` do Midjourney). Checkpoint `6a5a22df4aa52c9fbdd603fc`.

- **Descoberta chave da pesquisa**: `sdk.integrations.Core.GenerateImage({ prompt })` é a única capacidade de geração de imagem do Base44 — puro texto→imagem (PNG ~1024px), **sem suporte a imagem de referência/personagem** (nada equivalente a IP-Adapter/LoRA/`--cref`). Por isso, consistência de PERSONAGEM entre ilustrações ficou **fora de escopo** (exigiria API externa com chave própria); o MVP entrega consistência de ESTILO (mesma paleta/técnica) via um "Style Prompt" fixo por universo.
- **Decisões do usuário**: motor nativo do Base44 (sem API externa); escopo só capa (não por capítulo); estilo classificado automaticamente por IA e salvo no `Universe` (não por história).
- **`base44/entities/Universe.jsonc`**: novo campo `estilo_visual_ilustracao` — vazio até a 1ª ilustração gerada daquele universo, depois fixo e reaproveitado por todas as histórias dele.
- **Nova função `base44/functions/ilustrarCapa/entry.ts`**: catálogo fixo de 8 estilos (`cyberpunk`, `infantil`, `anime`, `fantasia_epica`, `noir_sombrio`, `aquarela_poetico`, `faroeste_empoeirado`, `cosmico_etereo`), cada um um "Style Prompt" escrito à mão (técnica/paleta/luz/enquadramento, sem mencionar conteúdo — separação Style/Content de Zimmerman). Se o universo ainda não tem estilo, 1 `InvokeLLM` classifica a partir de `Universe.rules`+`Story.title` e salva; sempre 1 `InvokeLLM` gera o "Content Prompt" (cena da capa) a partir do título/regras/trecho compilado; prompt final = Style+Content → `GenerateImage` → a URL retornada é baixada **no próprio backend** (evita CORS) e convertida pra base64. Tudo em try/catch — recusa de política de conteúdo ou falha de rede não quebra a exportação, só retorna erro.
- **`src/components/narrative/PolishingStudio.jsx`**: novo botão "Gerar ilustração de capa" (só aparece quando `storyId` é passado — por isso invisível no Mega Livro do Reset do Sistema, que compila várias histórias de uma vez e não tem 1 `storyId` único), preview da imagem + label do estilo detectado + "Gerar outra versão" (re-roll). Totalmente opcional — sem gerar, publica só com texto como antes.
- **`src/components/narrative/bookPdf.js`**: `generateBookPdf(livro, html, capaBase64)` — com capa, usa `doc.getImageProperties` pra dimensionar sem distorcer e desenha ocupando até 42% da altura da página de título (A5), empurrando universo/título/capítulo pra baixo dela; sem capa, comportamento idêntico ao anterior.
- **`src/components/narrative/BookExporter.jsx`**: passa `storyId` pro `PolishingStudio` (antes não passava).
- **Fora de escopo documentado**: ilustração por capítulo (mesma mecânica, repetir por `h1`); consistência de personagem (precisaria de API externa); seleção manual de estilo pelo usuário (hoje só auto-classificado).
- Verificado: `node --check` na função nova, JSON do schema validado, campo confirmado via `list_entity_schemas`, ESLint limpo, `vite build` verde com a UI nova no bundle. **Não testei a geração de imagem ao vivo** — `GenerateImage` consome créditos reais / chama um provedor de IA de verdade, então esse teste fica combinado com o usuário antes de disparar, preferencialmente no universo-laboratório após o Publish.

## Fix: modal do exportador de livro preso ao header (2026-07-17)

Usuário reportou que o card "Estilo de compilação" aparecia cortado no topo, em qualquer tamanho de tela, mesmo após Publish. Primeira tentativa (`max-h-[85vh] overflow-y-auto`, checkpoint `6a5a27f46ac870fede2c08ae`) não resolveu — diagnóstico estava errado.

**Causa raiz real**: `<BookExporter storyId={id} />` é renderizado **dentro** do `<header className="sticky top-0 z-20 backdrop-blur-xl ...">` de `StoryPage.jsx`. Por spec do CSS, `backdrop-filter` (via `backdrop-blur-xl`) num ancestral cria um novo *containing block* para descendentes `position: fixed` — ent≺o o modal de escolha de estilo (e, por tabela, todo o `PolishingStudio`, que é renderizado como filho do próprio `BookExporter`) ficavam com `inset-0` calculado em relação ao header (~64px de altura), não à viewport inteira — o conteúdo maior que isso ficava cortado/mal posicionado, com metade acima do topo visível. Os outros modais da página (`TokenStoreModal`, `CommandManagerSheet`, `ChapterPanel`, `ByokPromptPanel`) ficam fora do header, por isso nunca tiveram esse problema; os diálogos do `AdminPage` usam o `AlertDialog` do Radix, que já usa Portal internamente, também imunes.

**Fix real** (checkpoint `6a5a2a53262a7b5d5a019a95`): `BookExporter.jsx` e `PolishingStudio.jsx` agora usam `createPortal(..., document.body)` pra renderizar seus overlays `fixed` diretamente como filhos de `<body>`, imunes a qualquer containing-block de ancestrais. O fix de `max-h`/`overflow-y-auto` anterior foi mantido (não fazia mal, só não era a causa raiz).

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

- `6a5a2a53262a7b5d5a019a95` — fix raiz: createPortal no BookExporter/PolishingStudio (containing block do backdrop-blur do header)
- `6a5a27f46ac870fede2c08ae` — fix (parcial/insuficiente): max-h+overflow-y-auto no modal de estilo de compilação
- `6a5a22df4aa52c9fbdd603fc` — ilustração de capa por IA (Core.GenerateImage + catalogo de 8 estilos + Universe.estilo_visual_ilustracao)
- `6a59da120da843ca77b9c3eb` — fundo da landing reescrito: malha de espaço-tempo curvável + estrelas + multiverso com gravidade real
- `6a59c59554077b861bbf2aca` — fix do tamanho do canvas do fundo (w-full h-full)
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
