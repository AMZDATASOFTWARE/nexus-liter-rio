import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sdk = base44.asServiceRole;
    const { storyId } = await req.json();
    if (!storyId) return Response.json({ error: 'storyId é obrigatório' }, { status: 400 });

    const [story, blocks] = await Promise.all([
      sdk.entities.Story.get(storyId),
      sdk.entities.NarrativeBlock.filter({ story_id: storyId }, 'created_date', 500)
    ]);
    const blocosUteis = blocks.filter((b) => b.type !== 'SYSTEM');
    if (!blocosUteis.length) return Response.json({ error: 'Nenhum bloco narrativo para compilar' }, { status: 400 });

    const arrayBruto = blocks.map((b) => ({
      tipo: b.type,
      pov: b.pov_character_name || null,
      conteudo: b.content
    }));

    const res = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é o Compilador de Cânone do Base 44. Sua função é receber um array bruto de "Blocos Narrativos" (Turnos do Usuário, Respostas da IA e Avisos de Sistema) e transformá-los em um texto literário contínuo, coeso e pronto para ser publicado como um capítulo de livro.

DIRETRIZES DE COMPILAÇÃO:
1. Omissão de Metadados: Ignore completamente os blocos do tipo "SYSTEM" (ex: avisos de contaminação, mudanças de POV, fraturas temporais). Eles servem para a engine, não para o leitor.
2. Fusão Orgânica: O texto do "USER" geralmente é uma ação curta (ex: "Saco a espada e ataco"). Você deve fundir essa intenção com a resposta da "AI" seguinte, garantindo que o texto flua em terceira pessoa (ou na primeira pessoa, se for o estilo predominante).
3. Correção de Continuidade: Suavize transições bruscas entre os blocos, garantindo que os parágrafos tenham um ritmo literário profissional.
4. Formatação: Retorne o texto formatado em Markdown, com quebras de parágrafo claras, usando negrito ou itálico apenas quando estritamente necessário para ênfase narrativa.

[HISTÓRIA]: "${story.title}"
[BLOCOS NARRATIVOS BRUTOS DA HISTÓRIA]:
${JSON.stringify(arrayBruto, null, 2)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          titulo_sugerido_para_o_capitulo: { type: 'string' },
          texto_compilado_markdown: { type: 'string', description: 'O texto literário completo e polido' },
          total_de_palavras: { type: 'string', description: 'Número estimado' }
        },
        required: ['titulo_sugerido_para_o_capitulo', 'texto_compilado_markdown', 'total_de_palavras']
      }
    });

    return Response.json(res);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});