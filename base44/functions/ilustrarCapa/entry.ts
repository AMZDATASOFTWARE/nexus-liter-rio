import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Catálogo de estilos visuais — cada um é um "Style Prompt" (técnica/paleta/luz/enquadramento),
// nunca menciona conteúdo de cena (separação Style Prompt / Content Prompt). Fixado uma vez por
// universo, reaproveitado em todas as histórias dele.
const CATALOGO_ESTILOS = {
  cyberpunk: 'cyberpunk digital illustration, neon-lit futuristic cityscape, high contrast, cinematic dramatic lighting, moody blue and magenta color palette, detailed intricate line work, glossy reflective surfaces',
  infantil: "whimsical children's picture book watercolor illustration, soft pastel color palette, rounded friendly shapes, warm gentle lighting, storybook charm",
  anime: 'anime key visual illustration, clean cel-shaded linework, vibrant saturated colors, dynamic dramatic composition, expressive character design',
  fantasia_epica: 'epic fantasy oil painting illustration, dramatic golden lighting, richly detailed environments, painterly brushwork, grand sweeping landscapes',
  noir_sombrio: 'noir graphic novel illustration, high contrast black and white with a single selective color accent, dramatic hard shadows, gritty textured linework',
  aquarela_poetico: 'delicate watercolor illustration, soft translucent washes, dreamy atmospheric mood, muted poetic color palette, gentle brushstrokes',
  faroeste_empoeirado: 'dusty western illustration, warm sepia and ochre tones, harsh desert sunlight, weathered textures, wide open frontier landscapes',
  cosmico_etereo: 'ethereal cosmic illustration, deep space nebula colors, surreal otherworldly lighting, luminous particles, vast celestial scale'
};
const CHAVES_ESTILO = Object.keys(CATALOGO_ESTILOS);

// Baixa a imagem gerada (URL efêmera do provedor) e converte para data URL base64, pronta pro jsPDF.
async function baixarComoBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar a imagem gerada (status ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(binario)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sdk = base44.asServiceRole;
    const { storyId, resumoParaCapa } = await req.json();
    if (!storyId) return Response.json({ error: 'storyId é obrigatório' }, { status: 400 });

    const story = await sdk.entities.Story.get(storyId);
    const universe = await sdk.entities.Universe.get(story.universe_id);

    // Estilo é fixado uma vez por universo — todas as histórias dele reaproveitam o mesmo.
    let estilo = CHAVES_ESTILO.includes(universe.estilo_visual_ilustracao) ? universe.estilo_visual_ilustracao : null;
    if (!estilo) {
      const classificacao = await sdk.integrations.Core.InvokeLLM({
        prompt: `Classifique o estilo visual mais adequado para ilustrar este universo narrativo, escolhendo APENAS uma das opções da lista.

[NOME DO UNIVERSO]: "${universe.name}"
[REGRAS DO UNIVERSO]: "${universe.rules || 'Nenhuma regra definida.'}"
[TÍTULO DA HISTÓRIA]: "${story.title}"

[OPÇÕES]: ${CHAVES_ESTILO.join(', ')}`,
        response_json_schema: {
          type: 'object',
          properties: { estilo: { type: 'string', enum: CHAVES_ESTILO } },
          required: ['estilo']
        }
      });
      estilo = CHAVES_ESTILO.includes(classificacao.estilo) ? classificacao.estilo : CHAVES_ESTILO[0];
      await sdk.entities.Universe.update(universe.id, { estilo_visual_ilustracao: estilo });
    }

    // Content Prompt: descrição vívida e curta da cena da capa, separada do Style Prompt.
    const conteudo = await sdk.integrations.Core.InvokeLLM({
      prompt: `Descreva em 1 a 2 frases vívidas e visuais a cena/momento ideal para a capa de um livro, baseado no contexto abaixo. Foque em UMA imagem central marcante — não narre a trama inteira. Não mencione texto, títulos ou tipografia, apenas a cena visual.

[TÍTULO]: "${story.title}"
[UNIVERSO]: "${universe.rules || ''}"
[TRECHO DA HISTÓRIA]: "${(resumoParaCapa || '').slice(0, 1500)}"`,
      response_json_schema: {
        type: 'object',
        properties: { descricao_visual: { type: 'string' } },
        required: ['descricao_visual']
      }
    });

    const promptFinal = `${CATALOGO_ESTILOS[estilo]}. ${conteudo.descricao_visual}`;
    const imagem = await sdk.integrations.Core.GenerateImage({ prompt: promptFinal });
    const imagemBase64 = await baixarComoBase64(imagem.url);

    return Response.json({ imagemBase64, estilo, promptFinal });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
