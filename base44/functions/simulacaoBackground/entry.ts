import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ----- Compactador de Memórias (espelho do orquestrador — evita que personagens de bastidores acumulem memória infinita) -----
const LIMITE_MEMORIAS = 20;
const MEMORIAS_RECENTES_PRESERVADAS = 10;
async function compactarMemorias(sdk, character) {
  const memorias = await sdk.entities.CharacterMemory.filter({ character_id: character.id }, 'created_date', 500);
  if (memorias.length <= LIMITE_MEMORIAS) return null;
  const antigas = memorias.slice(0, memorias.length - MEMORIAS_RECENTES_PRESERVADAS);
  const res = await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Compactador de Memórias do Base 44. Analise o histórico bruto de vivências deste personagem (acumulado nos bastidores) e comprima-o em "Convicções", "Cicatrizes Psicológicas" ou "Habilidades Adquiridas", liberando espaço na memória de curto prazo do Superagente.

DIRETRIZES:
1. Mantenha os fatos essenciais (quem, o que, quando, onde); descarte detalhes de curto prazo.
2. Se já existir memória core anterior, funda-a com as novas convicções sem perder cicatrizes já consolidadas.

[PERSONAGEM]: ${character.name} (custodia: ${character.superagente_id || 'não alocado'})
[MEMÓRIA CORE JÁ CONSOLIDADA]: ${(character.memoria_core || []).join(' | ') || 'nenhuma'}
[HISTÓRICO RESUMIDO ANTERIOR]: ${character.eventos_historicos || 'nenhum'}

[MEMÓRIAS BRUTAS PARA COMPACTAR]:
${antigas.map((m) => `- ${m.content}`).join('\n')}`,
    response_json_schema: {
      type: 'object',
      properties: {
        memoria_core_atualizada: { type: 'array', items: { type: 'string' } },
        eventos_historicos_resumidos: { type: 'string' }
      },
      required: ['memoria_core_atualizada', 'eventos_historicos_resumidos']
    }
  });
  await sdk.entities.Character.update(character.id, {
    memoria_core: res.memoria_core_atualizada,
    eventos_historicos: res.eventos_historicos_resumidos
  });
  await Promise.all(antigas.map((m) => sdk.entities.CharacterMemory.delete(m.id)));
  return { personagem: character.name, memorias_compactadas: antigas.length };
}

// ----- Motor de Bastidores: avança UM cluster off-screen por tique (amortizado no turno) -----
// O mundo continua vivendo fora da cena que o autor observa: personagens em outros Locais
// interagem, investigam e viajam. Cada tique custa 1 chamada de LLM (um cluster só).
// No V2 roda apenas para admin ou BYOK, e apenas em histórias com background_vivo = true.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const { storyId, modoByok } = await req.json();
    if (!storyId) return Response.json({ error: 'storyId é obrigatório' }, { status: 400 });

    const story = await sdk.entities.Story.get(storyId);
    if (!story) return Response.json({ error: 'História não encontrada' }, { status: 404 });
    if (!story.background_vivo) return Response.json({ skipped: 'background_vivo desativado nesta história' });

    // ----- Gate de custo: no V2 os bastidores rodam só para admin (isento) ou BYOK (chave própria) -----
    if (!modoByok) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const isAdmin = user.role === 'admin' || user.id === '6a55c29fb7d4f6ae965f92fb' || user.email === 'ceo@amzdatasoftware.com';
      if (!isAdmin) return Response.json({ skipped: 'bastidores restritos a admin/BYOK nesta versão' });
    }

    const universe = await sdk.entities.Universe.get(story.universe_id);
    const characters = await sdk.entities.Character.filter({ universe_id: story.universe_id });
    const emCena = new Set([...(story.characters_in_scene || []), story.current_pov_name].filter(Boolean));
    const offscreen = characters.filter((c) => !emCena.has(c.name));
    if (!offscreen.length) return Response.json({ skipped: 'todos os personagens estão em cena' });

    const agora = new Date().toISOString();

    // ----- Relógio de viagens: decrementa quem está a caminho (sem LLM, barato) -----
    const chegadas = [];
    for (const c of offscreen) {
      if (c.estado_simulacao !== 'viajando') continue;
      const restantes = typeof c.viagem_ticks_restantes === 'number' ? c.viagem_ticks_restantes - 1 : 0;
      if (restantes > 0) {
        await sdk.entities.Character.update(c.id, { viagem_ticks_restantes: restantes, ultimo_tick_offscreen: agora });
        continue;
      }
      // Chegou ao destino
      const destino = c.viagem_destino || c.localizacao_atual || story.cenario_atual || 'destino desconhecido';
      await sdk.entities.Character.update(c.id, {
        viagem_ticks_restantes: 0,
        viagem_destino: null,
        estado_simulacao: 'ocioso',
        localizacao_atual: destino,
        ultimo_tick_offscreen: agora
      });
      c.localizacao_atual = destino;
      c.estado_simulacao = 'ocioso';
      await sdk.entities.CharacterMemory.create({
        character_id: c.id,
        character_name: c.name,
        superagente_id: c.superagente_id || null,
        story_id: story.id,
        content: `Cheguei a ${destino} depois da viagem.`
      });
      chegadas.push({ nome: c.name, destino });

      // ----- Reconciliação (os caminhos se cruzam): chegou onde o autor está olhando -----
      if (destino && destino === story.cenario_atual) {
        const novaCena = [...new Set([...(story.characters_in_scene || []), c.name])];
        await sdk.entities.Story.update(story.id, { characters_in_scene: novaCena });
        story.characters_in_scene = novaCena;
        await sdk.entities.NarrativeBlock.create({
          story_id: story.id,
          type: 'OFFSCREEN',
          content: `${c.name} chega a ${destino}, vindo de fora de cena.`,
          memoria_character_name: c.name,
          agentes_acionados: ['Motor_de_Bastidores']
        });
      }
    }

    // ----- Agrupa os off-screen restantes por Local (clusters de "enquanto isso") -----
    const clusters = new Map();
    for (const c of offscreen) {
      if (c.estado_simulacao === 'viajando') continue;
      if (chegadas.some((ch) => ch.nome === c.name && ch.destino === story.cenario_atual)) continue;
      const loc = c.localizacao_atual || 'Paradeiro desconhecido';
      if (loc === story.cenario_atual) continue;
      if (!clusters.has(loc)) clusters.set(loc, []);
      clusters.get(loc).push(c);
    }
    const candidatos = [...clusters.entries()].filter(([, membros]) => membros.length);
    if (!candidatos.length) return Response.json({ chegadas, cluster: null, skipped: 'nenhuma cena de bastidores ativa' });

    // ----- Round-robin justo: avança o Local processado há mais tempo -----
    const locais = await sdk.entities.Local.filter({ universe_id: story.universe_id });
    const tickPorLocal = new Map(locais.map((l) => [l.name, l.ultimo_tick || '']));
    candidatos.sort((a, b) => (tickPorLocal.get(a[0]) || '').localeCompare(tickPorLocal.get(b[0]) || ''));
    const [localNome, membros] = candidatos[0];
    const localEx = locais.find((l) => l.name === localNome) || null;

    // ----- Memórias isoladas recentes de cada participante do cluster -----
    const elenco = membros.slice(0, 6);
    const memoriasPorNome = {};
    for (const c of elenco) {
      const mems = await sdk.entities.CharacterMemory.filter({ character_id: c.id }, '-created_date', 3);
      memoriasPorNome[c.name] = mems.reverse().map((m) => m.content).join(' | ') || '(sem memórias registradas)';
    }

    // ----- Cronista dos Bastidores: o "enquanto isso" compacto -----
    const cronica = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é o Cronista dos Bastidores do Mundo Vivo Base 44. Os personagens abaixo estão FORA da cena que o autor observa, vivendo suas próprias vidas no local "${localNome}". Sua função NÃO é escrever prosa longa: relate em 1 a 3 frases secas o que se passou entre eles neste intervalo.

REGRAS:
1. Coerência de estado: respeite o estado_simulacao de cada um (ocioso = rotina; interagindo = conversa/atrito; investigando = busca por pistas).
2. Escala contida: bastidores produzem eventos pequenos e plausíveis — não reviravoltas épicas. O protagonismo é da cena principal.
7. Relógio Global: o tique de bastidores NUNCA pode avançar mais tempo do que a cena principal desde "${story.data_hora_atual || '?'}" — arbitre um decurso curto e plausível (minutos a poucas horas, nunca dias).
3. Nada aqui pode contradizer o cânone do universo nem o que acontece na cena principal.
4. Memória isolada: gere a memória subjetiva de CADA participante — cada um só percebe o que viveu da sua própria perspectiva.
5. Se dois personagens interagiram, registre os nomes em "ultima_interacao" de ambos.
6. Se um personagem decidir partir para outro lugar, marque novo_estado_simulacao = "viajando" e informe "viagem_destino" e "viagem_ticks" (1 a 5 tiques).

[UNIVERSO]: "${universe.name}" | Regras: ${universe.rules || 'não definidas'}
[LOCAL DOS BASTIDORES]: ${localNome}${localEx?.descricao_persistente ? ` — ${localEx.descricao_persistente}` : ''}${localEx?.clima_local ? ` | Clima local: ${localEx.clima_local}` : ''}${localEx?.ultimo_evento ? ` | Último acontecimento aqui: ${localEx.ultimo_evento}` : ''}
[MOMENTO NARRATIVO GLOBAL]: ${story.data_hora_atual || '?'}
[CENA PRINCIPAL ACONTECE EM]: ${story.cenario_atual || '?'} (os personagens abaixo NÃO estão lá)

[PERSONAGENS PRESENTES NESTE LOCAL]:
${elenco.map((c) => `- ${c.name} | estado: ${c.estado_simulacao || 'ocioso'} | psicológico: ${c.psychological_state || '?'} | traços: ${(c.tracos_iniciais || []).join(', ') || '?'} | verbosidade: ${c.verbosidade || 5}`).join('\n')}

[MEMÓRIAS RECENTES ISOLADAS DE CADA UM]:
${Object.entries(memoriasPorNome).map(([n, m]) => `- ${n}: ${m}`).join('\n')}`,
      response_json_schema: {
        type: 'object',
        properties: {
          resumo_bastidores: { type: 'string', description: '1 a 3 frases do que aconteceu neste local enquanto o autor olhava para outro lugar' },
          clima_local: { type: 'string', description: 'Clima/atmosfera atual deste local' },
          estado_do_local: { type: 'string', description: 'Estado do local após o evento (Ativo, Em ruinas, etc.)' },
          momento_local_decorrido: { type: 'string', description: 'Quanto tempo se passou neste local durante o tique (ex: 20 minutos, algumas horas) — arbitre pouco tempo, os bastidores não podem correr mais rápido que a cena principal' },
          memorias: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                memoria: { type: 'string', description: 'Memória subjetiva isolada deste participante' },
                novo_estado_simulacao: { type: 'string', enum: ['ocioso', 'interagindo', 'viajando', 'investigando'] },
                viagem_destino: { type: 'string', description: 'Preenchido só se novo_estado_simulacao = viajando' },
                viagem_ticks: { type: 'number', description: 'Tiques até chegar (1 a 5), só se viajando' },
                ultima_interacao: { type: 'array', items: { type: 'string' } }
              },
              required: ['name', 'memoria']
            }
          }
        },
        required: ['resumo_bastidores', 'memorias']
      }
    });

    // ----- Persistência: memórias isoladas dos participantes -----
    const porNome = new Map(elenco.map((c) => [c.name, c]));
    const memBastidores = (cronica.memorias || [])
      .map((m) => {
        const c = porNome.get(m.name);
        return c ? { character_id: c.id, character_name: c.name, superagente_id: c.superagente_id || null, story_id: story.id, content: m.memoria } : null;
      })
      .filter(Boolean);
    if (memBastidores.length) await sdk.entities.CharacterMemory.bulkCreate(memBastidores);

    // ----- Compacta quem estourou o limite de memórias acumulando só nos bastidores -----
    const compactacoes = (await Promise.all(elenco.map((c) => compactarMemorias(sdk, c).catch(() => null)))).filter(Boolean);

    // ----- Atualiza estado de simulação, viagens e interações dos participantes -----
    const partidas = [];
    for (const m of cronica.memorias || []) {
      const c = porNome.get(m.name);
      if (!c) continue;
      const patch = { ultimo_tick_offscreen: agora };
      if (m.novo_estado_simulacao) patch.estado_simulacao = m.novo_estado_simulacao;
      if (m.ultima_interacao && m.ultima_interacao.length) patch.ultima_interacao_com = m.ultima_interacao;
      if (m.novo_estado_simulacao === 'viajando' && m.viagem_destino) {
        patch.viagem_destino = m.viagem_destino;
        patch.viagem_ticks_restantes = Math.min(5, Math.max(1, Math.round(m.viagem_ticks || 2)));
        partidas.push({ nome: c.name, destino: m.viagem_destino, ticks: patch.viagem_ticks_restantes });
      }
      await sdk.entities.Character.update(c.id, patch);
    }

    // ----- Bloco OFFSCREEN legível: o autor fica sabendo do "enquanto isso" -----
    const blocoOff = await sdk.entities.NarrativeBlock.create({
      story_id: story.id,
      type: 'OFFSCREEN',
      content: cronica.resumo_bastidores,
      memoria_character_name: localNome,
      agentes_acionados: ['Cronista_dos_Bastidores']
    });

    // ----- Local durável: guarda o que ficou para trás -----
    const patchLocal = {
      clima_local: cronica.clima_local || localEx?.clima_local || null,
      estado_atual: cronica.estado_do_local || localEx?.estado_atual || 'Ativo',
      personagens_presentes: membros.map((c) => c.name),
      ultimo_evento: cronica.resumo_bastidores,
      ultimo_tick: agora
    };
    if (localEx) {
      await sdk.entities.Local.update(localEx.id, patchLocal);
    } else {
      await sdk.entities.Local.create({
        universe_id: story.universe_id,
        name: localNome,
        descricao_persistente: `Local de bastidores do universo "${universe.name}".`,
        ...patchLocal
      });
    }

    return Response.json({
      local: localNome,
      participantes: membros.map((c) => c.name),
      resumo: cronica.resumo_bastidores,
      chegadas,
      partidas,
      memorias_registradas: memBastidores.length,
      compactacoes,
      bloco: { id: blocoOff.id, type: blocoOff.type }
    });
  } catch (error) {
    console.error('simulacaoBackground error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
