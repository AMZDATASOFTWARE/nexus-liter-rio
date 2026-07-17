import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sdk = base44.asServiceRole;
    const body = await req.json();
    const { storyId, manifesto, modoCompilacao, blocoInicio, blocoFim, contextoAnterior, parte, totalPartes } = body;
    if (!storyId) return Response.json({ error: 'storyId é obrigatório' }, { status: 400 });

    const story = await sdk.entities.Story.get(storyId);
    const universe = await sdk.entities.Universe.get(story.universe_id);

    // Modo manifesto: só conta os blocos úteis (sem LLM) para o frontend fatiar o livro em capítulos.
    if (manifesto) {
      const contagem = await base44.functions.invoke('compilarCanone', { storyId, manifesto: true, modoCompilacao });
      const dados = contagem?.data ?? contagem;
      if (dados?.error) return Response.json({ error: dados.error }, { status: 400 });
      return Response.json({
        titulo_historia: story.title,
        nome_universo: universe.name,
        total_de_blocos_uteis: dados.total_de_blocos_uteis
      });
    }

    // Reutiliza o Compilador de Cânone para obter o Markdown polido do lote (ou da história inteira)
    const compilado = await base44.functions.invoke('compilarCanone', {
      storyId,
      modoCompilacao,
      blocoInicio,
      blocoFim,
      contextoAnterior,
      parte,
      totalPartes
    });
    const capitulo = compilado?.data ?? compilado;
    if (capitulo?.error) return Response.json({ error: capitulo.error }, { status: 400 });

    return Response.json({
      titulo_historia: story.title,
      nome_universo: universe.name,
      titulo_capitulo: capitulo.titulo_sugerido_para_o_capitulo,
      texto_compilado_markdown: capitulo.texto_compilado_markdown,
      segmentos: capitulo.segmentos,
      resumo_para_continuidade: capitulo.resumo_para_continuidade,
      total_de_palavras: capitulo.total_de_palavras
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
