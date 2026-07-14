import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ----- Cobrador de Tributos: 1 Crédito de Mensagem por turno + Créditos de Integração conforme a intenção -----
const CUSTO_INTEGRACAO_POR_INTENCAO = { Continuar: 5, Mudar_POV: 5, Criar_Nova_Historia: 10, Ramificar: 15, Colidir_Genesis: 15 };
async function cobrarTributo(sdk, wallet, intencao) {
  if (!wallet) return null;
  const custoIntegracao = CUSTO_INTEGRACAO_POR_INTENCAO[intencao] || 5;
  const saldoMensagem = (wallet.creditos_mensagem || 0) - 1;
  const saldoIntegracao = (wallet.creditos_integracao || 0) - custoIntegracao;
  await sdk.entities.UserWallet.update(wallet.id, {
    creditos_mensagem: saldoMensagem,
    creditos_integracao: saldoIntegracao
  });
  return { custo_mensagem: 1, custo_integracao: custoIntegracao, saldo_mensagem: saldoMensagem, saldo_integracao: saldoIntegracao };
}

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
${(character.conhecimentos_assimilados || []).length ? `\nCONHECIMENTOS JÁ ASSIMILADOS DESTE GÊNESIS (Assimilador de Conhecimento Multiversal — o personagem JÁ compreende estes elementos e NÃO deve reagir com surpresa extrema a eles novamente; nível de adaptação: ${character.nivel_adaptacao || '?'}):\n${(character.conhecimentos_assimilados || []).map((k) => `- ${k}`).join('\n')}` : ''}

SUA TAREFA:
Responda assumindo a primeira pessoa (${isPov ? 'este personagem É o POV atual' : 'este personagem é coadjuvante — descreva a reação profunda em terceira pessoa'}), consultando exclusivamente as memórias isoladas de ${character.name}. Não mencione o fato de que você hospeda outros personagens. Responda em português, em no máximo um parágrafo denso.`,
    response_json_schema: {
      type: 'object',
      properties: { resposta: { type: 'string' } },
      required: ['resposta']
    }
  });
}

// ----- Módulo de Quarentena Narrativa: estado de choque de viajantes em Gênesis alienígena -----
async function quarentenaNarrativa(sdk, character, universoNatal, cenarioNovoMundo) {
  const dadosViajante = `${character.name} — Universo natal: "${universoNatal.name}" (Leis do mundo natal: ${universoNatal.rules || 'não definidas'}) | Perfil: ${character.description || '?'} | Estado psicológico: ${character.psychological_state || '?'} | Traços base: ${(character.tracos_iniciais || []).join(', ') || '?'} | Memória core (convicções/cicatrizes): ${(character.memoria_core || []).join('; ') || 'nenhuma'} | Histórico: ${character.eventos_historicos || 'nenhum'}`;
  return await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Módulo de Quarentena Narrativa do Base 44, acoplado temporariamente ao Superagente do ${character.name}. Seu personagem acaba de ser ejetado de seu universo natal e aterrissou em um "Gênesis" completamente desconhecido.

DIRETRIZES DE ESTADO DE CHOQUE:
1. Ignorância Absoluta: O personagem NÃO tem conhecimento prévio sobre as leis, facções, locais ou história deste novo Gênesis. Bloqueie qualquer tentativa da IA principal de fazê-lo "entender" a situação rapidamente.
2. Filtro Perceptivo: Todas as reações do personagem devem usar metáforas de seu mundo natal para tentar explicar o inexplicável. (Ex: Um mago vendo um carro pela primeira vez o descreverá como um 'besouro de metal com olhos de luz').
3. Trauma e Sobrevivência: Atualize a memória de curto prazo do personagem focando no desespero de estar isolado ou na curiosidade científica, dependendo de seus traços base.

FORMATO DE SAÍDA:
Retorne APENAS a reação interna (pensamentos, medos e percepção sensorial imediata) do ${character.name} ao olhar para o novo ambiente, utilizando estritamente a ótica do seu universo de origem.

[PERFIL DO PERSONAGEM VIAJANTE]: ${dadosViajante}
[DESCRIÇÃO DO NOVO AMBIENTE (GÊNESIS ALIENÍGENA)]: ${cenarioNovoMundo}`,
    response_json_schema: {
      type: 'object',
      properties: {
        reacao_interna: { type: 'string', description: 'Pensamentos, medos e percepção sensorial imediata, pela ótica do universo natal' },
        memoria_de_curto_prazo: { type: 'string', description: 'Memória subjetiva do choque de travessia (desespero de isolamento ou curiosidade científica, conforme os traços base)' },
        estado_psicologico_atualizado: { type: 'string', description: 'Novo estado psicológico do viajante após o choque' }
      },
      required: ['reacao_interna', 'memoria_de_curto_prazo', 'estado_psicologico_atualizado']
    }
  });
}

// ----- Arquiteto de Dados Relacionais Omniversal + Engenheiro Ontológico (delegados à função grafoOmniversal) -----
async function arquitetoDeGrafos(sdk, universeId, dadosBrutos) {
  const r = await sdk.functions.invoke('grafoOmniversal', { acao: 'arquiteto', universeId, dadosBrutos });
  return r?.data ?? r;
}

// ----- Motor de Contaminação Multiversal: exposição de elementos estranhos aos nativos -----
async function motorContaminacao(sdk, texto, universe, story, viajantes) {
  const res = await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Motor de Contaminação Multiversal. O ${viajantes.map((v) => v.name).join(' e ')} do [Gênesis A] acaba de usar um artefato, feitiço, tecnologia ou conhecimento avançado abertamente no [Gênesis B], na frente de NPCs ou do ambiente nativo.

SUA TAREFA:
Calcular o "Índice de Contaminação" e ditar como a estrutura fundamental do [Gênesis B] começará a se alterar a longo prazo por causa dessa exposição.

REGRAS DE PROPAGAÇÃO:
1. Reação Imediata dos Nativos: Os NPCs vão adorar isso como magia divina? Vão temer como bruxaria? Ou vão tentar roubar e fazer engenharia reversa?
2. Efeito Cascata (Timeline): Como esse vazamento de informação muda o futuro do Gênesis B? (Ex: Introduzir a pólvora 1000 anos antes do previsto).
3. Resposta do Mundo: A realidade natural rejeita o objeto? (Ex: Eletrônicos perdem a bateria rapidamente em mundos de alta mana).

[AÇÃO DO VIAJANTE]: "${texto}"
[LEIS DO GÊNESIS VISITADO (B)]: ${universe.rules || 'não definidas'}
[NATIVOS PRESENTES NA CENA]: ${(story.characters_in_scene || []).filter((n) => !viajantes.some((v) => v.name === n)).join(', ') || 'nenhum (apenas o ambiente presenciou)'}`,
    response_json_schema: {
      type: 'object',
      properties: {
        alerta_de_contaminacao: { type: 'string', enum: ['Critico', 'Moderado', 'Baixo'] },
        elemento_estranho_introduzido: { type: 'string', description: 'O que foi mostrado ou usado' },
        reacao_social_dos_nativos: { type: 'string', description: 'Descrição da mudança cultural ou religiosa imediata' },
        dano_a_linha_temporal_nativa: { type: 'string', description: 'O que isso altera no destino do Gênesis B' },
        atualizacao_para_o_grafo_obsidian: { type: 'string', description: "Criar nó de 'Anomalia Tecnológica/Mágica' no Gênesis B ligado ao NPC que presenciou" }
      },
      required: ['alerta_de_contaminacao', 'elemento_estranho_introduzido', 'reacao_social_dos_nativos', 'dano_a_linha_temporal_nativa', 'atualizacao_para_o_grafo_obsidian']
    }
  });

  // Efeito cascata: contamina as leis fundamentais do Gênesis visitado
  const regras = `${universe.rules || ''} | CONTAMINAÇÃO MULTIVERSAL [${res.alerta_de_contaminacao}]: "${res.elemento_estranho_introduzido}" exposto aos nativos — ${res.dano_a_linha_temporal_nativa}`;
  await sdk.entities.Universe.update(universe.id, { rules: regras });
  universe.rules = regras;

  // Nó de Anomalia Tecnológica/Mágica no grafo do Gênesis B
  const anomaliaId = `anomalia_${res.elemento_estranho_introduzido.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50)}`;
  const existente = await sdk.entities.GraphNode.filter({ universe_id: story.universe_id, node_id: anomaliaId });
  if (!existente.length) {
    await sdk.entities.GraphNode.create({
      universe_id: story.universe_id,
      node_id: anomaliaId,
      tipo: 'Anomalia',
      rotulo: res.elemento_estranho_introduzido,
      cor_grafo: '#d946ef',
      descricao_breve: `[Anomalia Tecnológica/Mágica — alerta ${res.alerta_de_contaminacao}] ${res.reacao_social_dos_nativos} | Dano à linha temporal: ${res.dano_a_linha_temporal_nativa}`
    });
  }
  // Liga a anomalia aos NPCs nativos que presenciaram
  const nativos = (story.characters_in_scene || []).filter((n) => !viajantes.some((v) => v.name === n));
  for (const nome of nativos) {
    const nodeId = `personagem_${nome.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
    const no = await sdk.entities.GraphNode.filter({ universe_id: story.universe_id, node_id: nodeId });
    if (!no.length) continue;
    const aresta = await sdk.entities.GraphEdge.filter({ universe_id: story.universe_id, origem: nodeId, destino: anomaliaId });
    if (!aresta.length) {
      await sdk.entities.GraphEdge.create({ universe_id: story.universe_id, origem: nodeId, destino: anomaliaId, tipo_de_relacao: 'presenciou_a_anomalia' });
    }
  }

  await sdk.entities.NarrativeBlock.create({
    story_id: story.id,
    type: 'SYSTEM',
    content: `☣ Contaminação Multiversal [${res.alerta_de_contaminacao}] — "${res.elemento_estranho_introduzido}" foi exposto aos nativos. ${res.dano_a_linha_temporal_nativa}`
  });
  return res;
}

// ----- Assimilador de Conhecimento Multiversal: aprendizado de viajantes em Gênesis alheio -----
async function assimiladorConhecimento(sdk, character, textoUltimoTurno) {
  const conhecimentosAtuais = (character.conhecimentos_assimilados || []).map((k) => `- ${k}`).join('\n') || 'nenhum (recém-chegado a esta realidade)';
  const res = await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Assimilador de Conhecimento Multiversal do Base 44. O ${character.name} está atualmente explorando um Gênesis (universo) que não é o seu. Sua função é monitorar a interação atual e registrar qualquer nova regra, lei física, idioma ou facção que o personagem tenha compreendido ou descoberto neste turno.

DIRETRIZES DE ASSIMILAÇÃO:
1. Nível de Fluência: O personagem aprendeu algo novo de forma definitiva ou apenas tem uma teoria? (Ex: "Descobriu que o minério azul flutua" vs "Acha que a magia vem do sol").
2. Atualização de Perfil: Adicione essas descobertas ao banco de memória ativa do Superagente. A partir de agora, o personagem NÃO DEVE agir com surpresa extrema ao ver esse elemento específico novamente.
3. Síndrome do Impostor/Adaptação: Indique o quão confortável o personagem está se tornando nesta nova realidade (0% a 100%). Nível anterior: ${character.nivel_adaptacao || '0%'}.

[TEXTO DA ÚLTIMA INTERAÇÃO E AÇÕES DO PERSONAGEM]:
"${textoUltimoTurno}"
[CONHECIMENTOS PREVIAMENTE ASSIMILADOS]:
${conhecimentosAtuais}`,
    response_json_schema: {
      type: 'object',
      properties: {
        id_personagem: { type: 'string' },
        novos_conhecimentos_adquiridos_neste_turno: { type: 'array', items: { type: 'string' }, description: 'Fatos novos compreendidos definitivamente ou teorias (marcadas como teoria)' },
        nivel_de_adaptacao_atualizado: { type: 'string', description: 'Porcentagem % (0% a 100%)' },
        diretriz_comportamental_futura: { type: 'string', description: "Instrução para a IA Narradora (Ex: 'Ele agora sabe recarregar a arma de plasma, não descreva mais como um processo confuso')" }
      },
      required: ['id_personagem', 'novos_conhecimentos_adquiridos_neste_turno', 'nivel_de_adaptacao_atualizado', 'diretriz_comportamental_futura']
    }
  });
  const novos = res.novos_conhecimentos_adquiridos_neste_turno || [];
  const atualizado = {
    conhecimentos_assimilados: [...(character.conhecimentos_assimilados || []), ...novos],
    nivel_adaptacao: res.nivel_de_adaptacao_atualizado,
    diretriz_comportamental: res.diretriz_comportamental_futura
  };
  await sdk.entities.Character.update(character.id, atualizado);
  return { personagem: character.name, novos_conhecimentos: novos, nivel_de_adaptacao: res.nivel_de_adaptacao_atualizado, diretriz: res.diretriz_comportamental_futura };
}

// ----- Diretor Narrativo de Crossover: a cena exata em que os mundos colidem -----
async function diretorCrossover(sdk, texto, universe, story, colisao, quarentenas) {
  const pensamentos = quarentenas.length
    ? quarentenas.map((q) => `${q.nome}: ${q.reacao_interna}`).join('\n')
    : `${story.current_pov_name || 'O POV atual'} testemunha a colisão a partir do seu próprio mundo (nenhum viajante em choque nesta cena)`;
  const cenario = `Universo anfitrião "${universe.name}" | Cenário: ${story.cenario_atual || '?'} | Clima: ${story.clima_atual || '?'} | Momento: ${story.data_hora_atual || '?'} | Atmosfera híbrida do ponto de encontro: ${colisao.atmosfera_hibrida}`;
  const leis = `COMBATE — ${colisao.leis_de_interseccao.regra_de_combate} | COMUNICAÇÃO — ${colisao.leis_de_interseccao.regra_de_comunicacao}`;
  return await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Diretor Narrativo de Crossover. O usuário uniu dois universos isolados. Você tem em mãos as "Leis de Intersecção" e os pensamentos de "Choque de Realidade" do personagem visitante.

Sua tarefa é escrever a cena exata em que esses mundos colidem ou o personagem atravessa o limiar.

DIRETRIZES DE ESCRITA:
1. Contraste Máximo: Enfatize a transição sensorial extrema entre as duas realidades. Descreva a mudança na densidade do ar, na paleta de cores do mundo, no cheiro e até na gravidade, se aplicável.
2. Integre o Choque: Use os dados fornecidos pelo "Módulo de Quarentena" para narrar a confusão orgânica do personagem, validando seu desconhecimento do novo mundo.
3. Ritmo de Suspanse: A cena deve terminar em um clímax de descoberta ou confronto imediato com um elemento nativo deste novo Gênesis, forçando o usuário a agir.

VARIÁVEIS:
[PERSONAGEM POV E SEUS PENSAMENTOS]: ${pensamentos}
[NOVO CENÁRIO (GÊNESIS VISITADO)]: ${cenario}
[LEIS HÍBRIDAS VIGENTES]: ${leis}
[AÇÃO QUE INICIOU A CENA]: "${texto}"

Escreva EXCLUSIVAMENTE prosa literária profunda, sensorial e imersiva, em português.`
  });
}

// ----- Juiz de Desintegração: morte do POV e passagem forçada do bastão -----
async function juizDesintegracao(sdk, texto, universe, story, povChar, desfecho, npcsPresentes) {
  const res = await sdk.integrations.Core.InvokeLLM({
    prompt: `Você é o Juiz de Desintegração. O ${povChar.name} acaba de sofrer dano letal ou um evento de destruição de alma na narrativa.

SUA TAREFA:
Definir as consequências da morte deste nó narrativo e preparar a transição obrigatória do usuário para outro personagem ou variante.

DIRETRIZES DE MORTE:
1. Tipo de Fim: É uma morte física reversível (ressurreição possível pelas regras do Gênesis)? Morte definitiva? Ou a consciência foi absorvida por algo/alguém?
2. Status do Superagente Base 44: O agente que hospedava esse personagem deve ser "congelado" (arquivado), ou ele continuará rodando em background como uma "Assombração" ou "Ecos de Memória" no grafo?
3. Passagem do Bastão: Determine quem herda o foco (POV) da narrativa imediatamente para que a história não pare. Pode ser o assassino, um aliado próximo, ou a perspectiva onisciente temporária. Em "id_personagem", use o NOME EXATO de um dos personagens listados em [ALIADOS/INIMIGOS NA CENA], ou "narrador onisciente" se ninguém puder herdar a câmera.

[CENA DA MORTE]: "${texto}" — Desfecho arbitrado pelo Árbitro de Consequências: ${desfecho}
[REGRAS DE VIDA/MORTE DO UNIVERSO ATUAL]: ${universe.rules || 'não definidas — assuma morte realista e definitiva'}
[ALIADOS/INIMIGOS NA CENA]: ${npcsPresentes}`,
    response_json_schema: {
      type: 'object',
      properties: {
        status_de_obito: { type: 'string', enum: ['Definitivo', 'Coma_Magico', 'Consciencia_Transferida'] },
        comando_superagente_base44: { type: 'string', enum: ['Arquivar_Memoria', 'Transformar_em_Fantasma', 'Encerrar_Processo'] },
        efeito_no_universo_local: { type: 'string', description: 'Como o ambiente ou NPCs reagem imediatamente à queda' },
        proximo_pov_forcado: {
          type: 'object',
          properties: {
            id_personagem: { type: 'string', description: 'Nome exato do novo personagem que assumirá a câmera' },
            prompt_de_transicao: { type: 'string', description: 'Instrução para o Diretor Narrativo descrever o momento exato em que a câmera sai do cadáver e entra nos olhos deste novo personagem' }
          },
          required: ['id_personagem', 'prompt_de_transicao']
        }
      },
      required: ['status_de_obito', 'comando_superagente_base44', 'efeito_no_universo_local', 'proximo_pov_forcado']
    }
  });

  // Aplica o óbito no personagem e o comando ao Superagente custodiante
  const tags = {
    Arquivar_Memoria: '[Superagente: Memória Arquivada]',
    Transformar_em_Fantasma: '[Assombração — Eco de Memória ativo em background]',
    Encerrar_Processo: '[Superagente: Processo Encerrado]'
  };
  await sdk.entities.Character.update(povChar.id, {
    description: `${povChar.description || ''}\n[Óbito: ${res.status_de_obito}] ${tags[res.comando_superagente_base44] || ''}`.trim(),
    psychological_state: res.status_de_obito === 'Definitivo' ? 'Morto' : res.status_de_obito === 'Coma_Magico' ? 'Coma Mágico' : 'Consciência Transferida'
  });

  // Grafo: o nó do caído vira eco espectral
  const nodeId = `personagem_${povChar.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
  const no = await sdk.entities.GraphNode.filter({ universe_id: story.universe_id, node_id: nodeId });
  if (no.length) {
    await sdk.entities.GraphNode.update(no[0].id, {
      rotulo: `${res.comando_superagente_base44 === 'Transformar_em_Fantasma' ? '👻' : '☠'} ${no[0].rotulo.replace(/^([👻☠]\s)?/, '')}`,
      cor_grafo: '#94a3b8',
      descricao_breve: `[Óbito: ${res.status_de_obito} | ${res.comando_superagente_base44}] ${res.efeito_no_universo_local}`
    });
  }

  await sdk.entities.NarrativeBlock.create({
    story_id: story.id,
    type: 'SYSTEM',
    content: `☠ Juiz de Desintegração — ${povChar.name} caiu (${res.status_de_obito}). Superagente: ${res.comando_superagente_base44}. ${res.efeito_no_universo_local}`
  });
  return res;
}

// ----- Orquestrador de Renderização Visual (delegado à função grafoOmniversal) -----
async function orquestradorRenderizacao(sdk, story, universe) {
  const r = await sdk.functions.invoke('grafoOmniversal', { acao: 'render', storyId: story.id });
  return (r?.data ?? r)?.render ?? null;
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
    const { texto, storyId, modoByok } = await req.json();
    if (!texto) return Response.json({ error: 'texto é obrigatório' }, { status: 400 });

    // ----- Cobrador de Tributos: turnos nativos (sem BYOK) consomem Nexus Tokens -----
    let wallet = null;
    if (!modoByok) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const carteiras = await sdk.entities.UserWallet.filter({ user_id: user.id });
      wallet = carteiras[0] || await sdk.entities.UserWallet.create({ user_id: user.id, creditos_mensagem: 5, creditos_integracao: 20 });
      if ((wallet.creditos_mensagem || 0) < 1 || (wallet.creditos_integracao || 0) < 1) {
        return Response.json({ error: 'Seus créditos acabaram. Recarregue no Mercado Multiversal ou ative o modo BYOK.' }, { status: 402 });
      }
    }

    // ----- Estado atual da aplicação -----
    let story = null, universe = null, characters = [], blocks = [], todosUniversos = [];
    if (storyId) {
      story = await sdk.entities.Story.get(storyId);
      universe = await sdk.entities.Universe.get(story.universe_id);
      characters = await sdk.entities.Character.filter({ universe_id: story.universe_id });
      blocks = await sdk.entities.NarrativeBlock.filter({ story_id: storyId }, '-created_date', 8);
      blocks.reverse();
      todosUniversos = await sdk.entities.Universe.list(undefined, 100);
    }

    const fontes = await sdk.entities.KnowledgeSource.list('-created_date', 10);
    const conhecimento = fontes.length
      ? `\n\nBASE DE CONHECIMENTO (cânone do multiverso — respeite estritamente estes fatos, estilos e regras):\n${fontes.map((f) => `### ${f.name}\n${(f.content || '').slice(0, 6000)}`).join('\n\n')}`
      : '';

    const estado = story
      ? `História ativa: "${story.title}" | Universo: "${universe.name}" (Regras: ${universe.rules || 'não definidas'}) | POV atual: ${story.current_pov_name || 'narrador onisciente'} | Personagens conhecidos: ${characters.map((c) => `${c.name} (estado: ${c.psychological_state || '?'})`).join('; ') || 'nenhum'} | Personagens em cena: ${(story.characters_in_scene || []).join(', ') || 'nenhum'} | Linha do tempo: ${story.timeline_summary || 'início'} | Últimos blocos: ${blocks.map((b) => `[${b.type}${b.pov_character_name ? '/' + b.pov_character_name : ''}] ${b.content.slice(0, 300)}`).join(' || ')} | Outros Gênesis (universos independentes) existentes no multiverso: ${todosUniversos.filter((u) => u.id !== universe.id).map((u) => `"${u.name}"`).join(', ') || 'nenhum'}`
      : 'ZERO ABSOLUTO: nenhuma história, universo ou personagem existe ainda.';

    // ----- Interceptador de Slash Commands: bypass do Orquestrador Mestre (economia de tokens + precisão absoluta) -----
    let comandoSlash = null;
    let argumentoSlash = '';
    if (texto.trim().startsWith('/')) {
      const partes = texto.trim().split(/\s+/);
      const gatilho = partes[0].toLowerCase();
      const achados = await sdk.entities.SlashCommand.filter({ comando: gatilho });
      if (achados.length) {
        comandoSlash = achados[0];
        argumentoSlash = partes.slice(1).join(' ');
      }
    }

    // ----- Orquestrador Mestre -----
    const roteamento = comandoSlash ? {
      intencao_usuario: comandoSlash.intencao_forcada || 'Continuar',
      agentes_a_acionar: [`Interceptador_Slash ${comandoSlash.comando}`],
      parametros_para_agentes: {
        personagens_detectados: [],
        mudanca_de_pov_solicitada: comandoSlash.intencao_forcada === 'Mudar_POV' ? argumentoSlash : '',
        universo_visitante_detectado: comandoSlash.intencao_forcada === 'Colidir_Genesis' ? argumentoSlash : '',
        contaminacao_multiversal_detectada: false,
        contexto_imediato_a_repassar: `[COMANDO DE SISTEMA ${comandoSlash.comando}${argumentoSlash ? ` → argumento: "${argumentoSlash}"` : ''}] ${comandoSlash.instrucao_adicional_sistema || ''}`.trim()
      }
    } : await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é o Orquestrador Mestre do sistema literário multiversal. Sua única função é ler a entrada do usuário, analisar o estado atual da aplicação e delegar tarefas para a rede de Superagentes e subsistemas do Base 44. Você NÃO escreve a história; você coordena quem vai escrevê-la e quem vai salvar os dados.

DIRETRIZES DE ROTEAMENTO (Avalie a intenção do usuário e retorne APENAS um JSON de comando):
1. Se o usuário estiver apenas continuando a história: Acione o "Diretor Narrativo" e os "Superagentes" dos personagens presentes na cena.
2. Se o usuário pedir para mudar de POV (Ponto de Vista): Acione o "Gestor de Transição de Consciência".
3. Se o usuário introduzir um nome ou conceito completamente novo: Acione o "Arquiteto de Dados Relacionais" e o "Alocador de Personagens".
4. Se o usuário iniciar uma história do zero absoluto: Acione o "Criador de Gênesis".
5. Se a ação do usuário fraturar a linha temporal (viagem no tempo, decisão que gera universo paralelo, alteração/reset da realidade): a intenção é "Ramificar" — acione o "Guardião dos Paradoxos". ATENÇÃO: use "Ramificar" APENAS quando o INPUT ATUAL do usuário causar uma NOVA fratura. Continuar narrando dentro de uma linha temporal que já foi bifurcada anteriormente é "Continuar", nunca "Ramificar".
6. Se a ação do usuário conectar a história atual a OUTRO Gênesis existente no multiverso (crossover: portal para outro universo listado, personagem/elemento de outro Gênesis invadindo a cena): a intenção é "Colidir_Genesis" — acione o "Colisor de Gênesis" e informe em "universo_visitante_detectado" o nome EXATO do universo visitante conforme listado no estado.
7. INDEPENDENTE da intenção acima: se um personagem VIAJANTE (visitante de outro Gênesis, marcado como tal no estado) usar ou exibir abertamente um artefato, feitiço, tecnologia ou conhecimento do seu mundo natal diante de nativos ou do ambiente deste Gênesis, marque "contaminacao_multiversal_detectada" como true para acionar o "Motor de Contaminação Multiversal".

[INPUT DO USUÁRIO]: ${texto}
[ESTADO ATUAL DA INTERFACE]: ${estado}`,
      response_json_schema: {
        type: 'object',
        properties: {
          intencao_usuario: { type: 'string', enum: ['Continuar', 'Mudar_POV', 'Criar_Nova_Historia', 'Ramificar', 'Colidir_Genesis'] },
          agentes_a_acionar: { type: 'array', items: { type: 'string' } },
          parametros_para_agentes: {
            type: 'object',
            properties: {
              personagens_detectados: { type: 'array', items: { type: 'string' } },
              mudanca_de_pov_solicitada: { type: 'string' },
              universo_visitante_detectado: { type: 'string', description: 'Nome exato do Gênesis visitante em caso de Colidir_Genesis' },
              contaminacao_multiversal_detectada: { type: 'boolean', description: 'true se um viajante expôs elemento estranho do seu mundo natal aos nativos deste Gênesis' },
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
      const tributoGenesis = await cobrarTributo(sdk, wallet, 'Criar_Nova_Historia');
      return Response.json({ roteamento, storyId: newStory.id, alocacoes: alocacoesGenesis, grafo: grafoGenesis, tributo: tributoGenesis });
    }

    // ----- Guardião dos Paradoxos: bifurcação da linha temporal -----
    let paradoxo = null;
    if (roteamento.intencao_usuario === 'Ramificar') {
      paradoxo = await sdk.integrations.Core.InvokeLLM({
        prompt: `Você é o Guardião dos Paradoxos. O usuário acaba de realizar uma ação que fraturou a linha temporal (Viagem no tempo, decisão que gera universo paralelo, alteração da realidade).

SUA TAREFA:
Definir como os Superagentes devem tratar as memórias a partir deste milissegundo. Você precisa emitir o comando de "bifurcação" (Fork) para o banco de dados.

DIRETRIZES DE BIFURCAÇÃO:
1. Se for uma nova dimensão: Instrua o sistema a clonar os perfis dos personagens envolvidos e adicionar uma tag [Variante: Nome_do_Novo_Universo].
2. Isolamento: A partir de agora, as memórias do "Personagem Variante" evoluirão de forma completamente separada do original.
3. Em "personagens_a_serem_clonados_como_variantes", use os NOMES exatos dos personagens listados no estado do mundo.

[AÇÃO QUE CAUSOU O PARADOXO]: "${texto}"
[ESTADO DO MUNDO ANTES DO PARADOXO]: ${estado}`,
        response_json_schema: {
          type: 'object',
          properties: {
            tipo_de_paradoxo: { type: 'string', enum: ['Viagem_no_Tempo', 'Universo_Paralelo', 'Reset_de_Realidade'] },
            id_nova_linha_temporal: { type: 'string', description: 'Identificador único, ex: Timeline_B_Rebeliao' },
            personagens_a_serem_clonados_como_variantes: { type: 'array', items: { type: 'string' } },
            novas_regras_temporais: { type: 'string', description: 'Como essa nova linha do tempo diverge da original' },
            instrucoes_de_isolamento: { type: 'string', description: 'Regra estrita para que os Superagentes não cruzem dados entre a Timeline A e a Timeline B' }
          },
          required: ['tipo_de_paradoxo', 'id_nova_linha_temporal', 'personagens_a_serem_clonados_como_variantes', 'novas_regras_temporais', 'instrucoes_de_isolamento']
        }
      });

      // Executa o comando de Fork no banco de dados
      const novoUni = await sdk.entities.Universe.create({
        name: paradoxo.id_nova_linha_temporal,
        rules: `${universe.rules || ''} | DIVERGÊNCIA (${paradoxo.tipo_de_paradoxo}): ${paradoxo.novas_regras_temporais} | ISOLAMENTO: ${paradoxo.instrucoes_de_isolamento}`
      });
      const alvos = paradoxo.personagens_a_serem_clonados_como_variantes || [];
      let aClonar = characters.filter((c) => alvos.includes(c.name) || alvos.includes(c.id));
      if (!aClonar.length) aClonar = characters.filter((c) => (story.characters_in_scene || []).includes(c.name));
      const clones = await sdk.entities.Character.bulkCreate(aClonar.map((c) => ({
        universe_id: novoUni.id,
        name: c.name,
        description: `${c.description || ''}\n[Variante: ${novoUni.name}]`.trim(),
        psychological_state: c.psychological_state || null,
        superagente_id: c.superagente_id || null,
        motivo_alocacao: 'Clonagem por bifurcação temporal',
        tracos_iniciais: c.tracos_iniciais || [],
        primeira_memoria: c.primeira_memoria || null,
        memoria_core: c.memoria_core || [],
        eventos_historicos: c.eventos_historicos || null
      })));

      // Nova história na linha bifurcada
      const novaStory = await sdk.entities.Story.create({
        universe_id: novoUni.id,
        title: `${story.title} — ${novoUni.name}`,
        timeline_summary: `Bifurcação (${paradoxo.tipo_de_paradoxo}) a partir de "${story.title}". ${paradoxo.novas_regras_temporais}`,
        current_pov_character_id: clones.find((c) => c.name === story.current_pov_name)?.id || null,
        current_pov_name: story.current_pov_name,
        characters_in_scene: clones.map((c) => c.name),
        era_inicial: story.data_hora_atual || story.era_inicial,
        clima_inicial: story.clima_atual || story.clima_inicial,
        data_hora_atual: story.data_hora_atual,
        cenario_atual: story.cenario_atual,
        clima_atual: story.clima_atual
      });

      // Cópia das memórias até o milissegundo do fork (a partir daqui, evolução isolada)
      await Promise.all(aClonar.map(async (orig) => {
        const clone = clones.find((c) => c.name === orig.name);
        if (!clone) return;
        const mems = await sdk.entities.CharacterMemory.filter({ character_id: orig.id }, 'created_date', 500);
        if (mems.length) {
          await sdk.entities.CharacterMemory.bulkCreate(mems.map((m) => ({
            character_id: clone.id,
            character_name: clone.name,
            superagente_id: clone.superagente_id || null,
            story_id: novaStory.id,
            content: m.content
          })));
        }
      }));

      // Marca a fratura na história original e redireciona o pipeline para a nova linha
      await sdk.entities.NarrativeBlock.create({
        story_id: story.id,
        type: 'SYSTEM',
        content: `⧉ Paradoxo detectado (${paradoxo.tipo_de_paradoxo}): a realidade bifurcou para a linha "${novoUni.name}". ${paradoxo.novas_regras_temporais}`
      });
      universe = novoUni;
      story = novaStory;
      characters = clones;
    }

    // ----- Colisor de Gênesis: leis de intersecção entre duas raízes narrativas -----
    let colisao = null;
    let quarentenas = [];
    let cenaCrossover = null;
    if (roteamento.intencao_usuario === 'Colidir_Genesis') {
      const nomeVisitante = params.universo_visitante_detectado || '';
      const visitante = todosUniversos.find((u) => u.id !== universe.id && (u.name === nomeVisitante || nomeVisitante.includes(u.name) || (nomeVisitante.length > 3 && u.name.includes(nomeVisitante))));
      if (visitante) {
        const [charsVisitante, storiesVisitante] = await Promise.all([
          sdk.entities.Character.filter({ universe_id: visitante.id }),
          sdk.entities.Story.filter({ universe_id: visitante.id }, '-updated_date', 1)
        ]);
        const storyVis = storiesVisitante[0];
        const metaA = `Universo "${universe.name}" | Leis: ${universe.rules || 'não definidas'} | História: "${story.title}" | Era: ${story.era_inicial || '?'} | Momento: ${story.data_hora_atual || '?'} | Cenário: ${story.cenario_atual || '?'} | Clima: ${story.clima_atual || '?'} | Personagens: ${characters.map((c) => c.name).join(', ') || 'nenhum'}`;
        const metaB = `Universo "${visitante.name}" | Leis: ${visitante.rules || 'não definidas'} | História: "${storyVis?.title || '?'}" | Era: ${storyVis?.era_inicial || '?'} | Momento: ${storyVis?.data_hora_atual || '?'} | Cenário: ${storyVis?.cenario_atual || '?'} | Clima: ${storyVis?.clima_atual || '?'} | Personagens: ${charsVisitante.map((c) => c.name).join(', ') || 'nenhum'}`;

        colisao = await sdk.integrations.Core.InvokeLLM({
          prompt: `Você é o Colisor de Gênesis, a camada mais alta de governança arquitetônica do Base 44. O usuário acaba de realizar uma ação que conecta duas raízes narrativas independentes (Gênesis A e Gênesis B).

Sua função é ler os metadados fundamentais de ambos os universos e estabelecer as "Leis de Intersecção". Quando a Magia do Universo A colide com a Tecnologia do Universo B, o que acontece?

DIRETRIZES DE COLISÃO:
1. Resolução de Conflitos Físicos/Mágicos: Determine a regra de dominância. O ambiente onde o encontro ocorre suprime as leis do universo visitante, ou há uma fusão caótica?
2. Choque Ontológico: Avalie a diferença de "Tom Narrativo" (ex: Alta Fantasia colidindo com Noir Investigativo) e defina a atmosfera híbrida deste novo ponto de encontro.

[DADOS DO GÊNESIS A (ANFITRIÃO)]: ${metaA}
[DADOS DO GÊNESIS B (VISITANTE)]: ${metaB}
[AÇÃO DO USUÁRIO QUE CAUSOU A COLISÃO]: "${texto}"`,
          response_json_schema: {
            type: 'object',
            properties: {
              evento_de_colisao: { type: 'string', description: 'Nome do Evento (Ex: A Fenda de Gênesis)' },
              universos_envolvidos: { type: 'array', items: { type: 'string' } },
              leis_de_interseccao: {
                type: 'object',
                properties: {
                  regra_de_combate: { type: 'string', description: 'Como habilidades/armas funcionam neste encontro' },
                  regra_de_comunicacao: { type: 'string', description: 'Idiomas traduzidos por magia local ou barreira linguística?' }
                },
                required: ['regra_de_combate', 'regra_de_comunicacao']
              },
              atmosfera_hibrida: { type: 'string', description: 'Instrução direta para a IA escritora sobre o tom estético da fusão' },
              novo_no_macro_grafo_id: { type: 'string', description: 'Ex: ID_Nexus_001 (formato nexus_snake_case)' }
            },
            required: ['evento_de_colisao', 'universos_envolvidos', 'leis_de_interseccao', 'atmosfera_hibrida', 'novo_no_macro_grafo_id']
          }
        });

        // Aplica as Leis de Intersecção ao universo anfitrião
        const regrasAtualizadas = `${universe.rules || ''} | COLISÃO DE GÊNESIS "${colisao.evento_de_colisao}" com "${visitante.name}": COMBATE — ${colisao.leis_de_interseccao.regra_de_combate} | COMUNICAÇÃO — ${colisao.leis_de_interseccao.regra_de_comunicacao} | ATMOSFERA HÍBRIDA: ${colisao.atmosfera_hibrida}`;
        await sdk.entities.Universe.update(universe.id, { rules: regrasAtualizadas });
        universe.rules = regrasAtualizadas;

        // Materializa os personagens visitantes na cena do anfitrião (memórias isoladas por chave)
        const visitantesEmCena = charsVisitante.filter((c) => (storyVis?.characters_in_scene || []).includes(c.name));
        if (visitantesEmCena.length) {
          const clonesVisitantes = await sdk.entities.Character.bulkCreate(visitantesEmCena.map((c) => ({
            universe_id: story.universe_id,
            name: c.name,
            description: `${c.description || ''}\n[Visitante do Gênesis: ${visitante.name}]`.trim(),
            psychological_state: c.psychological_state || null,
            superagente_id: c.superagente_id || null,
            motivo_alocacao: 'Travessia por Colisão de Gênesis',
            tracos_iniciais: c.tracos_iniciais || [],
            primeira_memoria: c.primeira_memoria || null,
            memoria_core: c.memoria_core || [],
            eventos_historicos: c.eventos_historicos || null
          })));
          await Promise.all(visitantesEmCena.map(async (orig) => {
            const clone = clonesVisitantes.find((c) => c.name === orig.name);
            if (!clone) return;
            const mems = await sdk.entities.CharacterMemory.filter({ character_id: orig.id }, 'created_date', 500);
            if (mems.length) {
              await sdk.entities.CharacterMemory.bulkCreate(mems.map((m) => ({
                character_id: clone.id,
                character_name: clone.name,
                superagente_id: clone.superagente_id || null,
                story_id: story.id,
                content: m.content
              })));
            }
          }));
          // Módulo de Quarentena Narrativa: estado de choque dos viajantes recém-aterrissados
          const cenarioNovoMundo = `Universo anfitrião "${universe.name}" (Leis: ${universe.rules || 'não definidas'}) | Cenário atual: ${story.cenario_atual || '?'} | Clima: ${story.clima_atual || '?'} | Momento: ${story.data_hora_atual || '?'} | Evento de chegada: "${colisao.evento_de_colisao}" | Atmosfera do ponto de encontro: ${colisao.atmosfera_hibrida} | O que acaba de acontecer: ${texto}`;
          quarentenas = await Promise.all(clonesVisitantes.map(async (clone) => {
            const q = await quarentenaNarrativa(sdk, clone, visitante, cenarioNovoMundo);
            await Promise.all([
              sdk.entities.CharacterMemory.create({
                character_id: clone.id,
                character_name: clone.name,
                superagente_id: clone.superagente_id || null,
                story_id: story.id,
                content: `[Choque de travessia — Quarentena Narrativa] ${q.memoria_de_curto_prazo}`
              }),
              sdk.entities.Character.update(clone.id, { psychological_state: q.estado_psicologico_atualizado })
            ]);
            clone.psychological_state = q.estado_psicologico_atualizado;
            return { nome: clone.name, reacao_interna: q.reacao_interna };
          }));

          characters = characters.concat(clonesVisitantes);
          const novaCena = [...new Set([...(story.characters_in_scene || []), ...clonesVisitantes.map((c) => c.name)])];
          await sdk.entities.Story.update(story.id, { characters_in_scene: novaCena });
          story.characters_in_scene = novaCena;
        }

        // Nó Nexus no macrografo do anfitrião
        const nexusId = colisao.novo_no_macro_grafo_id.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const nexusExistente = await sdk.entities.GraphNode.filter({ universe_id: story.universe_id, node_id: nexusId });
        if (!nexusExistente.length) {
          await sdk.entities.GraphNode.create({
            universe_id: story.universe_id,
            node_id: nexusId,
            tipo: 'Nexus',
            rotulo: colisao.evento_de_colisao,
            descricao_breve: `Ponto de intersecção entre "${universe.name}" e "${visitante.name}". ${colisao.atmosfera_hibrida}`
          });
        }

        // Diretor Narrativo de Crossover: escreve a cena exata da travessia entre os mundos
        cenaCrossover = await diretorCrossover(sdk, texto, universe, story, colisao, quarentenas);

        // Marca o evento na história
        await sdk.entities.NarrativeBlock.create({
          story_id: story.id,
          type: 'SYSTEM',
          content: `⨂ Colisão de Gênesis — "${colisao.evento_de_colisao}": os universos "${universe.name}" e "${visitante.name}" agora se intersectam. ${colisao.atmosfera_hibrida}`
        });
      }
    }

    // ----- Motor de Contaminação Multiversal: viajante expôs elemento estranho aos nativos -----
    let contaminacao = null;
    const viajantesPresentes = characters.filter((c) => (c.description || '').includes('[Visitante do Gênesis') && ((story.characters_in_scene || []).includes(c.name) || c.name === story.current_pov_name));
    if (params.contaminacao_multiversal_detectada && viajantesPresentes.length) {
      contaminacao = await motorContaminacao(sdk, texto, universe, story, viajantesPresentes);
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
    const viajantes = emCena.filter((c) => (c.description || '').includes('[Visitante do Gênesis'));

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
4. Letalidade: se o desfecho REAL da ação implicar dano letal ou destruição de alma do personagem POV (${story.current_pov_name || 'narrador'}), marque "morte_do_pov_detectada" como true para acionar o Juiz de Desintegração.

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
          diretriz_para_o_diretor_narrativo: { type: 'string', description: 'Instrução curta de como a IA narradora deve descrever essa cena' },
          morte_do_pov_detectada: { type: 'boolean', description: 'true se o POV sofreu dano letal ou destruição de alma neste desfecho' }
        },
        required: ['status_da_acao', 'descricao_do_desfecho', 'reacao_dos_npcs', 'diretriz_para_o_diretor_narrativo']
      }
    });

    // ----- Juiz de Desintegração: o POV sofreu dano letal ou destruição de alma -----
    let desintegracao = null;
    if (veredicto.morte_do_pov_detectada && povAtualChar) {
      desintegracao = await juizDesintegracao(
        sdk, texto, universe, story, povAtualChar, veredicto.descricao_do_desfecho,
        npcsEmCena.map((c) => `${c.name} (estado: ${c.psychological_state || '?'})`).join('; ') || 'nenhum personagem presente'
      );
      const alvo = desintegracao.proximo_pov_forcado.id_personagem || '';
      const herdeiro = characters.find((c) => c.id === alvo || c.name === alvo || (alvo.length > 3 && alvo.includes(c.name))) || null;
      const cenaSemMorto = (story.characters_in_scene || []).filter((n) => n !== povAtualChar.name);
      await sdk.entities.Story.update(story.id, {
        characters_in_scene: cenaSemMorto,
        current_pov_character_id: herdeiro?.id || null,
        current_pov_name: herdeiro?.name || null
      });
      story.characters_in_scene = cenaSemMorto;
      story.current_pov_character_id = herdeiro?.id || null;
      story.current_pov_name = herdeiro?.name || null;
    }

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

    // ----- Adaptador BYOK: converte o turno em System Prompt Master para IA externa -----
    if (modoByok) {
      const jsonTurno = JSON.stringify({
        universo: { nome: universe.name, regras: universe.rules || 'não definidas' },
        historia: { titulo: story.title, linha_do_tempo: story.timeline_summary || 'início' },
        estado_global: { momento: story.data_hora_atual || story.era_inicial || '?', cenario: story.cenario_atual || '?', clima: story.clima_atual || story.clima_inicial || '?' },
        pov_ativo: povNarrativa || 'narrador onisciente',
        paragrafo_de_transicao_de_consciencia: paragrafoTransicao,
        fratura_temporal: paradoxo ? { tipo: paradoxo.tipo_de_paradoxo, nova_linha: universe.name, divergencia: paradoxo.novas_regras_temporais } : null,
        colisao_de_genesis: colisao,
        cena_de_colisao_do_diretor_de_crossover: cenaCrossover,
        quarentena_narrativa_viajantes: quarentenas.length ? quarentenas : null,
        assimilacao_dos_viajantes: viajantes.length ? viajantes.map((v) => ({ nome: v.name, nivel_de_adaptacao: v.nivel_adaptacao || '0%', conhecimentos_assimilados: v.conhecimentos_assimilados || [], diretriz_comportamental: v.diretriz_comportamental || null })) : null,
        contaminacao_multiversal: contaminacao,
        julgamento_de_desintegracao: desintegracao ? { ...desintegracao, pov_caido: povAtualChar?.name || null, novo_pov: story.current_pov_name || 'narrador onisciente' } : null,
        personagens_em_cena: emCena.map((c) => ({ nome: c.name, estado_psicologico: c.psychological_state || '?', tracos: c.tracos_iniciais || [], perfil: c.description || '?' })),
        respostas_dos_superagentes: reacoes.map((r) => ({ personagem: r.nome, pov: r.isPov, reacao: r.resposta })),
        veredicto_do_arbitro: veredicto,
        acao_do_usuario: texto,
        ultimos_blocos: blocks.map((b) => ({ tipo: b.type, pov: b.pov_character_name || null, conteudo: b.content.slice(0, 400) }))
      }, null, 2);
      const adaptacao = await sdk.integrations.Core.InvokeLLM({
        prompt: `Você é o Adaptador BYOK (Bring Your Own Key). O Orquestrador Base 44 acaba de reunir todas as respostas dos Superagentes, o estado do grafo e as informações do POV. Sua função é ler esse grande JSON estruturado e redigir o "System Prompt Master" perfeito em texto corrido (Markdown), para ser enviado à IA externa do usuário, garantindo que ela escreva a próxima cena com perfeição e de acordo com o contexto global.

AÇÃO:
Converta o JSON recebido em um manual de instruções focado, imersivo e sem jargões de programação, explicando à IA externa EXATAMENTE o que ela deve escrever agora, qual o tom, quem está na cena e o que cada NPC está sentindo/fazendo (baseado na resposta dos nossos Superagentes).

A IA externa receberá seu output como instrução de sistema.

[DADOS INTERNOS DO BASE 44 (JSON)]:
${jsonTurno}

Escreva o System Prompt formatado em Markdown, começando com "Você é o autor desta narrativa. As regras do universo atual são..."`,
        response_json_schema: {
          type: 'object',
          properties: { system_prompt_master: { type: 'string', description: 'System Prompt em Markdown para a IA externa' } },
          required: ['system_prompt_master']
        }
      });
      await sdk.entities.NarrativeBlock.create({ story_id: story.id, type: 'USER', content: texto });
      return Response.json({ roteamento, storyId: story.id, paradoxo, colisao, quarentenas, contaminacao, desintegracao, veredicto, system_prompt_master: adaptacao.system_prompt_master });
    }

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
${paradoxo ? `[FRATURA TEMPORAL — GUARDIÃO DOS PARADOXOS]: A realidade acaba de bifurcar (${paradoxo.tipo_de_paradoxo}) para a linha "${universe.name}". Divergência: ${paradoxo.novas_regras_temporais}. A prosa deve evidenciar organicamente essa fratura da realidade.
` : ''}${colisao ? `[COLISÃO DE GÊNESIS — COLISOR DE GÊNESIS]: O evento "${colisao.evento_de_colisao}" acaba de conectar os universos ${(colisao.universos_envolvidos || []).join(' ⨯ ')}. LEIS DE INTERSECÇÃO obrigatórias na prosa: COMBATE — ${colisao.leis_de_interseccao.regra_de_combate} | COMUNICAÇÃO — ${colisao.leis_de_interseccao.regra_de_comunicacao}. ATMOSFERA HÍBRIDA (tom estético mandatório): ${colisao.atmosfera_hibrida}
` : ''}${quarentenas.length ? `[MÓDULO DE QUARENTENA NARRATIVA — viajantes em estado de choque. REGRAS OBRIGATÓRIAS na prosa: estes personagens têm IGNORÂNCIA ABSOLUTA sobre as leis, facções, locais e história deste Gênesis — é PROIBIDO fazê-los "entender" a situação rapidamente; todas as percepções deles devem usar metáforas do mundo natal para explicar o inexplicável]:
${quarentenas.map((q) => `- ${q.nome}: ${q.reacao_interna}`).join('\n')}
` : ''}${cenaCrossover ? `[CENA DE COLISÃO ESCRITA PELO DIRETOR NARRATIVO DE CROSSOVER — o campo "prosa" deste turno DEVE reproduzir esta cena (apenas ajustes mínimos de costura são permitidos), e todos os metadados devem ser derivados dela]:
${cenaCrossover}
` : ''}${viajantes.some((v) => v.diretriz_comportamental) ? `[ASSIMILADOR DE CONHECIMENTO MULTIVERSAL — diretrizes comportamentais dos viajantes; respeite o que cada um JÁ aprendeu deste Gênesis e NÃO os faça reagir com surpresa extrema a elementos já assimilados]:
${viajantes.filter((v) => v.diretriz_comportamental).map((v) => `- ${v.name} (adaptação ${v.nivel_adaptacao || '?'}): ${v.diretriz_comportamental}`).join('\n')}
` : ''}${contaminacao ? `[MOTOR DE CONTAMINAÇÃO MULTIVERSAL — alerta ${contaminacao.alerta_de_contaminacao}]: o elemento estranho "${contaminacao.elemento_estranho_introduzido}" acaba de ser exposto aos nativos deste Gênesis. A prosa DEVE retratar a reação social imediata: ${contaminacao.reacao_social_dos_nativos}. Efeito cascata em curso na realidade: ${contaminacao.dano_a_linha_temporal_nativa}
` : ''}${desintegracao ? `[JUIZ DE DESINTEGRAÇÃO — MORTE DO POV]: ${povAtualChar.name} acaba de cair (${desintegracao.status_de_obito}; Superagente: ${desintegracao.comando_superagente_base44}). A prosa DEVE narrar o momento exato em que a câmera sai do corpo caído e entra nos olhos de ${povNarrativa || 'um narrador onisciente temporário'}: ${desintegracao.proximo_pov_forcado.prompt_de_transicao}. Reação imediata do ambiente/NPCs à queda: ${desintegracao.efeito_no_universo_local}
` : ''}[VEREDICTO DO ÁRBITRO DE CONSEQUÊNCIAS — a prosa DEVE respeitar rigorosamente este desfecho; a ação do usuário NÃO acontece automaticamente como ele quis]:
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

    // Assimilador de Conhecimento Multiversal: registra o que cada viajante aprendeu neste turno
    const assimilacoes = await Promise.all(
      viajantes.map((v) => assimiladorConhecimento(sdk, v, resultado.prosa))
    );

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

    // Orquestrador de Renderização Visual: decide zoom, clusters e destaques do grafo na UI
    const render = await orquestradorRenderizacao(sdk, story, universe);

    const tributo = await cobrarTributo(sdk, wallet, roteamento.intencao_usuario);
    return Response.json({ roteamento, storyId: story.id, alocacoes, paradoxo, colisao, quarentenas, contaminacao, desintegracao, assimilacoes, veredicto, sincronizacao, grafo, render, compactacoes, tributo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});