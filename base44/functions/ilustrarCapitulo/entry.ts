import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Catálogo de estilos visuais — mesma lista de `ilustrarCapa/entry.ts` (duplicado de propósito,
// mesma convenção já usada no projeto para pequenos catálogos/helpers entre functions).
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
const MAX_SECUNDARIAS = 2;

// Enquadramentos por tipo de ilustração — aplicados por cima do Style Prompt do universo.
const ENQUADRAMENTO_POR_TIPO = {
  abertura: 'wide establishing shot, the central defining moment of this chapter, cinematic composition',
  memoria: 'a hazy, dreamlike flashback vignette, softer and less defined than a normal scene, slightly desaturated, wistful mood',
  offscreen: 'a distant parallel scene glimpsed from afar, as if seen through a window or across a distance, conveying simultaneity',
  objeto: 'an isolated object study on a simple plain background, like a naturalist field-journal illustration inset, no characters'
};

async function baixarComoBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar imagem gerada (status ${res.status})`);
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
    const { universeId, storyId, segmentos, tituloCapitulo } = await req.json();
    if (!universeId || !storyId || !Array.isArray(segmentos) || !segmentos.length) {
      return Response.json({ error: 'universeId, storyId e segmentos são obrigatórios' }, { status: 400 });
    }

    const universe = await sdk.entities.Universe.get(universeId);

    // Estilo fixado uma vez por universo — mesmo campo/lógica já usado por ilustrarCapa.
    let estilo = CHAVES_ESTILO.includes(universe.estilo_visual_ilustracao) ? universe.estilo_visual_ilustracao : null;
    if (!estilo) {
      const classificacao = await sdk.integrations.Core.InvokeLLM({
        prompt: `Classifique o estilo visual mais adequado para ilustrar este universo narrativo, escolhendo APENAS uma das opções da lista.

[NOME DO UNIVERSO]: "${universe.name}"
[REGRAS DO UNIVERSO]: "${universe.rules || 'Nenhuma regra definida.'}"

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

    // Objetos do universo mencionados nos segmentos de cena deste capítulo — candidatos a ilustração de objeto.
    let objetosCasados = [];
    try {
      const objetos = await sdk.entities.WorldObject.filter({ universe_id: universeId });
      const textoCena = segmentos.filter((s) => s.tipo === 'cena').map((s) => s.texto_markdown).join(' ').toLowerCase();
      objetosCasados = objetos.filter((o) => o.name && textoCena.includes(o.name.toLowerCase()));
    } catch (_e) {
      objetosCasados = [];
    }

    // Curadoria: escolhe a cena da abertura + até MAX_SECUNDARIAS ilustrações entre memória/bastidores/objeto.
    const curadoria = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é o Curador de Ilustrações de um livro. Leia os segmentos deste capítulo (já rotulados por tipo) e decida quais momentos merecem virar ilustração.

REGRAS:
1. Sempre escolha UMA cena de abertura: o momento mais marcante e visual do capítulo inteiro (pode vir de qualquer segmento tipo "cena").
2. Escolha no máximo ${MAX_SECUNDARIAS} ilustrações secundárias adicionais, priorizando os segmentos "memoria" e "offscreen" existentes e os objetos importantes mencionados (se relevantes o suficiente pra merecer destaque visual). Não force — se o capítulo não tiver bastidores/memórias/objetos marcantes, escolha menos.
3. Para cada ilustração (abertura e secundárias), escreva uma "descricao_visual" de 1-2 frases vívidas focando em UMA imagem central, sem mencionar texto/tipografia.
4. Para cada ilustração SECUNDÁRIA, forneça também uma "ancora": um trecho EXATO (copiado literalmente, 6 a 12 palavras) do segmento de onde ela vem, para localizar onde encaixar a imagem no texto.

[TÍTULO DO CAPÍTULO]: "${tituloCapitulo || ''}"
[SEGMENTOS DO CAPÍTULO]:
${JSON.stringify(segmentos, null, 2)}
[OBJETOS DO UNIVERSO MENCIONADOS NESTE CAPÍTULO]: ${objetosCasados.map((o) => o.name).join(', ') || 'nenhum'}`,
      response_json_schema: {
        type: 'object',
        properties: {
          abertura: {
            type: 'object',
            properties: { descricao_visual: { type: 'string' } },
            required: ['descricao_visual']
          },
          secundarias: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string', enum: ['memoria', 'offscreen', 'objeto'] },
                descricao_visual: { type: 'string' },
                ancora: { type: 'string' }
              },
              required: ['tipo', 'descricao_visual', 'ancora']
            }
          }
        },
        required: ['abertura', 'secundarias']
      }
    });

    const secundariasEscolhidas = (curadoria.secundarias || []).slice(0, MAX_SECUNDARIAS);

    async function gerarIlustracao(tipo, descricaoVisual) {
      const promptFinal = `${CATALOGO_ESTILOS[estilo]}, ${ENQUADRAMENTO_POR_TIPO[tipo]}. ${descricaoVisual}`;
      const imagem = await sdk.integrations.Core.GenerateImage({ prompt: promptFinal });
      return await baixarComoBase64(imagem.url);
    }

    const abertura = { imagemBase64: await gerarIlustracao('abertura', curadoria.abertura.descricao_visual) };

    const secundarias = [];
    for (const s of secundariasEscolhidas) {
      try {
        const imagemBase64 = await gerarIlustracao(s.tipo, s.descricao_visual);
        secundarias.push({ tipo: s.tipo, ancora: s.ancora, imagemBase64 });
      } catch (_e) {
        // Uma ilustração secundária falhando não deve derrubar as demais nem a abertura.
      }
    }

    return Response.json({ estilo, abertura, secundarias });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
