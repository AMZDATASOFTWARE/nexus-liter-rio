import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const { texto, storyId } = await req.json();
    if (!texto) return Response.json({ error: 'texto é obrigatório' }, { status: 400 });

    // ----- Estado atual da aplicação -----
    let story = null, universe = null, characters = [], blocks = [];
    if (storyId) {
      story = await sdk.entities.Story.get(storyId);
      universe = await sdk.entities.Universe.get(story.universe_id);
      characters = await sdk.entities.Character.filter({ universe_id: story.universe_id });
      blocks = await sdk.entities.NarrativeBlock.filter({ story_id: storyId }, '-created_date', 8);
      blocks.reverse();
    }

    const estado = story
      ? `História ativa: "${story.title}" | Universo: "${universe.name}" (Regras: ${universe.rules || 'não definidas'}) | POV atual: ${story.current_pov_name || 'narrador onisciente'} | Personagens conhecidos: ${characters.map((c) => `${c.name} (estado: ${c.psychological_state || '?'})`).join('; ') || 'nenhum'} | Personagens em cena: ${(story.characters_in_scene || []).join(', ') || 'nenhum'} | Linha do tempo: ${story.timeline_summary || 'início'} | Últimos blocos: ${blocks.map((b) => `[${b.type}${b.pov_character_name ? '/' + b.pov_character_name : ''}] ${b.content.slice(0, 300)}`).join(' || ')}`
      : 'ZERO ABSOLUTO: nenhuma história, universo ou personagem existe ainda.';

    // ----- Orquestrador Mestre -----
    const roteamento = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é o Orquestrador Mestre do sistema literário multiversal. Sua única função é ler a entrada do usuário, analisar o estado atual da aplicação e delegar tarefas para a rede de Superagentes e subsistemas do Base 44. Você NÃO escreve a história; você coordena quem vai escrevê-la e quem vai salvar os dados.

DIRETRIZES DE ROTEAMENTO (Avalie a intenção do usuário e retorne APENAS um JSON de comando):
1. Se o usuário estiver apenas continuando a história: Acione o "Diretor Narrativo" e os "Superagentes" dos personagens presentes na cena.
2. Se o usuário pedir para mudar de POV (Ponto de Vista): Acione o "Gestor de Transição de Consciência".
3. Se o usuário introduzir um nome ou conceito completamente novo: Acione o "Arquiteto de Dados Relacionais" e o "Alocador de Personagens".
4. Se o usuário iniciar uma história do zero absoluto: Acione o "Criador de Gênesis".

[INPUT DO USUÁRIO]: ${texto}
[ESTADO ATUAL DA INTERFACE]: ${estado}`,
      response_json_schema: {
        type: 'object',
        properties: {
          intencao_usuario: { type: 'string', enum: ['Continuar', 'Mudar_POV', 'Criar_Nova_Historia', 'Ramificar'] },
          agentes_a_acionar: { type: 'array', items: { type: 'string' } },
          parametros_para_agentes: {
            type: 'object',
            properties: {
              personagens_detectados: { type: 'array', items: { type: 'string' } },
              mudanca_de_pov_solicitada: { type: 'string' },
              contexto_imediato_a_repassar: { type: 'string' }
            }
          }
        },
        required: ['intencao_usuario', 'agentes_a_acionar']
      }
    });

    const params = roteamento.parametros_para_agentes || {};
    const agentes = roteamento.agentes_a_acionar || [];

    // ----- Criador de Gênesis (zero absoluto) -----
    if (!story || roteamento.intencao_usuario === 'Criar_Nova_Historia') {
      const genesis = await sdk.integrations.Core.InvokeLLM({
        prompt: `Você é o "Criador de Gênesis" do sistema literário multiversal. A partir do ditado do usuário abaixo, crie o universo (nome e regras), o título da história, os personagens iniciais (com descrição e estado psicológico), o POV inicial e o bloco de abertura em prosa literária rica, em português.

DITADO DO USUÁRIO: ${texto}
CONTEXTO DO ORQUESTRADOR: ${params.contexto_imediato_a_repassar || ''}`,
        response_json_schema: {
          type: 'object',
          properties: {
            universo: { type: 'object', properties: { name: { type: 'string' }, rules: { type: 'string' } }, required: ['name', 'rules'] },
            titulo: { type: 'string' },
            personagens: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, psychological_state: { type: 'string' } }, required: ['name'] } },
            pov: { type: 'string' },
            prosa: { type: 'string' },
            resumo_timeline: { type: 'string' }
          },
          required: ['universo', 'titulo', 'prosa']
        }
      });

      const uni = await sdk.entities.Universe.create(genesis.universo);
      const chars = genesis.personagens?.length
        ? await sdk.entities.Character.bulkCreate(genesis.personagens.map((p) => ({ ...p, universe_id: uni.id })))
        : [];
      const povChar = chars.find((c) => c.name === genesis.pov);
      const newStory = await sdk.entities.Story.create({
        universe_id: uni.id,
        title: genesis.titulo,
        timeline_summary: genesis.resumo_timeline || '',
        current_pov_character_id: povChar?.id || null,
        current_pov_name: genesis.pov || null,
        characters_in_scene: chars.map((c) => c.name)
      });
      await sdk.entities.NarrativeBlock.bulkCreate([
        { story_id: newStory.id, type: 'USER', content: texto },
        { story_id: newStory.id, type: 'AI', content: genesis.prosa, pov_character_name: genesis.pov || null, intencao: roteamento.intencao_usuario, agentes_acionados: agentes }
      ]);
      return Response.json({ roteamento, storyId: newStory.id });
    }

    // ----- Diretor Narrativo / Gestor de Transição / Arquiteto de Dados -----
    const resultado = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é a rede de Superagentes do sistema literário multiversal. Os agentes acionados pelo Orquestrador foram: ${agentes.join(', ')}.
- "Diretor Narrativo": continua a história em prosa literária rica, mantendo coerência com o universo e a linha do tempo.
- "Gestor de Transição de Consciência": se houver mudança de POV solicitada (${params.mudanca_de_pov_solicitada || 'nenhuma'}), escreva a transição a partir da consciência do novo personagem, refletindo seu estado psicológico.
- "Arquiteto de Dados Relacionais" e "Alocador de Personagens": se surgirem personagens novos (${(params.personagens_detectados || []).join(', ') || 'nenhum'}), defina descrição e estado psicológico para cadastro.

ESTADO ATUAL: ${estado}
DITADO DO USUÁRIO: ${texto}
CONTEXTO DO ORQUESTRADOR: ${params.contexto_imediato_a_repassar || ''}

Escreva o próximo bloco narrativo em português e atualize os dados.`,
      response_json_schema: {
        type: 'object',
        properties: {
          prosa: { type: 'string' },
          pov: { type: 'string', description: 'Nome do personagem cujo POV está ativo neste bloco' },
          estado_psicologico_pov: { type: 'string' },
          novos_personagens: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, psychological_state: { type: 'string' } }, required: ['name'] } },
          atualizacoes_estado: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, psychological_state: { type: 'string' } }, required: ['name', 'psychological_state'] } },
          personagens_em_cena: { type: 'array', items: { type: 'string' } },
          resumo_timeline: { type: 'string' }
        },
        required: ['prosa', 'resumo_timeline']
      }
    });

    // Persistência
    const existentes = new Set(characters.map((c) => c.name));
    const novos = (resultado.novos_personagens || []).filter((p) => !existentes.has(p.name));
    if (novos.length) {
      const criados = await sdk.entities.Character.bulkCreate(novos.map((p) => ({ ...p, universe_id: story.universe_id })));
      characters = characters.concat(criados);
    }
    for (const upd of resultado.atualizacoes_estado || []) {
      const c = characters.find((x) => x.name === upd.name);
      if (c) await sdk.entities.Character.update(c.id, { psychological_state: upd.psychological_state });
    }
    const povChar = characters.find((c) => c.name === resultado.pov);
    await sdk.entities.Story.update(story.id, {
      timeline_summary: resultado.resumo_timeline,
      current_pov_character_id: povChar?.id || story.current_pov_character_id,
      current_pov_name: resultado.pov || story.current_pov_name,
      characters_in_scene: resultado.personagens_em_cena || story.characters_in_scene
    });
    await sdk.entities.NarrativeBlock.bulkCreate([
      { story_id: story.id, type: 'USER', content: texto },
      { story_id: story.id, type: 'AI', content: resultado.prosa, pov_character_name: resultado.pov || story.current_pov_name, psychological_state: resultado.estado_psicologico_pov || null, intencao: roteamento.intencao_usuario, agentes_acionados: agentes }
    ]);

    return Response.json({ roteamento, storyId: story.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});