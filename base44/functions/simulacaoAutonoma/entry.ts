import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ----- Casamento fuzzy de local (fallback): usado só quando o Diretor não resolve a identidade hierárquica -----
function mesmoLocal(a, b) {
  const na = (a || '').toLowerCase().trim();
  const nb = (b || '').toLowerCase().trim();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ----- Endereço hierárquico de Local: slug estável (não o texto atmosférico livre que muda a cada turno) -----
function slugifyLocal(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}
// Um path "contém ou é o mesmo que" o outro: prefixo por SEGMENTO (casa.sala e casa.quarto NUNCA batem; casa e casa.quarto batem)
function pathContem(a, b) {
  if (!a || !b) return false;
  const pa = a.split('.'), pb = b.split('.');
  const [curto, longo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  return curto.every((seg, i) => seg === longo[i]);
}
// Resolve o path de um cenário: reaproveita Local existente (mesmo lugar ou dentro de um já conhecido) ou cria um path novo
function resolverPathLocal(cenarioNome, identidade, locaisUniverso) {
  const porNome = new Map(locaisUniverso.map((l) => [l.name.toLowerCase().trim(), l]));
  const mesmo = identidade?.mesmo_local_que ? porNome.get(identidade.mesmo_local_que.toLowerCase().trim()) : null;
  if (mesmo) return { path: mesmo.path || slugifyLocal(mesmo.name), localExistente: mesmo };
  const pai = identidade?.sublocal_dentro_de ? porNome.get(identidade.sublocal_dentro_de.toLowerCase().trim()) : null;
  if (pai) return { path: `${pai.path || slugifyLocal(pai.name)}.${slugifyLocal(cenarioNome)}`, localExistente: null };
  const existenteFallback = locaisUniverso.find((l) => mesmoLocal(l.name, cenarioNome));
  if (existenteFallback) return { path: existenteFallback.path || slugifyLocal(existenteFallback.name), localExistente: existenteFallback };
  return { path: slugifyLocal(cenarioNome), localExistente: null };
}

// ----- Motor do Relógio: processa um turno autônomo do Mundo Vivo (sem input humano) -----
const CUSTO_MENSAGEM_AUTONOMO = 1;
const CUSTO_INTEGRACAO_AUTONOMO = 2;

// ----- Arquiteto de Dados Relacionais Omniversal (delegado à função grafoOmniversal) -----
async function arquitetoDeGrafos(sdk, universeId, dadosBrutos) {
  const r = await sdk.functions.invoke('grafoOmniversal', { acao: 'arquiteto', universeId, dadosBrutos });
  return r?.data ?? r;
}

// ----- Orquestrador de Renderização Visual (delegado à função grafoOmniversal) -----
async function orquestradorRenderizacao(sdk, story, universe) {
  const r = await sdk.functions.invoke('grafoOmniversal', { acao: 'render', storyId: story.id });
  return (r?.data ?? r)?.render ?? null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const { storyId, modoByok } = await req.json();
    if (!storyId) return Response.json({ error: 'storyId é obrigatório' }, { status: 400 });

    // ----- Verificação Financeira: turnos autônomos nativos consomem energia da carteira -----
    let wallet = null;
    let isAdmin = false;
    if (!modoByok) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      // Modo Deus (Admin Bypass): o criador do sistema não paga tributos
      isAdmin = user.role === 'admin' || user.id === '6a55c29fb7d4f6ae965f92fb' || user.email === 'ceo@amzdatasoftware.com';
      const carteiras = await sdk.entities.UserWallet.filter({ user_id: user.id });
      wallet = carteiras[0] || await sdk.entities.UserWallet.create({ user_id: user.id, creditos_mensagem: 5, creditos_integracao: 20 });
      if (!isAdmin) {
        if ((wallet.creditos_mensagem || 0) < CUSTO_MENSAGEM_AUTONOMO || (wallet.creditos_integracao || 0) < CUSTO_INTEGRACAO_AUTONOMO) {
          return Response.json({ error: 'Energia insuficiente', stopAutopilot: true }, { status: 402 });
        }
      }
    }

    // ----- Estado atual da simulação -----
    const story = await sdk.entities.Story.get(storyId);
    const universe = await sdk.entities.Universe.get(story.universe_id);
    const characters = await sdk.entities.Character.filter({ universe_id: story.universe_id });
    const blocks = await sdk.entities.NarrativeBlock.filter({ story_id: storyId }, '-created_date', 3);
    blocks.reverse();

    const ultimosBlocos = blocks.map((b) => `[${b.type}${b.pov_character_name ? '/' + b.pov_character_name : ''}] ${b.content.slice(0, 600)}`).join('\n---\n') || '(história ainda sem blocos)';
    const emCena = characters.filter((c) => (story.characters_in_scene || []).includes(c.name));
    const elenco = emCena.map((c) => `${c.name} (estado psicológico: ${c.psychological_state || '?'} | estado de simulação: ${c.estado_simulacao || 'ocioso'} | traços: ${(c.tracos_iniciais || []).join(', ') || '?'})`).join('\n') || 'nenhum personagem em cena';

    // ----- Iniciativa: qual agente toma a ação neste tique do relógio? -----
    const iniciativa = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é o Motor do Relógio do Mundo Vivo Base 44. A história está rodando em Piloto Automático, sem input humano. Baseado neste contexto, qual personagem presente deve agir/falar agora, ou precisamos de um 'CRIAR_NOVO' (introduzir um personagem inédito para oxigenar a cena)? Retorne apenas o nome exato ou 'CRIAR_NOVO'.

REGRAS DE INICIATIVA:
1. Prefira o personagem com maior tensão dramática pendente nos últimos blocos.
2. Evite repetir o mesmo personagem que teve a iniciativa no turno anterior (foco anterior: ${story.personagem_em_foco_autonomo || 'nenhum'}).
3. Só retorne 'CRIAR_NOVO' se a cena estiver estagnada ou se a narrativa pedir claramente sangue novo.

[UNIVERSO]: "${universe.name}" | Regras: ${universe.rules || 'não definidas'}
[HISTÓRIA]: "${story.title}" | Cenário: ${story.cenario_atual || '?'} | Clima: ${story.clima_atual || '?'} | Momento: ${story.data_hora_atual || '?'}
[PERSONAGENS PRESENTES NA CENA]:
${elenco}
[ÚLTIMOS 3 BLOCOS NARRATIVOS]:
${ultimosBlocos}`,
      response_json_schema: {
        type: 'object',
        properties: {
          escolha: { type: 'string', description: "Nome EXATO de um personagem presente, ou 'CRIAR_NOVO'" },
          justificativa: { type: 'string' }
        },
        required: ['escolha']
      }
    });

    const escolha = (iniciativa.escolha || '').trim();
    let acaoBruta = null;
    let personagemFoco = null;
    let novoPersonagem = null;

    if (escolha !== 'CRIAR_NOVO') {
      // ----- Agente existente: gera a ação bruta injetando suas memórias recentes -----
      personagemFoco = characters.find((c) => c.name === escolha || (escolha.length > 3 && escolha.includes(c.name)));
      if (!personagemFoco) return Response.json({ error: `Personagem "${escolha}" não encontrado no elenco`, iniciativa }, { status: 422 });

      const memorias = await sdk.entities.CharacterMemory.filter({ character_id: personagemFoco.id }, '-created_date', 10);
      memorias.reverse();
      const bancoMemoria = memorias.map((m) => `- ${m.content}`).join('\n') || (personagemFoco.primeira_memoria ? `- ${personagemFoco.primeira_memoria}` : '- (sem memórias registradas)');

      const acao = await sdk.integrations.Core.InvokeLLM({
        prompt: `Você é o Superagente Hospedeiro de ${personagemFoco.name}, operando no modo Mundo Vivo do Base 44. Nenhum humano está ditando a história agora: é a VONTADE PRÓPRIA do personagem que move este turno. Gere a ação bruta (o que ele faz, fala ou decide por iniciativa própria) para o Diretor Narrativo tecer depois.

IDENTIDADE VERBAL E MENTAL:
[PERFIL LINGUÍSTICO]: ${personagemFoco.perfil_linguistico || 'Normal'}
[VÍCIOS DE LINGUAGEM]: ${(personagemFoco.vicios_linguagem || []).join(', ') || 'Nenhum'}
[VERBOSIDADE (1 a 10)]: ${personagemFoco.verbosidade || 5}
[ESTILO DE PENSAMENTO]: ${personagemFoco.estilo_pensamento || 'Lógico'}
[ESTADO PSICOLÓGICO ATUAL]: ${personagemFoco.psychological_state || '?'}
[MEMÓRIA CORE (convicções, cicatrizes, habilidades)]:
${(personagemFoco.memoria_core || []).map((m) => `- ${m}`).join('\n') || '- (nenhuma consolidada)'}
Histórico compactado: ${personagemFoco.eventos_historicos || '(nenhum)'}

MEMÓRIAS RECENTES ISOLADAS (acesso exclusivo desta chave):
${bancoMemoria}

CONTEXTO DA CENA:
[CENÁRIO]: ${story.cenario_atual || '?'} | [CLIMA]: ${story.clima_atual || '?'} | [MOMENTO]: ${story.data_hora_atual || '?'}
[OUTROS PRESENTES]: ${(story.characters_in_scene || []).filter((n) => n !== personagemFoco.name).join(', ') || 'ninguém'}
[ÚLTIMOS 3 BLOCOS NARRATIVOS]:
${ultimosBlocos}

Retorne a ação bruta em primeira pessoa da vontade do personagem: o que ele decide fazer/falar AGORA, movido por suas memórias e desejos. Um parágrafo denso, em português.`,
        response_json_schema: {
          type: 'object',
          properties: {
            acao_bruta: { type: 'string' },
            estado_simulacao: { type: 'string', enum: ['ocioso', 'interagindo', 'viajando', 'investigando'], description: 'Novo status de background do personagem após esta iniciativa' }
          },
          required: ['acao_bruta']
        }
      });
      acaoBruta = acao.acao_bruta;
      if (acao.estado_simulacao) {
        await sdk.entities.Character.update(personagemFoco.id, { estado_simulacao: acao.estado_simulacao });
      }
    } else {
      // ----- CRIAR_NOVO: forja um personagem aderente à Lore usando a Base de Conhecimento -----
      const fontes = await sdk.entities.KnowledgeSource.list('-created_date', 10);
      const lore = fontes.length
        ? fontes.map((f) => `### ${f.name}\n${(f.content || '').slice(0, 4000)}`).join('\n\n')
        : '(nenhuma fonte de conhecimento cadastrada — use as regras do universo e os últimos blocos como cânone)';

      const criacao = await sdk.integrations.Core.InvokeLLM({
        prompt: `Você é o Forjador de Almas do Mundo Vivo Base 44. A cena estagnou e o Motor do Relógio decidiu introduzir um personagem INÉDITO. Use a Base de Conhecimento (cânone) abaixo para criar um personagem 100% aderente à Lore e escreva a ação bruta de sua introdução orgânica na cena atual.

REGRAS:
1. O personagem deve pertencer plausivelmente a este universo (facções, idiomas, leis do cânone).
2. Forje uma identidade verbal única: verbosidade (1-10), vícios de linguagem orgânicos, perfil linguístico e estilo de pensamento com falhas humanas.
3. A ação bruta de introdução deve criar tensão ou oportunidade imediata para os presentes.

[BASE DE CONHECIMENTO (CÂNONE)]:
${lore}

[UNIVERSO]: "${universe.name}" | Regras: ${universe.rules || 'não definidas'}
[CENA ATUAL]: Cenário: ${story.cenario_atual || '?'} | Clima: ${story.clima_atual || '?'} | Momento: ${story.data_hora_atual || '?'} | Presentes: ${(story.characters_in_scene || []).join(', ') || 'ninguém'}
[ÚLTIMOS 3 BLOCOS NARRATIVOS]:
${ultimosBlocos}`,
        response_json_schema: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            descricao: { type: 'string' },
            estado_psicologico: { type: 'string' },
            tracos_iniciais: { type: 'array', items: { type: 'string' } },
            perfil_linguistico: { type: 'string' },
            vicios_linguagem: { type: 'array', items: { type: 'string' } },
            verbosidade: { type: 'number' },
            estilo_pensamento: { type: 'string' },
            primeira_memoria: { type: 'string', description: 'Contexto de introdução na cena, na perspectiva do novo personagem' },
            acao_bruta_de_introducao: { type: 'string', description: 'Como ele entra em cena e o que faz/fala imediatamente' }
          },
          required: ['nome', 'descricao', 'estado_psicologico', 'tracos_iniciais', 'perfil_linguistico', 'vicios_linguagem', 'verbosidade', 'estilo_pensamento', 'primeira_memoria', 'acao_bruta_de_introducao']
        }
      });

      novoPersonagem = await sdk.entities.Character.create({
        universe_id: story.universe_id,
        name: criacao.nome,
        description: criacao.descricao,
        psychological_state: criacao.estado_psicologico,
        tracos_iniciais: criacao.tracos_iniciais || [],
        primeira_memoria: criacao.primeira_memoria,
        perfil_linguistico: criacao.perfil_linguistico,
        vicios_linguagem: criacao.vicios_linguagem || [],
        verbosidade: criacao.verbosidade,
        estilo_pensamento: criacao.estilo_pensamento,
        estado_simulacao: 'interagindo'
      });
      await sdk.entities.CharacterMemory.create({
        character_id: novoPersonagem.id,
        character_name: novoPersonagem.name,
        story_id: story.id,
        content: criacao.primeira_memoria
      });
      personagemFoco = novoPersonagem;
      acaoBruta = criacao.acao_bruta_de_introducao;
    }

    // ----- Metrônomo do Diretor: ritmo narrativo escolhido pelo autor (fallback equilibrado) -----
    const ritmoAtual = (story.ritmo_narrativo && Object.keys(story.ritmo_narrativo).length)
      ? story.ritmo_narrativo
      : { peso_acao: 25, peso_dialogo: 25, peso_introspeccao: 25, peso_ambientacao: 25 };

    // ----- Objetos duráveis presentes na cena (Gap 3) -----
    let objetosUniverso = [];
    try { objetosUniverso = await sdk.entities.WorldObject.filter({ universe_id: story.universe_id }); } catch (_e) { objetosUniverso = []; }
    const nomesEmCenaObj = new Set([...(story.characters_in_scene || []), personagemFoco?.name].filter(Boolean));
    const idsEmCenaObj = new Set(characters.filter((c) => nomesEmCenaObj.has(c.name)).map((c) => c.id));
    const objetosPresentes = objetosUniverso.filter((o) => (o.localizacao && o.localizacao === story.cenario_atual) || (o.posse_character_id && idsEmCenaObj.has(o.posse_character_id)));
    const objetosInjecao = objetosPresentes.length
      ? objetosPresentes.map((o) => `- "${o.name}" (${o.tipo || 'objeto'}) — estado: ${o.estado_atual || 'intacto'}${o.posse_character_name ? ` | com ${o.posse_character_name}` : o.localizacao ? ` | em ${o.localizacao}` : ''}`).join('\n')
      : 'nenhum objeto durável registrado nesta cena';

    // ----- Registro de Locais conhecidos (identidade hierárquica do cenário) -----
    const locaisUniverso = await sdk.entities.Local.filter({ universe_id: story.universe_id }).catch(() => []);
    const registroLocais = locaisUniverso.map((l) => `"${l.name}" (path: ${l.path || slugifyLocal(l.name)})`).join('; ') || 'nenhum ainda';

    // ----- Diretor Narrativo: transforma a intenção bruta em prosa literária -----
    const direcao = await sdk.integrations.Core.InvokeLLM({
      prompt: `O personagem ${personagemFoco.name} decidiu: '${acaoBruta}'. Escreva isso como o próximo parágrafo de um livro de ficção. Atualize o cenário e faça o texto fluir. Respeite as regras do universo.

O METRÔNOMO DO DIRETOR: A prosa DEVE refletir estritamente estes pesos matemáticos escolhidos pelo autor:
- [AÇÃO: ${ritmoAtual.peso_acao}%]: Se for alto, use verbos cinéticos, frases curtas e ritmo acelerado.
- [DIÁLOGO: ${ritmoAtual.peso_dialogo}%]: Se for alto, foque em interações verbais.
- [INTROSPECÇÃO: ${ritmoAtual.peso_introspeccao}%]: Se for alto, mergulhe na mente do personagem em foco.
- [AMBIENTAÇÃO: ${ritmoAtual.peso_ambientacao}%]: Se for alto, gaste parágrafos detalhando a estética e textura do mundo.

SINCRONIZADOR DE ESTADO GLOBAL: após escrever a prosa, atualize as variáveis de ambiente do mundo. Aplique o decurso natural do tempo em "momento_atualizado" (minutos, horas ou mais, conforme a cena) — o mundo NÃO pode ficar congelado no tempo. Registre também em "notas_grafo" instruções curtas para o Arquiteto de Grafos sobre o cenário visual da interface.

IDENTIDADE HIERÁRQUICA DO LOCAL ("cenario_identidade"): o texto do cenário muda de turno a turno, mas fisicamente pode ser o MESMO lugar. Compare "cenario_atualizado" com os [LOCAIS JÁ CONHECIDOS] e preencha "mesmo_local_que" (nome EXATO se for fisicamente o mesmo lugar de antes) ou "sublocal_dentro_de" (nome EXATO se for uma área DENTRO de um Local já conhecido, ex: o quarto dentro da casa). Deixe ambos vazios se for um lugar novo e independente. NUNCA invente nomes fora da lista.
[LOCAIS JÁ CONHECIDOS NESTE UNIVERSO]: ${registroLocais}

EXPANSÃO DE LORE: se a prosa mencionar personagens INÉDITOS (que não estejam entre os presentes listados), liste-os em "novos_personagens" com descrição e estado psicológico para cadastro no sistema.

[REGRAS DO UNIVERSO "${universe.name}"]: ${universe.rules || 'não definidas — assuma física realista'}
[CENA ATUAL]: Cenário: ${story.cenario_atual || '?'} | Clima: ${story.clima_atual || '?'} | Momento: ${story.data_hora_atual || '?'} | Presentes: ${(story.characters_in_scene || []).join(', ') || 'ninguém'}
[OBJETOS PRESENTES E SEU ESTADO DURÁVEL — respeite-os: um item quebrado continua quebrado; um item que outro carrega não está livre para pegar]:
${objetosInjecao}
[PERSONAGENS JÁ CADASTRADOS NO SISTEMA]: ${characters.map((c) => c.name).join(', ') || 'nenhum'}
[ÚLTIMOS 3 BLOCOS NARRATIVOS]:
${ultimosBlocos}

Em "prosa", escreva apenas o parágrafo literário, em português, sem avisos sistêmicos. Em "memorias_registradas", gere a memória subjetiva do evento para o personagem que agiu E para cada outro presente na cena (cada um só percebe o que viveu). Em "memorias_evocadas": se a cena organicamente faz um personagem reviver uma lembrança (gatilho sensorial, objeto, nome, lugar), retorne-a em primeira pessoa dele — será renderizada como flashback destacado; só evoque quando o gatilho existir de fato. Se a lembrança evocar alguém que NÃO está cadastrado e pode reaparecer (vivo, relevante), preencha "personagem_evocado" com pode_reaparecer=true; se está morto e não volta, false. Em "objetos_manipulados": se um objeto for usado, alterado, movido, quebrado ou trocar de dono, ou se um objeto inédito com peso narrativo surgir, registre-o (name, novo_estado e, quando aplicável, nova_localizacao / novo_dono_character_name / acao). Só objetos com peso narrativo.`,
      response_json_schema: {
        type: 'object',
        properties: {
          prosa: { type: 'string' },
          cenario_atualizado: { type: 'string' },
          clima_atualizado: { type: 'string' },
          momento_atualizado: { type: 'string', description: 'Data/hora aproximada da narrativa após o decurso natural do tempo neste turno' },
          cenario_identidade: { type: 'object', properties: { mesmo_local_que: { type: 'string' }, sublocal_dentro_de: { type: 'string' } } },
          notas_grafo: { type: 'string', description: 'Instruções curtas para o Arquiteto de Grafos sobre o cenário visual' },
          novos_personagens: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, description: { type: 'string' }, psychological_state: { type: 'string' } },
              required: ['name']
            }
          },
          memorias_registradas: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, memoria: { type: 'string' } },
              required: ['name', 'memoria']
            }
          },
          memorias_evocadas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                character_name: { type: 'string', description: 'Personagem em cena que reviveu a lembrança' },
                memoria: { type: 'string', description: 'A lembrança em 1a pessoa (vira um flashback destacado)' },
                gatilho: { type: 'string', description: 'O que na cena disparou a lembrança' },
                personagem_evocado: { type: 'object', properties: { name: { type: 'string' }, papel_na_memoria: { type: 'string' }, pode_reaparecer: { type: 'boolean', description: 'true se pode reaparecer fisicamente no mundo' } } }
              },
              required: ['character_name', 'memoria']
            }
          },
          objetos_manipulados: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, tipo: { type: 'string' }, novo_estado: { type: 'string' }, nova_localizacao: { type: 'string' }, novo_dono_character_name: { type: 'string' }, acao: { type: 'string' } }, required: ['name'] } }
        },
        required: ['prosa', 'momento_atualizado', 'memorias_registradas']
      }
    });

    // ----- Expansão de Lore: cadastra entidades inéditas mencionadas pela prosa autônoma -----
    let elencoAtual = novoPersonagem ? characters.concat([novoPersonagem]) : characters;
    const nomesExistentes = new Set(elencoAtual.map((c) => c.name));
    const ineditos = (direcao.novos_personagens || []).filter((p) => !nomesExistentes.has(p.name));
    if (ineditos.length) {
      const criados = await sdk.entities.Character.bulkCreate(ineditos.map((p) => ({
        universe_id: story.universe_id,
        name: p.name,
        description: p.description || null,
        psychological_state: p.psychological_state || null,
        motivo_alocacao: 'Surgiu na Simulação Autônoma (Mundo Vivo)'
      })));
      elencoAtual = elencoAtual.concat(criados);
    }

    // ----- Atualização de Memória: personagem que agiu + presentes na cena -----
    const memoriasNovas = (direcao.memorias_registradas || [])
      .map((m) => {
        const c = elencoAtual.find((x) => x.name === m.name);
        return c ? { character_id: c.id, character_name: c.name, superagente_id: c.superagente_id || null, story_id: story.id, content: m.memoria } : null;
      })
      .filter(Boolean);
    if (memoriasNovas.length) await sdk.entities.CharacterMemory.bulkCreate(memoriasNovas);

    // ----- Memória Evocada (flashback legível) + Personagem nascido de memória -----
    const memoriasEvocadas = direcao.memorias_evocadas || [];
    let entrantesMemoria = [];
    if (memoriasEvocadas.length) {
      const nomesExist = new Set(elencoAtual.map((c) => c.name));
      const aCriar = [];
      for (const ev of memoriasEvocadas) {
        const pe = ev.personagem_evocado;
        if (pe && pe.pode_reaparecer && pe.name && !nomesExist.has(pe.name) && !aCriar.some((x) => x.name === pe.name)) {
          aCriar.push({
            universe_id: story.universe_id,
            name: pe.name,
            description: `[Nascido de Memória de ${ev.character_name}] ${pe.papel_na_memoria || ''}`.trim(),
            primeira_memoria: ev.memoria,
            motivo_alocacao: 'Nascido de Memória (Mundo Vivo)',
            estado_simulacao: 'ocioso'
          });
          nomesExist.add(pe.name);
        }
      }
      if (aCriar.length) {
        const criados = await sdk.entities.Character.bulkCreate(aCriar);
        elencoAtual = elencoAtual.concat(criados);
        entrantesMemoria = criados.map((c) => c.name);
        const primeirasMems = criados
          .map((c) => (c.primeira_memoria ? { character_id: c.id, character_name: c.name, story_id: story.id, content: c.primeira_memoria } : null))
          .filter(Boolean);
        if (primeirasMems.length) await sdk.entities.CharacterMemory.bulkCreate(primeirasMems);
      }
      const paresEvoc = memoriasEvocadas
        .map((ev) => {
          const c = elencoAtual.find((x) => x.name === ev.character_name);
          return c ? { ev, registro: { character_id: c.id, character_name: c.name, superagente_id: c.superagente_id || null, story_id: story.id, content: ev.memoria } } : null;
        })
        .filter(Boolean);
      if (paresEvoc.length) {
        const criadasEvoc = await sdk.entities.CharacterMemory.bulkCreate(paresEvoc.map((p) => p.registro));
        paresEvoc.forEach((p, i) => { p.ev._memoria_ref = criadasEvoc[i]?.id || null; });
      }
    }

    // ----- Objetos duráveis: upsert do estado manipulado neste turno (Gap 3) -----
    const objetosManipulados = direcao.objetos_manipulados || [];
    if (objetosManipulados.length) {
      try {
        const porNomeObj = new Map(objetosUniverso.map((o) => [o.name, o]));
        for (const om of objetosManipulados) {
          if (!om.name) continue;
          const dono = om.novo_dono_character_name ? elencoAtual.find((c) => c.name === om.novo_dono_character_name) : null;
          const ex = porNomeObj.get(om.name);
          const logLinha = `[${story.data_hora_atual || '?'}] ${om.acao || 'alterado'}${om.novo_estado ? ` → ${om.novo_estado}` : ''}`;
          if (ex) {
            await sdk.entities.WorldObject.update(ex.id, {
              estado_atual: om.novo_estado || ex.estado_atual,
              localizacao: dono ? null : (om.nova_localizacao || ex.localizacao),
              posse_character_id: dono ? dono.id : (om.nova_localizacao ? null : ex.posse_character_id),
              posse_character_name: dono ? dono.name : (om.nova_localizacao ? null : ex.posse_character_name),
              historico: [...(ex.historico || []), logLinha].slice(-50)
            });
          } else {
            await sdk.entities.WorldObject.create({
              universe_id: story.universe_id,
              name: om.name,
              node_id: `objeto_${om.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50)}`,
              tipo: om.tipo || 'objeto',
              estado_atual: om.novo_estado || 'intacto',
              localizacao: dono ? null : (om.nova_localizacao || story.cenario_atual || null),
              posse_character_id: dono ? dono.id : null,
              posse_character_name: dono ? dono.name : null,
              historico: [logLinha],
              estado_simulacao: 'intacto'
            });
          }
        }
      } catch (_e) { /* enhancement, nunca quebra o turno */ }
    }

    // ----- Novo bloco narrativo autônomo -----
    const bloco = await sdk.entities.NarrativeBlock.create({
      story_id: story.id,
      type: 'AI',
      content: direcao.prosa,
      pov_character_name: personagemFoco.name,
      psychological_state: personagemFoco.psychological_state || null,
      intencao: 'Simulacao_Autonoma',
      agentes_acionados: ['Motor_do_Relogio', `Superagente_${personagemFoco.name}`, 'Diretor_Narrativo']
    });

    // Flashbacks evocados viram blocos legíveis logo após a prosa autônoma
    if (memoriasEvocadas.length) {
      await sdk.entities.NarrativeBlock.bulkCreate(memoriasEvocadas.map((ev) => ({ story_id: story.id, type: 'MEMORIA', content: ev.memoria, memoria_character_name: ev.character_name, memoria_ref: ev._memoria_ref || null })));
    }

    // ----- Sincronizador de Estado Global: tempo, clima e espaço avançam mesmo sem input humano -----
    const momentoAtual = direcao.momento_atualizado || story.data_hora_atual;
    const cenarioAtual = direcao.cenario_atualizado || story.cenario_atual;
    const climaAtual = direcao.clima_atualizado || story.clima_atual;
    const cenaFinal = entrantesMemoria.length ? [...new Set([...(story.characters_in_scene || []), ...entrantesMemoria])] : (story.characters_in_scene || []);
    await sdk.entities.Story.update(story.id, {
      personagem_em_foco_autonomo: personagemFoco.id,
      data_hora_atual: momentoAtual,
      cenario_atual: cenarioAtual,
      clima_atual: climaAtual,
      notas_grafo: direcao.notas_grafo || story.notas_grafo,
      ...(entrantesMemoria.length ? { characters_in_scene: cenaFinal } : {})
    });

    // ----- Conecta a ação autônoma ao Megagrafo (payload idêntico ao fluxo manual) -----
    const grafo = await arquitetoDeGrafos(sdk, story.universe_id, `PROSA DO TURNO: ${direcao.prosa}
REAÇÕES DOS SUPERAGENTES: [${personagemFoco.name} — iniciativa autônoma]: ${acaoBruta}
MEMÓRIAS REGISTRADAS: ${(direcao.memorias_registradas || []).map((m) => `${m.name}: ${m.memoria}`).join(' | ') || 'nenhuma'}
MEMÓRIAS EVOCADAS: ${memoriasEvocadas.map((ev) => `${ev.character_name} reviveu: ${ev.memoria}${ev.personagem_evocado?.name ? ` (evocou ${ev.personagem_evocado.name})` : ''}`).join(' | ') || 'nenhuma'}
OBJETOS MANIPULADOS: ${objetosManipulados.map((o) => `${o.name}: ${o.acao || 'alterado'}${o.novo_estado ? ` (${o.novo_estado})` : ''}`).join(' | ') || 'nenhum'}
ESTADO GLOBAL ATUAL: momento "${momentoAtual}", cenário "${cenarioAtual}", clima "${climaAtual}"
NOTAS DO SINCRONIZADOR PARA O GRAFO: ${direcao.notas_grafo || 'nenhuma'}
PERSONAGENS E AGENTES BASE44: ${elencoAtual.map((c) => `${c.name} → ${c.superagente_id || '?'}`).join('; ')}`);

    // ----- Atualiza a câmera e o zoom do Grafo na UI -----
    const render = await orquestradorRenderizacao(sdk, story, universe);

    // ----- Camada A (Bastidores): mantém a localização dos presentes e o Local do cenário on-screen -----
    let bastidores = null;
    if (story.background_vivo) {
      try {
        const presentes = elencoAtual.filter((c) => cenaFinal.includes(c.name));
        await Promise.all(
          presentes.filter((c) => c.localizacao_atual !== cenarioAtual).map((c) => sdk.entities.Character.update(c.id, { localizacao_atual: cenarioAtual }))
        );
        if (cenarioAtual) {
          const locaisUniverso = await sdk.entities.Local.filter({ universe_id: story.universe_id });
          const localCena = locaisUniverso.find((l) => mesmoLocal(l.name, cenarioAtual));
          const patchCena = { personagens_presentes: cenaFinal, objetos_presentes: objetosUniverso.filter((o) => o.localizacao === cenarioAtual).map((o) => o.name), clima_local: climaAtual || null, estado_atual: 'Ativo' };
          if (localCena) await sdk.entities.Local.update(localCena.id, patchCena);
          else await sdk.entities.Local.create({ universe_id: story.universe_id, name: cenarioAtual, descricao_persistente: 'Cenário ativo da narrativa.', ...patchCena });
        }
      } catch (_e) { /* Camada A é enhancement; nunca quebrar o turno */ }

      // ----- Amortização: um tique de bastidores por turno autônomo (admin/BYOK no V2) -----
      if (isAdmin || modoByok) {
        try {
          const rb = await sdk.functions.invoke('simulacaoBackground', { storyId: story.id, modoByok: !!modoByok });
          bastidores = rb?.data ?? rb;
        } catch (_e) { bastidores = null; }
      }
    }

    // ----- Cobrança do turno autônomo -----
    let tributo = null;
    if (isAdmin) {
      tributo = { custo_mensagem: 0, custo_integracao: 0, aviso: 'Isento (Modo Admin)' };
    } else if (wallet) {
      const saldoMensagem = (wallet.creditos_mensagem || 0) - CUSTO_MENSAGEM_AUTONOMO;
      const saldoIntegracao = (wallet.creditos_integracao || 0) - CUSTO_INTEGRACAO_AUTONOMO;
      await sdk.entities.UserWallet.update(wallet.id, {
        creditos_mensagem: saldoMensagem,
        creditos_integracao: saldoIntegracao
      });
      tributo = { custo_mensagem: CUSTO_MENSAGEM_AUTONOMO, custo_integracao: CUSTO_INTEGRACAO_AUTONOMO, saldo_mensagem: saldoMensagem, saldo_integracao: saldoIntegracao };
    }

    return Response.json({
      storyId: story.id,
      iniciativa: { escolha, justificativa: iniciativa.justificativa || null },
      personagemFoco: { id: personagemFoco.id, nome: personagemFoco.name },
      novoPersonagemCriado: novoPersonagem ? { id: novoPersonagem.id, nome: novoPersonagem.name } : null,
      acaoBruta,
      bloco: { id: bloco.id, type: bloco.type, prosa: direcao.prosa, pov: personagemFoco.name },
      memoriasRegistradas: memoriasNovas.length,
      grafo,
      render,
      bastidores,
      tributo
    });
  } catch (error) {
    console.error('simulacaoAutonoma error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});