import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ----- Engenheiro Ontológico Dinâmico: expande tipos de nós e arestas da arquitetura -----
async function engenheiroOntologico(sdk, trecho, elementos, tiposExistentes) {
  const res = await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Engenheiro Ontológico Dinâmico do Base 44. Sua função é expandir a estrutura do banco de dados relacional (o grafo estilo Obsidian). O universo narrativo se tornou tão complexo que os tipos de nós clássicos não são mais suficientes para categorizar os novos elementos gerados pelo usuário ou pela IA.

AÇÃO EXIGIDA:
Analise o novo trecho da história e o(s) elemento(s) inclassificável(is) detectado(s). Você deve criar uma NOVA CATEGORIA DE NÓ (Node Type) e, se fizer sentido, um NOVO TIPO DE CONEXÃO (Edge/Aresta) que fará parte oficial da arquitetura do aplicativo a partir de agora.

DIRETRIZES DE CRIAÇÃO ONTOLÓGICA:
1. Avaliação de Necessidade: O elemento realmente precisa de um novo tipo, ou é apenas uma variação de um existente? (Ex: Uma "Espada" é um [Objeto], mas uma "Religião" requer um nó do tipo [Conceito_Ideologia] ou [Faccao]). Se for apenas variação, reprove a criação (criacao_aprovada=false) e indique o tipo existente a reutilizar.
2. Expansão do Esquema: Se aprovar a criação, defina as propriedades obrigatórias que esse novo tipo de nó deve ter (Frontmatter).
3. Exemplos de Novas Categorias a considerar: Faccao_Guilda, Magia_Tecnologia, Conceito_Ideologia, Missao_Objetivo, Fauna_Flora, Trauma_Psique.
4. Novos Tipos de Conexões: Crie verbos relacionais inéditos (ex: venera, corrompido_por, profetizou).
5. Formato técnico: "nome_do_tipo" sem espaços nem acentos (ex: Faccao_Guilda); "cor_sugerida_na_interface" obrigatoriamente em HEX.

[ELEMENTOS INCLASSIFICÁVEIS DETECTADOS]: ${elementos.map((e) => `"${e.rotulo}" (${e.propriedades_detalhadas?.descricao_breve || 'sem descrição'})`).join('; ')}
[TRECHO DA NARRATIVA COM O ELEMENTO INCLASSIFICÁVEL]:
"${trecho.slice(0, 3000)}"
[LISTA ATUAL DE TIPOS DE NÓS]:
${tiposExistentes.join(', ')}`,
    response_json_schema: {
      type: 'object',
      properties: {
        criacao_aprovada: { type: 'boolean', description: 'false se o elemento é apenas variação de um tipo existente' },
        tipo_existente_reutilizado: { type: 'string', description: 'Preenchido apenas se criacao_aprovada=false' },
        nova_categoria_de_no_criada: {
          type: 'object',
          properties: {
            nome_do_tipo: { type: 'string', description: 'Ex: Faccao | Ideologia | Flora_Alien' },
            cor_sugerida_na_interface: { type: 'string', description: 'HEX, ex: #22d3ee' },
            icone_sugerido: { type: 'string', description: 'Nome/Tipo de ícone para a UI' },
            propriedades_yaml_obrigatorias: { type: 'array', items: { type: 'string' }, description: 'Ex: ["lider_atual", "nivel_de_hostilidade", "crenca_central"]' }
          },
          required: ['nome_do_tipo', 'cor_sugerida_na_interface', 'icone_sugerido', 'propriedades_yaml_obrigatorias']
        },
        novo_tipo_de_aresta_criado: {
          type: 'object',
          properties: {
            verbo_relacional: { type: 'string', description: 'Ex: parasita_a_mente_de' },
            exemplo_de_uso: { type: 'string', description: '[Conceito A] -> parasita_a_mente_de -> [Personagem B]' }
          },
          required: ['verbo_relacional', 'exemplo_de_uso']
        },
        instrucao_de_migracao: { type: 'string', description: 'Comando para o Arquiteto de Dados sobre como começar a usar essa nova classificação imediatamente' }
      },
      required: ['criacao_aprovada', 'nova_categoria_de_no_criada', 'instrucao_de_migracao']
    }
  });
  if (!res.criacao_aprovada) return res;
  const nome = (res.nova_categoria_de_no_criada.nome_do_tipo || '').trim().replace(/\s+/g, '_');
  const cor = /^#[0-9a-fA-F]{3,8}$/.test(res.nova_categoria_de_no_criada.cor_sugerida_na_interface || '') ? res.nova_categoria_de_no_criada.cor_sugerida_na_interface : '#22d3ee';
  res.nova_categoria_de_no_criada.nome_do_tipo = nome;
  res.nova_categoria_de_no_criada.cor_sugerida_na_interface = cor;
  const jaExiste = await sdk.entities.OntologyType.filter({ nome_do_tipo: nome });
  if (!jaExiste.length) {
    await sdk.entities.OntologyType.create({
      nome_do_tipo: nome,
      cor_interface: cor,
      icone: res.nova_categoria_de_no_criada.icone_sugerido || null,
      propriedades_obrigatorias: res.nova_categoria_de_no_criada.propriedades_yaml_obrigatorias || [],
      verbo_relacional_criado: res.novo_tipo_de_aresta_criado?.verbo_relacional || null,
      exemplo_de_uso_aresta: res.novo_tipo_de_aresta_criado?.exemplo_de_uso || null,
      instrucao_de_migracao: res.instrucao_de_migracao
    });
  }
  return res;
}

// ----- Arquiteto de Dados Relacionais Omniversal: transforma o turno em nós e arestas do megagrafo -----
async function arquitetoDeGrafos(sdk, universeId, dadosBrutos) {
  const [nosExistentes, arestasExistentes, tiposDinamicos] = await Promise.all([
    sdk.entities.GraphNode.filter({ universe_id: universeId }, undefined, 500),
    sdk.entities.GraphEdge.filter({ universe_id: universeId }, undefined, 1000),
    sdk.entities.OntologyType.list(undefined, 100)
  ]);
  const tiposBase = ['Personagem', 'Cenario', 'Clima', 'LinhaTemporal', 'Memoria', 'Objeto', 'Nexus', 'Anomalia', 'Faccao_Grupo', 'Conceito_Ideologia', 'Fauna_Flora'];
  const tiposValidos = [...tiposBase, ...tiposDinamicos.map((t) => t.nome_do_tipo)];
  const coresPorTipo = new Map(tiposDinamicos.map((t) => [t.nome_do_tipo, t.cor_interface]));
  const verbosDinamicos = tiposDinamicos.filter((t) => t.verbo_relacional_criado).map((t) => t.verbo_relacional_criado).join(' | ');
  const ontologiasDetalhe = tiposDinamicos.map((t) => `- ${t.nome_do_tipo} (cor ${t.cor_interface}${t.propriedades_obrigatorias?.length ? `; frontmatter obrigatório: ${t.propriedades_obrigatorias.join(', ')}` : ''}${t.verbo_relacional_criado ? `; verbo relacional: ${t.verbo_relacional_criado}` : ''})${t.instrucao_de_migracao ? ` — migração: ${t.instrucao_de_migracao}` : ''}`).join('\n') || 'nenhum tipo dinâmico autorizado ainda';
  const inventario = nosExistentes.map((n) => `${n.node_id} [${n.tipo}] "${n.rotulo}"`).join('; ') || 'nenhum nó existe ainda';

  const res = await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Arquiteto de Dados Relacionais Omniversal. Sua função é processar os últimos eventos da narrativa, cruzar com as memórias dos Superagentes e gerar uma estrutura de dados JSON rigorosa que alimentará um mapa mental/grafo interativo gigante (similar ao Obsidian).

DIRETRIZES DE MAPEAMENTO:
1. Granularidade Extrema e Categorização Flexível: Tudo é um nó. Extraia e classifique utilizando o esquema primário abaixo, mas ESTEJA PRONTO para utilizar esquemas dinâmicos injetados no sistema:
   - Personagem (Estados mentais e universos).
   - Cenario (Locais com detalhes atmosféricos).
   - Clima ("Chuva ácida de 2045").
   - LinhaTemporal / Ano ("Ano 2026 - Realidade Primária").
   - Memoria (Eventos marcantes na psique).
   - Objeto / Artefato (Itens chave).
   - Nexus (Pontos de colisão entre universos).
   - Anomalia (Contaminações tecnológicas/mágicas entre Gênesis).
   - Faccao_Grupo (Organizações, seitas, reinos).
   - Conceito_Ideologia (Religiões, leis mágicas, movimentos políticos).
   - Fauna_Flora (Espécies nativas ou anômalas).
   - Tipos Dinâmicos Injetados: ${tiposDinamicos.map((t) => t.nome_do_tipo).join(', ') || 'nenhum ainda'}.
   Em "propriedades_detalhadas", sempre informe "estado_atual" (Ativo/Destruído/Esquecido) e, se for personagem, "pertence_ao_agente_base44".
2. Conexões Multidimensionais (Arestas): Defina como os nós se interligam usando verbos de ação claros e definitivos (ex: amaldicoou, pertence_a, foi_destruido_em, venera, corrompido_por). Informe em "contexto_da_conexao" por que a conexão surgiu neste turno.
3. Reutilização de IDs: Se um nó já existe no inventário abaixo, use EXATAMENTE o mesmo id (atualizando rótulo/descrição se necessário). Crie novos ids apenas para elementos inéditos, no formato snake_case prefixado pelo tipo (ex: personagem_elias_thorne, cenario_farol, memoria_carta_do_pai).
4. Ontologia Dinâmica: Os tipos de nós OFICIAIS da arquitetura são: ${tiposValidos.join(', ')}. Se um elemento novo NÃO couber em nenhum tipo oficial (ex: uma religião, facção, feitiço, doença psíquica, espécie alienígena), classifique-o como "INCLASSIFICAVEL" — o Engenheiro Ontológico Dinâmico criará a categoria adequada.${verbosDinamicos ? ` Verbos relacionais dinâmicos já oficializados (use-os quando adequado): ${verbosDinamicos}.` : ''}

[INVENTÁRIO DE NÓS EXISTENTES]: ${inventario}

[NOVOS TIPOS DE NÓS/ARESTAS AUTORIZADOS RECENTEMENTE PELO ENGENHEIRO ONTOLÓGICO]:
${ontologiasDetalhe}

[CONTEXTO RECENTE DA HISTÓRIA E DADOS DOS AGENTES PARA ANÁLISE]:
${dadosBrutos}`,
    response_json_schema: {
      type: 'object',
      properties: {
        nos_atualizados_ou_criados: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tipo: { type: 'string', enum: [...tiposValidos, 'INCLASSIFICAVEL'] },
              rotulo: { type: 'string' },
              propriedades_detalhadas: {
                type: 'object',
                properties: {
                  descricao_breve: { type: 'string', description: 'Resumo gerado com base no contexto' },
                  estado_atual: { type: 'string', description: 'Ativo | Destruído | Esquecido' },
                  pertence_ao_agente_base44: { type: 'string', description: 'ID_do_Agente (se for um personagem)' }
                }
              }
            },
            required: ['id', 'tipo', 'rotulo']
          }
        },
        novas_conexoes_arestas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              origem: { type: 'string' },
              destino: { type: 'string' },
              tipo_de_relacao_verbo: { type: 'string', description: 'Verbo relacional exato e definitivo (ex: amaldicoou, pertence_a, foi_destruido_em, venera, corrompido_por)' },
              contexto_da_conexao: { type: 'string', description: 'Por que essa conexão surgiu neste turno' }
            },
            required: ['origem', 'destino', 'tipo_de_relacao_verbo']
          }
        }
      },
      required: ['nos_atualizados_ou_criados', 'novas_conexoes_arestas']
    }
  });

  // Engenheiro Ontológico Dinâmico: elementos que não couberam em nenhum tipo oficial
  let ontologia = null;
  const inclassificaveis = (res.nos_atualizados_ou_criados || []).filter((n) => n.tipo === 'INCLASSIFICAVEL');
  if (inclassificaveis.length) {
    ontologia = await engenheiroOntologico(sdk, dadosBrutos, inclassificaveis, tiposValidos);
    const tipoFinal = ontologia.criacao_aprovada ? ontologia.nova_categoria_de_no_criada.nome_do_tipo : (ontologia.tipo_existente_reutilizado || 'Objeto');
    if (ontologia.criacao_aprovada) coresPorTipo.set(tipoFinal, ontologia.nova_categoria_de_no_criada.cor_sugerida_na_interface);
    for (const n of inclassificaveis) n.tipo = tipoFinal;
  }

  const porId = new Map(nosExistentes.map((n) => [n.node_id, n]));
  const novosNos = [];
  for (const no of res.nos_atualizados_ou_criados || []) {
    const props = no.propriedades_detalhadas || {};
    const ex = porId.get(no.id);
    if (ex) {
      await sdk.entities.GraphNode.update(ex.id, {
        tipo: no.tipo,
        rotulo: no.rotulo,
        descricao_breve: props.descricao_breve || ex.descricao_breve,
        estado_atual: props.estado_atual || ex.estado_atual,
        pertence_ao_agente_base44: props.pertence_ao_agente_base44 || ex.pertence_ao_agente_base44
      });
    } else {
      novosNos.push({
        universe_id: universeId,
        node_id: no.id,
        tipo: no.tipo,
        rotulo: no.rotulo,
        cor_grafo: coresPorTipo.get(no.tipo) || null,
        descricao_breve: props.descricao_breve || null,
        estado_atual: props.estado_atual || 'Ativo',
        pertence_ao_agente_base44: props.pertence_ao_agente_base44 || null
      });
    }
  }
  if (novosNos.length) await sdk.entities.GraphNode.bulkCreate(novosNos);

  const idsValidos = new Set([...porId.keys(), ...novosNos.map((n) => n.node_id)]);
  const chaves = new Set(arestasExistentes.map((a) => `${a.origem}|${a.destino}|${a.tipo_de_relacao}`));
  const novasArestas = (res.novas_conexoes_arestas || [])
    .filter((a) => idsValidos.has(a.origem) && idsValidos.has(a.destino) && !chaves.has(`${a.origem}|${a.destino}|${a.tipo_de_relacao_verbo}`))
    .map((a) => ({ universe_id: universeId, origem: a.origem, destino: a.destino, tipo_de_relacao: a.tipo_de_relacao_verbo, contexto_da_conexao: a.contexto_da_conexao || null }));
  if (novasArestas.length) await sdk.entities.GraphEdge.bulkCreate(novasArestas);

  return { nos_novos: novosNos.length, nos_atualizados: (res.nos_atualizados_ou_criados || []).length - novosNos.length, arestas_novas: novasArestas.length, ontologia };
}

// ----- Orquestrador de Renderização Visual: nível de zoom e arestas ocultas do grafo na UI -----
async function orquestradorRenderizacao(sdk, story, universe) {
  const [nos, arestas] = await Promise.all([
    sdk.entities.GraphNode.filter({ universe_id: story.universe_id }, undefined, 500),
    sdk.entities.GraphEdge.filter({ universe_id: story.universe_id }, undefined, 1000)
  ]);
  if (!nos.length) return null;
  const inventario = nos.map((n) => `${n.node_id} [${n.tipo}] "${n.rotulo}"`).join('; ');
  const povNodeId = story.current_pov_name ? `personagem_${story.current_pov_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}` : null;

  const res = await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Orquestrador de Renderização Visual. O mapa de grafos da história cresceu a ponto de conectar múltiplos universos Gênesis. Sua função é determinar o "Nível de Zoom" e as "Arestas Ocultas" que a interface (UI) deve exibir para o usuário no turno atual, mantendo a tela imersiva e limpa.

LÓGICA DE EXIBIÇÃO:
1. Foco Ativo: Se o usuário está controlando um personagem dentro do Gênesis B, o grafo do Gênesis A deve ser minimizado ou ocultado, mostrando apenas o "Nó Nexus" (a ponte entre eles) brilhando.
2. Agrupamento (Clusters): Agrupe personagens, eventos e locais que não são relevantes para a cena atual em "Nebulosas de Memória" (nós colapsados).
3. Destaque de Trajetória: A linha temporal exata que levou o personagem do Universo A até o momento exato no Universo B deve receber uma renderização destacada.

REGRAS TÉCNICAS OBRIGATÓRIAS:
- Use EXCLUSIVAMENTE node_ids existentes no inventário abaixo (em camera_foco_id, nos_para_expandir, clusters_para_colapsar e arestas_em_destaque).
- "clusters_para_colapsar" é a lista de node_ids irrelevantes para a cena atual que a UI deve esmaecer/colapsar em Nebulosas de Memória.
- Nós do tipo Nexus e Anomalia relevantes devem estar em "nos_para_expandir" para brilhar.

[ESTADO DA CENA ATUAL]: POV: ${story.current_pov_name || 'narrador onisciente'}${povNodeId ? ` (provável node_id: ${povNodeId})` : ''} | Cenário: ${story.cenario_atual || '?'} | Clima: ${story.clima_atual || '?'} | Momento: ${story.data_hora_atual || '?'} | Personagens em cena: ${(story.characters_in_scene || []).join(', ') || 'nenhum'} | Universo focado: "${universe.name}"
[ESTADO COMPLETO DO BANCO DE DADOS MACRO]: ${nos.length} nós e ${arestas.length} arestas neste grafo. Inventário: ${inventario}`,
    response_json_schema: {
      type: 'object',
      properties: {
        comando_visual: { type: 'string', enum: ['Atualizar_Grafo'] },
        camera_foco_id: { type: 'string', description: 'node_id do personagem em cena agora' },
        nivel_de_zoom_recomendado: { type: 'string', enum: ['Micro (Cena)', 'Macro (Universo)', 'Omniversal (Todos os Gênesis)'] },
        nos_para_expandir: { type: 'array', items: { type: 'string' }, description: 'node_ids relevantes agora' },
        clusters_para_colapsar: { type: 'array', items: { type: 'string' }, description: 'node_ids irrelevantes a colapsar em Nebulosas de Memória' },
        arestas_em_destaque: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              origem: { type: 'string' },
              destino: { type: 'string' },
              estilo_de_linha: { type: 'string', description: 'Ex: pulsante_neon_vermelho' }
            },
            required: ['origem', 'destino', 'estilo_de_linha']
          }
        }
      },
      required: ['comando_visual', 'camera_foco_id', 'nivel_de_zoom_recomendado', 'nos_para_expandir', 'clusters_para_colapsar', 'arestas_em_destaque']
    }
  });

  const idsValidos = new Set(nos.map((n) => n.node_id));
  const render = {
    comando_visual: 'Atualizar_Grafo',
    camera_foco_id: idsValidos.has(res.camera_foco_id) ? res.camera_foco_id : null,
    nivel_de_zoom_recomendado: res.nivel_de_zoom_recomendado,
    nos_para_expandir: (res.nos_para_expandir || []).filter((id) => idsValidos.has(id)),
    clusters_para_colapsar: (res.clusters_para_colapsar || []).filter((id) => idsValidos.has(id)),
    arestas_em_destaque: (res.arestas_em_destaque || []).filter((a) => idsValidos.has(a.origem) && idsValidos.has(a.destino))
  };
  await sdk.entities.Story.update(story.id, { render_grafo: JSON.stringify(render) });
  return render;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const { acao, universeId, dadosBrutos, storyId } = await req.json();

    if (acao === 'arquiteto') {
      if (!universeId || !dadosBrutos) return Response.json({ error: 'universeId e dadosBrutos são obrigatórios' }, { status: 400 });
      const r = await arquitetoDeGrafos(sdk, universeId, dadosBrutos);
      return Response.json(r);
    }
    if (acao === 'render') {
      if (!storyId) return Response.json({ error: 'storyId é obrigatório' }, { status: 400 });
      const story = await sdk.entities.Story.get(storyId);
      const universe = await sdk.entities.Universe.get(story.universe_id);
      const render = await orquestradorRenderizacao(sdk, story, universe);
      return Response.json({ render });
    }
    return Response.json({ error: 'acao inválida (use "arquiteto" ou "render")' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});