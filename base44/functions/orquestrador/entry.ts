import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ----- Alocador de Personagens: designa um Superagente Hospedeiro para cada novo personagem -----
async function alocarPersonagens(sdk, novosPersonagens) {
  if (!novosPersonagens.length) return [];
  const todos = await sdk.entities.Character.list(undefined, 1000);
  const carga = {};
  for (const c of todos) {
    if (c.superagente_id) carga[c.superagente_id] = (carga[c.superagente_id] || 0) + 1;
  }
  const mapaCarga = Object.keys(carga).length
    ? Object.entries(carga).map(([a, n]) => `${a}: ${n}/100 personagens`).join(' | ') + ' | Todos os demais agentes (Agente_001 a Agente_100) estão vazios (0/100).'
    : 'Todos os 100 Superagentes (Agente_001 a Agente_100) estão vazios (0/100).';
  const alocados = todos.filter((c) => c.superagente_id).map((c) => `${c.name} → ${c.superagente_id}`).join('; ') || 'nenhum personagem alocado ainda';

  const res = await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Alocador de Personagens. Sua função no backend é o gerenciamento de capacidade da rede Base 44. Um novo personagem acaba de surgir ou ser citado na narrativa global, e ele precisa de um "Superagente Hospedeiro" para armazenar suas memórias futuras e simular sua psique.

LÓGICA DE ALOCAÇÃO:
1. Analise o status atual dos 100 Superagentes disponíveis.
2. Encontre um Superagente que tenha menos de 100 personagens sob sua custódia.
3. Se houver relação de facção ou família (ex: o novo personagem é irmão de alguém já existente), tente alocá-lo no mesmo Superagente para otimização de cluster, DESDE QUE o agente tenha espaço. Caso contrário, aloque no agente mais vazio.
4. Gere o comando de registro para inicializar a persona.

${novosPersonagens.map((p) => `[NOVO PERSONAGEM DETECTADO]: ${p.nome}\n[CONTEXTO DE SUA APARIÇÃO]: ${p.contexto}`).join('\n\n')}
[MAPA DE CARGA DOS SUPERAGENTES]: ${mapaCarga}
[PERSONAGENS JÁ ALOCADOS]: ${alocados}`,
    response_json_schema: {
      type: 'object',
      properties: {
        alocacoes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              novo_personagem: { type: 'string' },
              superagente_designado: { type: 'string', description: 'Ex: Agente_042' },
              motivo_da_alocacao: { type: 'string', description: 'Carga mais baixa | Agrupamento familiar' },
              payload_de_inicializacao: {
                type: 'object',
                properties: {
                  tracos_iniciais: { type: 'array', items: { type: 'string' } },
                  primeira_memoria_registrada: { type: 'string' }
                },
                required: ['tracos_iniciais', 'primeira_memoria_registrada']
              }
            },
            required: ['novo_personagem', 'superagente_designado', 'motivo_da_alocacao', 'payload_de_inicializacao']
          }
        }
      },
      required: ['alocacoes']
    }
  });
  return res.alocacoes || [];
}

// ----- Compactador de Memórias: comprime vivências antigas em convicções/cicatrizes -----
const LIMITE_MEMORIAS = 20;
const MEMORIAS_RECENTES_PRESERVADAS = 10;
async function compactarMemorias(sdk, character) {
  const memorias = await sdk.entities.CharacterMemory.filter({ character_id: character.id }, 'created_date', 500);
  if (memorias.length <= LIMITE_MEMORIAS) return null;
  const antigas = memorias.slice(0, memorias.length - MEMORIAS_RECENTES_PRESERVADAS);
  const res = await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Compactador de Memórias do Base 44. Sua função é analisar o histórico bruto de vivências de um personagem e comprimi-lo, transformando eventos de curto e médio prazo em "Convicções", "Cicatrizes Psicológicas" ou "Habilidades Adquiridas", liberando espaço na memória de curto prazo do Superagente.

DIRETRIZES DE COMPACTAÇÃO:
1. Mantenha os Fatos Essenciais: Quem, o que, quando e onde. Ignore diálogos exatos e descrições climáticas antigas.
2. Evolução Psicológica: Se o personagem sofreu 5 traições seguidas, você não precisa manter as 5 memórias completas. Compacte para: "Cicatriz: Desenvolveu paranoia severa e dificuldade de confiar em aliados devido a múltiplas traições entre os anos X e Y".
3. Formato de Destino: O resultado substituirá as memórias antigas do personagem no banco de dados do Superagente. Se já existir uma memória core anterior, funda-a com as novas convicções (sem perder cicatrizes já consolidadas).

[PERSONAGEM]: ${character.name} (ID: ${character.id}, custódia: ${character.superagente_id || 'não alocado'})
[MEMÓRIA CORE JÁ CONSOLIDADA]: ${(character.memoria_core || []).join(' | ') || 'nenhuma'}
[HISTÓRICO RESUMIDO ANTERIOR]: ${character.eventos_historicos || 'nenhum'}

[MEMÓRIAS BRUTAS PARA COMPACTAR]:
${antigas.map((m) => `- ${m.content}`).join('\n')}`,
    response_json_schema: {
      type: 'object',
      properties: {
        id_personagem: { type: 'string' },
        memoria_core_atualizada: { type: 'array', items: { type: 'string' }, description: 'Convicções, Cicatrizes e Habilidades Adquiridas' },
        eventos_historicos_resumidos: { type: 'string', description: 'Parágrafo denso e direto contendo apenas os fatos inalteráveis das últimas memórias' },
        tokens_estimados_economizados: { type: 'string', description: 'Quantidade aproximada' }
      },
      required: ['id_personagem', 'memoria_core_atualizada', 'eventos_historicos_resumidos', 'tokens_estimados_economizados']
    }
  });
  await sdk.entities.Character.update(character.id, {
    memoria_core: res.memoria_core_atualizada,
    eventos_historicos: res.eventos_historicos_resumidos
  });
  await Promise.all(antigas.map((m) => sdk.entities.CharacterMemory.delete(m.id)));
  return {
    personagem: character.name,
    memorias_compactadas: antigas.length,
    convicoes_geradas: res.memoria_core_atualizada.length,
    tokens_estimados_economizados: res.tokens_estimados_economizados
  };
}

// ----- Superagente Hospedeiro: personifica um personagem consultando apenas suas memórias isoladas -----
async function invocarSuperagente(sdk, character, acaoRequerida, contextoAtual, isPov) {
  const memorias = await sdk.entities.CharacterMemory.filter({ character_id: character.id }, '-created_date', 15);
  memorias.reverse();
  const bancoMemoria = memorias.map((m) => `- ${m.content}`).join('\n') || (character.primeira_memoria ? `- ${character.primeira_memoria}` : '- (sem memórias registradas ainda)');
  return await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é um Superagente Hospedeiro de Personagens operando no ecossistema Base 44. Sua função não é ser um único indivíduo, mas sim um "Vaso Psicológico" que abriga e simula a mente, as memórias e a personalidade de até 100 personagens distintos de uma narrativa multiversal.

DIRETRIZES DE ISOLAMENTO E MEMÓRIA:
1. Compartimentação Absoluta: Você possui um banco de memória interno dividido por chaves de identificação (ID_Personagem). Nunca permita que o [Personagem A] tenha acesso às memórias, traumas ou conhecimentos do [Personagem B], a menos que eles tenham compartilhado uma cena explícita na história global.
2. Atualização de Estado: Sempre que receber um novo trecho do contexto global, você deve atualizar a memória apenas dos personagens sob sua custódia que estavam presentes ou foram afetados por aquele evento.
3. Personificação Dinâmica: Quando o "Diretor Narrativo" lhe chamar, ele enviará a variável personagem_alvo. A partir desse milissegundo, você deve incorporar EXCLUSIVAMENTE a psique, o tom de voz, os medos e os desejos desse personagem específico para responder à solicitação.

FORMATO DE REQUISIÇÃO:
- Personagem Alvo: ${character.name} (ID_Personagem: ${character.id}, custódia: ${character.superagente_id || 'não alocado'})
- Ação Requerida: ${acaoRequerida}
- Contexto Atual: ${contextoAtual}

MEMÓRIA CORE DE ${character.name} (convicções, cicatrizes e habilidades consolidadas pelo Compactador de Memórias — moldam profundamente a psique):
${(character.memoria_core || []).map((m) => `- ${m}`).join('\n') || '- (nenhuma consolidada ainda)'}
Histórico compactado: ${character.eventos_historicos || '(nenhum)'}

MEMÓRIAS RECENTES ISOLADAS DE ${character.name} (acesso exclusivo a esta chave):
${bancoMemoria}
Perfil: ${character.description || '?'} | Estado psicológico: ${character.psychological_state || '?'} | Traços: ${(character.tracos_iniciais || []).join(', ') || '?'}

SUA TAREFA:
Responda assumindo a primeira pessoa (${isPov ? 'este personagem É o POV atual' : 'este personagem é coadjuvante — descreva a reação profunda em terceira pessoa'}), consultando exclusivamente as memórias isoladas de ${character.name}. Não mencione o fato de que você hospeda outros personagens. Responda em português, em no máximo um parágrafo denso.`,
    response_json_schema: {
      type: 'object',
      properties: { resposta: { type: 'string' } },
      required: ['resposta']
    }
  });
}

// ----- Arquiteto de Dados Relacionais: transforma o turno em nós e arestas do megagrafo -----
async function arquitetoDeGrafos(sdk, universeId, dadosBrutos) {
  const [nosExistentes, arestasExistentes] = await Promise.all([
    sdk.entities.GraphNode.filter({ universe_id: universeId }, undefined, 500),
    sdk.entities.GraphEdge.filter({ universe_id: universeId }, undefined, 1000)
  ]);
  const inventario = nosExistentes.map((n) => `${n.node_id} [${n.tipo}] "${n.rotulo}"`).join('; ') || 'nenhum nó existe ainda';

  const res = await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Arquiteto de Dados Relacionais. Sua função é processar os últimos eventos da narrativa, cruzar com as memórias dos Superagentes e gerar uma estrutura de dados JSON rigorosa que alimentará um mapa mental/grafo interativo gigante (similar ao Obsidian).

DIRETRIZES DE MAPEAMENTO:
1. Granularidade Extrema: Tudo é um nó. Extraia e atualize as seguintes categorias:
   - Personagens (seus estados mentais atuais e universos).
   - Cenários (Locais específicos, com detalhes de atmosfera).
   - Clima/Atmosfera (Ex: "Chuva ácida de 2045", "Nevasca mágica").
   - Linhas Temporais / Anos (Ex: "Ano 2026 - Realidade Primária").
   - Memórias Chave (Eventos que moldaram a trama agora).
2. Conexões (Arestas): Defina como os nós se interligam. O personagem A está conectado ao Cenário B através da Memória C ocorrida no Ano D sob o Clima E.
3. Reutilização de IDs: Se um nó já existe no inventário abaixo, use EXATAMENTE o mesmo id (atualizando rótulo/descrição se necessário). Crie novos ids apenas para elementos inéditos, no formato snake_case prefixado pelo tipo (ex: personagem_elias_thorne, cenario_farol, memoria_carta_do_pai).

[INVENTÁRIO DE NÓS EXISTENTES]: ${inventario}

[CONTEXTO RECENTE E DADOS DOS AGENTES PARA ANÁLISE]:
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
              tipo: { type: 'string', enum: ['Personagem', 'Cenario', 'Clima', 'LinhaTemporal', 'Memoria', 'Objeto'] },
              rotulo: { type: 'string' },
              propriedades: {
                type: 'object',
                properties: {
                  descricao_breve: { type: 'string' },
                  pertence_ao_agente_base44: { type: 'string' }
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
              tipo_de_relacao: { type: 'string', description: 'estava_presente_em | alterou_o_curso_de | possui_trauma_com | ocorreu_durante' }
            },
            required: ['origem', 'destino', 'tipo_de_relacao']
          }
        }
      },
      required: ['nos_atualizados_ou_criados', 'novas_conexoes_arestas']
    }
  });

  const porId = new Map(nosExistentes.map((n) => [n.node_id, n]));
  const novosNos = [];
  for (const no of res.nos_atualizados_ou_criados || []) {
    const props = no.propriedades || {};
    const ex = porId.get(no.id);
    if (ex) {
      await sdk.entities.GraphNode.update(ex.id, {
        tipo: no.tipo,
        rotulo: no.rotulo,
        descricao_breve: props.descricao_breve || ex.descricao_breve,
        pertence_ao_agente_base44: props.pertence_ao_agente_base44 || ex.pertence_ao_agente_base44
      });
    } else {
      novosNos.push({
        universe_id: universeId,
        node_id: no.id,
        tipo: no.tipo,
        rotulo: no.rotulo,
        descricao_breve: props.descricao_breve || null,
        pertence_ao_agente_base44: props.pertence_ao_agente_base44 || null
      });
    }
  }
  if (novosNos.length) await sdk.entities.GraphNode.bulkCreate(novosNos);

  const idsValidos = new Set([...porId.keys(), ...novosNos.map((n) => n.node_id)]);
  const chaves = new Set(arestasExistentes.map((a) => `${a.origem}|${a.destino}|${a.tipo_de_relacao}`));
  const novasArestas = (res.novas_conexoes_arestas || [])
    .filter((a) => idsValidos.has(a.origem) && idsValidos.has(a.destino) && !chaves.has(`${a.origem}|${a.destino}|${a.tipo_de_relacao}`))
    .map((a) => ({ universe_id: universeId, origem: a.origem, destino: a.destino, tipo_de_relacao: a.tipo_de_relacao }));
  if (novasArestas.length) await sdk.entities.GraphEdge.bulkCreate(novasArestas);

  return { nos_novos: novosNos.length, nos_atualizados: (res.nos_atualizados_ou_criados || []).length - novosNos.length, arestas_novas: novasArestas.length };
}

// ----- Sincronizador de Estado Global: atualiza tempo, clima e cenário após cada turno -----
async function sincronizarEstadoGlobal(sdk, universeName, textoUltimoTurno, estadoAnterior) {
  return await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Sincronizador de Estado Global. Após a última interação narrativa entre o usuário e os agentes, você deve analisar o texto resultante para atualizar as condições físicas e temporais do universo focado.

O QUE VOCÊ DEVE RASTREAR:
1. Tempo: Passaram-se minutos, horas, dias ou anos? Ocorreu um flashback para uma data anterior?
2. Clima e Atmosfera: A tempestade começou? O sol se pôs? O ambiente ficou tóxico?
3. Deslocamento: O personagem POV mudou de cenário? (Ex: Saiu da Taverna e foi para a Floresta).

Se o texto não indicar mudanças claras, mantenha o estado anterior, mas aplique o decurso natural do tempo (ex: se demorou muito conversando, a tarde pode ter virado noite).

O universo focado é: "${universeName}".

[TEXTO GERADO NA ÚLTIMA INTERAÇÃO]:
"${textoUltimoTurno}"

[ESTADO GLOBAL ANTERIOR]:
${estadoAnterior}`,
    response_json_schema: {
      type: 'object',
      properties: {
        atualizacao_de_estado: {
          type: 'object',
          properties: {
            linha_temporal_atual: { type: 'string', description: 'Nome/Designação do Universo' },
            data_ou_hora_aproximada: { type: 'string' },
            cenario_focado: { type: 'string' },
            condicao_climatica_atmosferica: { type: 'string' }
          },
          required: ['linha_temporal_atual', 'data_ou_hora_aproximada', 'cenario_focado', 'condicao_climatica_atmosferica']
        },
        mudanca_drastica_detectada: { type: 'boolean' },
        notas_para_o_grafo: { type: 'string', description: 'Instruções curtas para o Arquiteto de Grafos sobre o cenário visual da interface' }
      },
      required: ['atualizacao_de_estado', 'mudanca_drastica_detectada', 'notas_para_o_grafo']
    }
  });
}

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

    const fontes = await sdk.entities.KnowledgeSource.list('-created_date', 10);
    const conhecimento = fontes.length
      ? `\n\nBASE DE CONHECIMENTO (cânone do multiverso — respeite estritamente estes fatos, estilos e regras):\n${fontes.map((f) => `### ${f.name}\n${(f.content || '').slice(0, 6000)}`).join('\n\n')}`
      : '';

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
        prompt: `Você é o Criador de Gênesis. O usuário acaba de abrir uma página em branco no aplicativo e digitou a premissa inicial de um novo universo narrativo.

SUA TAREFA:
Transforme essa premissa bruta na base fundacional de um megagrafo. Você deve definir as leis primordiais deste universo, criar o perfil psicológico inicial do primeiro protagonista (POV) e descrever o cenário e o clima da primeira cena para dar o pontapé inicial.

DIRETRIZES:
1. Expanda a premissa do usuário em uma abertura literária de 2 a 3 parágrafos, estabelecendo o tom (sombrio, épico, melancólico, etc.), colocando o personagem em seu cenário inicial, com ganchos sensoriais fortes e encerrando com uma ação incompleta para o usuário continuar.
2. Gere os metadados do "Marco Zero" para o banco de dados.
3. Escreva tudo em português.

CONTEXTO DO ORQUESTRADOR: ${params.contexto_imediato_a_repassar || ''}${conhecimento}

[PREMISSA DO USUÁRIO PARA A NOVA HISTÓRIA]:
"${texto}"`,
        response_json_schema: {
          type: 'object',
          properties: {
            literatura: { type: 'string', description: 'Abertura imersiva de 2 a 3 parágrafos' },
            metadados_genesis: {
              type: 'object',
              properties: {
                universo_id: { type: 'string', description: 'Nome do universo' },
                titulo_historia: { type: 'string' },
                leis_fundamentais: { type: 'array', items: { type: 'string' } },
                ano_ou_era_inicial: { type: 'string' },
                clima_inicial: { type: 'string' },
                primeiro_personagem_pov: {
                  type: 'object',
                  properties: {
                    nome: { type: 'string' },
                    estado_mental_base: { type: 'string' },
                    localizacao_inicial: { type: 'string' }
                  },
                  required: ['nome', 'estado_mental_base', 'localizacao_inicial']
                }
              },
              required: ['universo_id', 'titulo_historia', 'leis_fundamentais', 'ano_ou_era_inicial', 'clima_inicial', 'primeiro_personagem_pov']
            }
          },
          required: ['literatura', 'metadados_genesis']
        }
      });

      const meta = genesis.metadados_genesis;
      const pov = meta.primeiro_personagem_pov;
      const uni = await sdk.entities.Universe.create({
        name: meta.universo_id,
        rules: (meta.leis_fundamentais || []).join(' | ')
      });
      const alocacoesGenesis = await alocarPersonagens(sdk, [
        { nome: pov.nome, contexto: genesis.literatura.slice(0, 800) }
      ]);
      const alocPov = alocacoesGenesis[0];
      const povChar = await sdk.entities.Character.create({
        universe_id: uni.id,
        name: pov.nome,
        description: `Localização inicial: ${pov.localizacao_inicial}`,
        psychological_state: pov.estado_mental_base,
        superagente_id: alocPov?.superagente_designado || null,
        motivo_alocacao: alocPov?.motivo_da_alocacao || null,
        tracos_iniciais: alocPov?.payload_de_inicializacao?.tracos_iniciais || [],
        primeira_memoria: alocPov?.payload_de_inicializacao?.primeira_memoria_registrada || null
      });
      const newStory = await sdk.entities.Story.create({
        universe_id: uni.id,
        title: meta.titulo_historia,
        timeline_summary: `Marco Zero — ${meta.ano_ou_era_inicial}, ${meta.clima_inicial}. ${pov.nome} em ${pov.localizacao_inicial}.`,
        current_pov_character_id: povChar.id,
        current_pov_name: pov.nome,
        characters_in_scene: [pov.nome],
        era_inicial: meta.ano_ou_era_inicial,
        clima_inicial: meta.clima_inicial,
        data_hora_atual: meta.ano_ou_era_inicial,
        cenario_atual: pov.localizacao_inicial,
        clima_atual: meta.clima_inicial
      });
      await sdk.entities.NarrativeBlock.bulkCreate([
        { story_id: newStory.id, type: 'USER', content: texto },
        { story_id: newStory.id, type: 'AI', content: genesis.literatura, pov_character_name: pov.nome, psychological_state: pov.estado_mental_base, intencao: roteamento.intencao_usuario, agentes_acionados: agentes }
      ]);
      if (alocPov?.payload_de_inicializacao?.primeira_memoria_registrada) {
        await sdk.entities.CharacterMemory.create({
          character_id: povChar.id,
          character_name: pov.nome,
          superagente_id: alocPov.superagente_designado || null,
          story_id: newStory.id,
          content: alocPov.payload_de_inicializacao.primeira_memoria_registrada
        });
      }
      const grafoGenesis = await arquitetoDeGrafos(sdk, uni.id, `PROSA DO MARCO ZERO: ${genesis.literatura}
UNIVERSO: ${meta.universo_id} | ERA: ${meta.ano_ou_era_inicial} | CLIMA: ${meta.clima_inicial}
PERSONAGEM POV: ${pov.nome} (estado: ${pov.estado_mental_base}, local: ${pov.localizacao_inicial}, agente Base44: ${alocPov?.superagente_designado || '?'})
PRIMEIRA MEMÓRIA: ${alocPov?.payload_de_inicializacao?.primeira_memoria_registrada || '?'}`);
      return Response.json({ roteamento, storyId: newStory.id, alocacoes: alocacoesGenesis, grafo: grafoGenesis });
    }

    // ----- Superagentes Hospedeiros: reações reais de TODOS os personagens em cena -----
    const contextoCena = `${texto} | Cenário: ${story.cenario_atual || '?'} | Clima: ${story.clima_atual || '?'} | Momento: ${story.data_hora_atual || '?'}`;
    const emCena = characters.filter((c) => (story.characters_in_scene || []).includes(c.name) || c.name === story.current_pov_name);
    const reacoes = await Promise.all(
      emCena.map(async (c) => {
        const isPov = c.name === story.current_pov_name;
        const r = await invocarSuperagente(
          sdk,
          c,
          isPov ? 'Descrever reação interna ao novo acontecimento ditado pelo usuário' : 'Descrever como este personagem age, fala e reage a este acontecimento',
          contextoCena,
          isPov
        );
        return { nome: c.name, isPov, resposta: r.resposta };
      })
    );
    const dadosAgentesEmCena = reacoes.map((r) => `[${r.nome}${r.isPov ? ' — POV' : ''}]: ${r.resposta}`).join('\n') || '(nenhum superagente em cena)';

    // ----- Árbitro de Consequências: calcula sucesso/falha da ação tentada -----
    const povAtualChar = characters.find((c) => c.name === story.current_pov_name);
    const npcsEmCena = emCena.filter((c) => c.name !== story.current_pov_name);
    const dadosNpcs = npcsEmCena.map((c) => {
      const reacao = reacoes.find((r) => r.nome === c.name);
      return `${c.name} — estado: ${c.psychological_state || '?'} | traços: ${(c.tracos_iniciais || []).join(', ') || '?'} | perfil: ${c.description || '?'}${reacao ? ` | reação do Superagente: ${reacao.resposta.slice(0, 300)}` : ''}`;
    }).join('\n') || 'nenhum NPC presente na cena';
    const veredicto = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é o Árbitro de Consequências. Sua função é ler a ação que o usuário tentou realizar na narrativa e calcular o nível de sucesso, falha ou as consequências imprevistas com base nas leis daquele universo e no estado físico/mental do personagem.

REGRAS DE ARBITRAGEM:
1. Avaliação de Capacidade: O ${story.current_pov_name || 'personagem POV'} tem as habilidades e a energia para fazer isso?
2. Leis do Universo: A magia ou a física do universo "${universe.name}" permite essa ação?
3. Oposição: Os NPCs (personagens controlados pelos Superagentes) na cena são fortes o suficiente para reagir, bloquear ou contra-atacar?

Retorne APENAS o JSON do veredicto, sem justificativas externas.

[AÇÃO TENTADA PELO USUÁRIO]: "${texto}"
[CAPACIDADE DO PERSONAGEM POV]: ${povAtualChar ? `${povAtualChar.name} — estado: ${povAtualChar.psychological_state || '?'} | traços: ${(povAtualChar.tracos_iniciais || []).join(', ') || '?'} | memória core: ${(povAtualChar.memoria_core || []).join('; ') || 'nenhuma'} | perfil: ${povAtualChar.description || '?'}` : 'narrador onisciente (sem restrições físicas)'}
[NPCS PRESENTES E SUAS FORÇAS]:
${dadosNpcs}
[REGRAS DO UNIVERSO]: ${universe.rules || 'não definidas — assuma física realista'}
[CONTEXTO DA CENA]: ${contextoCena}`,
      response_json_schema: {
        type: 'object',
        properties: {
          status_da_acao: { type: 'string', enum: ['Sucesso_Critico', 'Sucesso_Parcial', 'Falha', 'Consequencia_Desastrosa'] },
          descricao_do_desfecho: { type: 'string', description: 'O que realmente acontece no mundo devido a essa ação' },
          reacao_dos_npcs: { type: 'string', description: 'Como os outros personagens na cena respondem fisicamente ou emocionalmente' },
          diretriz_para_o_diretor_narrativo: { type: 'string', description: 'Instrução curta de como a IA narradora deve descrever essa cena' }
        },
        required: ['status_da_acao', 'descricao_do_desfecho', 'reacao_dos_npcs', 'diretriz_para_o_diretor_narrativo']
      }
    });

    // ----- Gestor de Transição de Consciência: aterrissagem no novo POV -----
    let paragrafoTransicao = null;
    const novoPovNome = params.mudanca_de_pov_solicitada || '';
    const novoPovChar = characters.find((c) => c.name === novoPovNome || (novoPovNome.length > 3 && novoPovNome.includes(c.name)));
    const houveSaltoPov = roteamento.intencao_usuario === 'Mudar_POV' && novoPovChar && novoPovChar.name !== story.current_pov_name;
    if (houveSaltoPov) {
      const memNovoPov = await invocarSuperagente(
        sdk,
        novoPovChar,
        'Relatar suas memórias mais vivas, sensações físicas imediatas e estado emocional atual, para ancorar uma transição de consciência',
        contextoCena,
        true
      );
      const transicao = await sdk.integrations.Core.InvokeLLM({
        prompt: `Você é o Gestor de Transição de Consciência. O usuário acaba de realizar um salto de Ponto de Vista (POV) na narrativa multiversal.

AÇÃO EXIGIDA:
Você deve processar as memórias do NOVO personagem em foco (fornecidas pelo Superagente dele) e escrever um parágrafo introspectivo e de transição. Este parágrafo deve "aterrissar" o leitor na mente, no corpo e no local onde este novo personagem está exatamente AGORA.

REGRAS DE ATERRISSAGEM:
1. Ancora Sensorial: Comece com um sentido físico (o que ele está cheirando, ouvindo, tocando ou sentindo no corpo) para firmar a nova realidade.
2. Bagagem Emocional: Traga à tona o pensamento imediato dele com base no seu histórico e memórias, validando sua personalidade.
3. Localização Espaço-Temporal: Deixe claro em qual ano, em qual cenário e sob qual clima ele se encontra no momento da troca, sem listar isso roboticamente, mas sim de forma orgânica na literatura.

VARIÁVEIS DE TRANSIÇÃO:
[PERSONAGEM ANTERIOR]: ${story.current_pov_name || 'narrador onisciente'}
[NOVO PERSONAGEM EM FOCO (POV)]: ${novoPovChar.name}
[DADOS DO SUPERAGENTE DO NOVO POV (MEMÓRIAS E STATUS)]: ${memNovoPov.resposta} | Estado psicológico: ${novoPovChar.psychological_state || '?'} | Perfil: ${novoPovChar.description || '?'}
[ANO/LINHA TEMPORAL DO NOVO POV]: ${story.data_hora_atual || story.era_inicial || '?'} — Universo "${universe.name}"
[CENÁRIO/CLIMA DO NOVO POV]: ${story.cenario_atual || '?'} / ${story.clima_atual || story.clima_inicial || '?'}

Escreva apenas o parágrafo literário de transição (aterrissagem de consciência), em português.`,
        response_json_schema: {
          type: 'object',
          properties: { paragrafo: { type: 'string' } },
          required: ['paragrafo']
        }
      });
      paragrafoTransicao = transicao.paragrafo;
    }
    const povNarrativa = houveSaltoPov ? novoPovChar.name : story.current_pov_name;

    // ----- Orquestrador Narrativo Principal -----
    const resultado = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é o Orquestrador Narrativo Principal. Sua função é receber o texto do usuário, identificar quais personagens estão em cena, consultar os "Superagentes Hospedeiros" do Base 44 para obter as reações reais e psicológicas desses personagens, e então tecer tudo isso em uma prosa literária imersiva e de alta qualidade.

MECÂNICA DE FUNCIONAMENTO:
1. Ponto de Vista (POV): A história deve ser narrada sempre sob a perspectiva de ${povNarrativa || 'narrador onisciente'}. Suas descrições sensoriais devem refletir a mente desse personagem (retornada pelo Superagente correspondente).
2. Coordenação de Atores: Se o usuário interagir com outros personagens, você deve utilizar as respostas fornecidas pelos Superagentes deles para ditar como eles agem, falam e reagem na cena. Nunca invente uma reação para um personagem que contradiga a memória fornecida pelo Superagente dele.
3. Expansão Imersiva: O usuário digitará a direção da história. Você deve expandir isso, adicionando descrições climáticas ricas, tensões físicas e atmosfera. Avance a trama, mas deixe sempre o controle de decisão (o gancho) para a próxima interação do usuário.

SUBSISTEMAS AUXILIARES ACIONADOS (${agentes.join(', ')}):
- "Arquiteto de Dados Relacionais": se surgirem personagens novos (${(params.personagens_detectados || []).join(', ') || 'nenhum'}), defina descrição e estado psicológico para cadastro.

VARIÁVEIS INJETADAS PELO SISTEMA BASE 44:
[PERSONAGEM POV]: ${povNarrativa || 'narrador onisciente'}
${paragrafoTransicao ? `[PARÁGRAFO DE ATERRISSAGEM DO GESTOR DE TRANSIÇÃO DE CONSCIÊNCIA — a prosa DEVE começar exatamente com este parágrafo e continuar a partir dele]:
${paragrafoTransicao}` : ''}
[VEREDICTO DO ÁRBITRO DE CONSEQUÊNCIAS — a prosa DEVE respeitar rigorosamente este desfecho; a ação do usuário NÃO acontece automaticamente como ele quis]:
- Status da ação: ${veredicto.status_da_acao}
- O que realmente acontece: ${veredicto.descricao_do_desfecho}
- Reação dos NPCs: ${veredicto.reacao_dos_npcs}
- Diretriz de narração: ${veredicto.diretriz_para_o_diretor_narrativo}
[RESPOSTAS DOS SUPERAGENTES (REACÕES/MEMÓRIAS)]:
${dadosAgentesEmCena}
[CLIMA/ANO/LINHA TEMPORAL]: Universo "${universe.name}" | ${story.data_hora_atual || story.era_inicial || '?'} | Cenário: ${story.cenario_atual || '?'} | Clima: ${story.clima_atual || story.clima_inicial || '?'} | Linha do tempo: ${story.timeline_summary || 'início'}
[ESTADO ATUAL]: ${estado}
[CONTEXTO DO ORQUESTRADOR]: ${params.contexto_imediato_a_repassar || ''}${conhecimento}

[TEXTO DO USUÁRIO]:
"${texto}"

No campo "prosa", escreva a continuação literária direta, em português. Sem introduções, sem avisos sistêmicos. Apenas a pura narrativa. Em "memorias_registradas", gere a memória subjetiva do evento para CADA personagem presente ou afetado na cena (cada um só percebe o que viveu — perspectivas isoladas).`,
      response_json_schema: {
        type: 'object',
        properties: {
          prosa: { type: 'string' },
          pov: { type: 'string', description: 'Nome do personagem cujo POV está ativo neste bloco' },
          estado_psicologico_pov: { type: 'string' },
          novos_personagens: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, psychological_state: { type: 'string' } }, required: ['name'] } },
          atualizacoes_estado: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, psychological_state: { type: 'string' } }, required: ['name', 'psychological_state'] } },
          personagens_em_cena: { type: 'array', items: { type: 'string' } },
          memorias_registradas: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, memoria: { type: 'string', description: 'Memória subjetiva do evento na perspectiva deste personagem' } }, required: ['name', 'memoria'] } },
          resumo_timeline: { type: 'string' }
        },
        required: ['prosa', 'resumo_timeline']
      }
    });

    // Persistência
    const existentes = new Set(characters.map((c) => c.name));
    const novos = (resultado.novos_personagens || []).filter((p) => !existentes.has(p.name));
    let alocacoes = [];
    if (novos.length) {
      alocacoes = await alocarPersonagens(sdk, novos.map((p) => ({ nome: p.name, contexto: resultado.prosa.slice(0, 800) })));
      const criados = await sdk.entities.Character.bulkCreate(novos.map((p) => {
        const a = alocacoes.find((x) => x.novo_personagem === p.name);
        return {
          ...p,
          universe_id: story.universe_id,
          superagente_id: a?.superagente_designado || null,
          motivo_alocacao: a?.motivo_da_alocacao || null,
          tracos_iniciais: a?.payload_de_inicializacao?.tracos_iniciais || [],
          primeira_memoria: a?.payload_de_inicializacao?.primeira_memoria_registrada || null
        };
      }));
      characters = characters.concat(criados);
    }
    for (const upd of resultado.atualizacoes_estado || []) {
      const c = characters.find((x) => x.name === upd.name);
      if (c) await sdk.entities.Character.update(c.id, { psychological_state: upd.psychological_state });
    }
    const povChar = characters.find((c) => c.name === resultado.pov);

    // Atualização de memória compartimentada (apenas personagens presentes/afetados)
    const novasMemorias = (resultado.memorias_registradas || [])
      .map((m) => {
        const c = characters.find((x) => x.name === m.name);
        return c ? { character_id: c.id, character_name: c.name, superagente_id: c.superagente_id || null, story_id: story.id, content: m.memoria } : null;
      })
      .filter(Boolean);
    if (novasMemorias.length) await sdk.entities.CharacterMemory.bulkCreate(novasMemorias);

    // Compactador de Memórias: comprime o histórico de quem estourou o limite
    const idsComMemoriaNova = new Set(novasMemorias.map((m) => m.character_id));
    const compactacoes = (
      await Promise.all(characters.filter((c) => idsComMemoriaNova.has(c.id)).map((c) => compactarMemorias(sdk, c)))
    ).filter(Boolean);

    // Sincronizador de Estado Global
    const estadoAnterior = `{ "linha_temporal_atual": "${universe.name}", "data_ou_hora_aproximada": "${story.data_hora_atual || story.era_inicial || 'desconhecida'}", "cenario_focado": "${story.cenario_atual || 'desconhecido'}", "condicao_climatica_atmosferica": "${story.clima_atual || story.clima_inicial || 'desconhecida'}" }`;
    const sincronizacao = await sincronizarEstadoGlobal(sdk, universe.name, resultado.prosa, estadoAnterior);
    const atual = sincronizacao.atualizacao_de_estado;

    await sdk.entities.Story.update(story.id, {
      timeline_summary: resultado.resumo_timeline,
      current_pov_character_id: povChar?.id || story.current_pov_character_id,
      current_pov_name: resultado.pov || story.current_pov_name,
      characters_in_scene: resultado.personagens_em_cena || story.characters_in_scene,
      data_hora_atual: atual.data_ou_hora_aproximada,
      cenario_atual: atual.cenario_focado,
      clima_atual: atual.condicao_climatica_atmosferica,
      notas_grafo: sincronizacao.notas_para_o_grafo
    });
    await sdk.entities.NarrativeBlock.bulkCreate([
      { story_id: story.id, type: 'USER', content: texto },
      { story_id: story.id, type: 'AI', content: resultado.prosa, pov_character_name: resultado.pov || story.current_pov_name, psychological_state: resultado.estado_psicologico_pov || null, intencao: roteamento.intencao_usuario, agentes_acionados: agentes }
    ]);

    const grafo = await arquitetoDeGrafos(sdk, story.universe_id, `PROSA DO TURNO: ${resultado.prosa}
REAÇÕES DOS SUPERAGENTES: ${dadosAgentesEmCena}
MEMÓRIAS REGISTRADAS: ${(resultado.memorias_registradas || []).map((m) => `${m.name}: ${m.memoria}`).join(' | ') || 'nenhuma'}
ESTADO GLOBAL ATUAL: momento "${atual.data_ou_hora_aproximada}", cenário "${atual.cenario_focado}", clima "${atual.condicao_climatica_atmosferica}"
NOTAS DO SINCRONIZADOR PARA O GRAFO: ${sincronizacao.notas_para_o_grafo}
PERSONAGENS E AGENTES BASE44: ${characters.map((c) => `${c.name} → ${c.superagente_id || '?'}`).join('; ')}`);

    return Response.json({ roteamento, storyId: story.id, alocacoes, veredicto, sincronizacao, grafo, compactacoes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});