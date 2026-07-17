import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const TAMANHO_PAGINA = 500;

// Busca TODOS os blocos da história, paginando por cursor de created_date quando passa de 500.
// A 1ª página usa o filtro simples de sempre; só histórias gigantes tocam o cursor ($gte + dedupe
// por id, porque blocos do mesmo turno podem compartilhar created_date). Se a paginação extra
// falhar, devolve o que já tem em vez de derrubar a compilação.
async function buscarTodosOsBlocos(sdk, storyId) {
  const primeira = await sdk.entities.NarrativeBlock.filter({ story_id: storyId }, 'created_date', TAMANHO_PAGINA);
  if (primeira.length < TAMANHO_PAGINA) return primeira;

  const vistos = new Set(primeira.map((b) => b.id));
  const todos = [...primeira];
  let cursor = primeira[primeira.length - 1].created_date;
  try {
    while (true) {
      const pagina = await sdk.entities.NarrativeBlock.filter(
        { story_id: storyId, created_date: { $gte: cursor } },
        'created_date',
        TAMANHO_PAGINA
      );
      const novos = pagina.filter((b) => !vistos.has(b.id));
      for (const b of novos) {
        vistos.add(b.id);
        todos.push(b);
      }
      if (pagina.length < TAMANHO_PAGINA || !novos.length) break;
      cursor = pagina[pagina.length - 1].created_date;
    }
  } catch (_e) {
    // Paginação por cursor indisponível: segue com os blocos já carregados.
  }
  return todos;
}

// Diretrizes de compilação específicas de cada estilo de livro escolhido pelo autor.
function diretrizesDoModo(modo) {
  const memoria = `5. Blocos "MEMORIA" (flashbacks): são lembranças em primeira pessoa do personagem indicado no campo "contexto". Teça cada uma como uma cena de flashback com transição literária clara de entrada e de saída — nunca use rótulos técnicos como "MEMORIA" no texto final.`;
  if (modo === 'sem_bastidores') return memoria;
  if (modo === 'interludios') {
    return `${memoria}
6. Blocos "OFFSCREEN" (bastidores): são eventos que ocorreram em paralelo, fora da cena principal, no local indicado no campo "contexto". Agrupe bastidores consecutivos em seções próprias iniciadas pelo título Markdown "## Interlúdio — {local}", posicionadas entre as cenas principais, mantendo a ordem cronológica dos blocos.`;
  }
  return `${memoria}
6. Blocos "OFFSCREEN" (bastidores): são eventos que ocorreram em paralelo, fora da cena principal, no local indicado no campo "contexto". Interligue-os como cenas paralelas curtas no ponto cronológico em que aparecem (ex.: "Enquanto isso, em {local}..."), sem quebrar o fluxo do capítulo.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sdk = base44.asServiceRole;
    const body = await req.json();
    const { storyId, contextoAnterior } = body;
    const modoCompilacao = ['integrado', 'sem_bastidores', 'interludios'].includes(body.modoCompilacao)
      ? body.modoCompilacao
      : 'integrado';
    const blocoInicio = Number.isInteger(body.blocoInicio) ? body.blocoInicio : null;
    const blocoFim = Number.isInteger(body.blocoFim) ? body.blocoFim : null;
    const parte = Number.isInteger(body.parte) ? body.parte : 1;
    const totalPartes = Number.isInteger(body.totalPartes) ? body.totalPartes : 1;
    if (!storyId) return Response.json({ error: 'storyId é obrigatório' }, { status: 400 });

    const [story, blocks] = await Promise.all([
      sdk.entities.Story.get(storyId),
      buscarTodosOsBlocos(sdk, storyId)
    ]);

    // SYSTEM nunca entra no livro; OFFSCREEN sai quando o autor quer só o que o POV viveu.
    let blocosUteis = blocks.filter((b) => b.type !== 'SYSTEM');
    if (modoCompilacao === 'sem_bastidores') blocosUteis = blocosUteis.filter((b) => b.type !== 'OFFSCREEN');
    if (!blocosUteis.length) return Response.json({ error: 'Nenhum bloco narrativo para compilar' }, { status: 400 });

    // Modo manifesto: só a contagem, para o frontend fatiar o livro em capítulos (sem LLM).
    if (body.manifesto) {
      return Response.json({ total_de_blocos_uteis: blocosUteis.length, modo_compilacao: modoCompilacao });
    }

    // Faixa do lote (capítulo). Sem faixa, compila tudo de uma vez (comportamento original).
    const lote = blocoInicio !== null && blocoFim !== null ? blocosUteis.slice(blocoInicio, blocoFim) : blocosUteis;
    if (!lote.length) return Response.json({ error: 'Faixa de blocos vazia' }, { status: 400 });

    const arrayBruto = lote.map((b) => ({
      tipo: b.type,
      pov: b.pov_character_name || null,
      contexto: b.memoria_character_name || null,
      conteudo: b.content
    }));

    const posicao =
      totalPartes === 1
        ? 'Este lote contém a história completa.'
        : `Este lote corresponde à parte ${parte} de ${totalPartes} do livro${parte === 1 ? ' — é a abertura' : parte === totalPartes ? ' — é o encerramento' : ''}.`;
    const continuidade = contextoAnterior
      ? `\n[ONDE O CAPÍTULO ANTERIOR PAROU]: ${contextoAnterior}\nContinue a narrativa a partir desse ponto, sem recapitular o que já foi contado.`
      : '';

    const res = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é o Compilador de Cânone do Base 44. Sua função é receber um array bruto de "Blocos Narrativos" (Turnos do Usuário, Respostas da IA, Flashbacks de memória e Cenas de bastidores) e transformá-los em um texto literário contínuo, coeso e pronto para ser publicado como capítulo de livro.

DIRETRIZES DE COMPILAÇÃO:
1. FIDELIDADE INTEGRAL (a regra mais importante): compile TODO o conteúdo dos blocos em prosa completa. NÃO resuma, NÃO omita cenas, NÃO condense eventos — cada acontecimento presente nos blocos deve estar presente no texto final, na mesma ordem.
2. Fusão Orgânica: o texto do "USER" geralmente é uma ação curta (ex: "Saco a espada e ataco"). Funda essa intenção com a resposta da "AI" seguinte, garantindo que o texto flua em terceira pessoa (ou na primeira, se for o estilo predominante).
3. Correção de Continuidade: suavize transições bruscas entre os blocos, garantindo ritmo literário profissional.
4. Formatação: retorne o texto em Markdown, com quebras de parágrafo claras, usando negrito ou itálico apenas quando estritamente necessário para ênfase narrativa.
${diretrizesDoModo(modoCompilacao)}

[HISTÓRIA]: "${story.title}"
${posicao}${continuidade}
[BLOCOS NARRATIVOS BRUTOS DESTE LOTE]:
${JSON.stringify(arrayBruto, null, 2)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          titulo_sugerido_para_o_capitulo: { type: 'string' },
          texto_compilado_markdown: { type: 'string', description: 'O texto literário completo e polido deste lote, sem nenhum evento omitido' },
          resumo_para_continuidade: { type: 'string', description: '2-3 frases dizendo exatamente onde a narrativa parou (quem está onde, fazendo o quê), para o próximo lote continuar sem recapitular' },
          total_de_palavras: { type: 'string', description: 'Número estimado' }
        },
        required: ['titulo_sugerido_para_o_capitulo', 'texto_compilado_markdown', 'resumo_para_continuidade', 'total_de_palavras']
      }
    });

    return Response.json(res);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
