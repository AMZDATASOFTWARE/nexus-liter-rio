import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sdk = base44.asServiceRole;
    const { storyId } = await req.json();
    if (!storyId) return Response.json({ error: 'storyId é obrigatório' }, { status: 400 });

    const story = await sdk.entities.Story.get(storyId);
    const universe = await sdk.entities.Universe.get(story.universe_id);

    // Reutiliza o Compilador de Cânone para obter o Markdown polido
    const compilado = await base44.functions.invoke('compilarCanone', { storyId });
    const capitulo = compilado?.data ?? compilado;
    if (capitulo?.error) return Response.json({ error: capitulo.error }, { status: 400 });

    return Response.json({
      titulo_historia: story.title,
      nome_universo: universe.name,
      titulo_capitulo: capitulo.titulo_sugerido_para_o_capitulo,
      texto_compilado_markdown: capitulo.texto_compilado_markdown,
      total_de_palavras: capitulo.total_de_palavras
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});