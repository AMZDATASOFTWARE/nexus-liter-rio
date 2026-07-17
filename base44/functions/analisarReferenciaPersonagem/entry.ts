import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Analisa um arquivo de referência de personagem (imagem ou PDF) já enviado via Core.UploadFile
// no frontend, extraindo uma descrição textual reaproveitável em prompts futuros (escrita e
// ilustração) — nunca o arquivo bruto de novo, só o texto destilado uma única vez aqui.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sdk = base44.asServiceRole;
    const { universeId, characterName, tipo, fileUrl, nomeArquivo } = await req.json();
    if (!universeId || !characterName || !fileUrl) {
      return Response.json({ error: 'universeId, characterName e fileUrl são obrigatórios' }, { status: 400 });
    }
    if (!['imagem_personagem', 'pdf_ficha'].includes(tipo)) {
      return Response.json({ error: 'tipo deve ser "imagem_personagem" ou "pdf_ficha"' }, { status: 400 });
    }

    let descricaoExtraida;
    if (tipo === 'imagem_personagem') {
      const analise = await sdk.integrations.Core.InvokeLLM({
        prompt: `Descreva em detalhe a aparência física do personagem retratado nesta imagem — traços do rosto, cor e estilo de cabelo, físico, roupas/equipamentos característicos, e qualquer marca ou detalhe visual distintivo. Escreva como uma referência canônica reutilizável, em português, sem mencionar que é uma imagem (ex: "Cabelos ruivos curtos, olhos verdes, cicatriz na sobrancelha esquerda, veste uma armadura de couro gasta...").`,
        file_urls: [fileUrl],
        response_json_schema: {
          type: 'object',
          properties: { descricao: { type: 'string' } },
          required: ['descricao']
        }
      });
      descricaoExtraida = analise.descricao;
    } else {
      const extracao = await sdk.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: 'object',
          properties: {
            aparencia_fisica: { type: 'string', description: 'Descrição física do personagem encontrada na ficha' },
            tracos_marcantes: { type: 'string', description: 'Traços de personalidade ou comportamento marcantes' },
            resumo_historico: { type: 'string', description: 'Resumo curto do histórico/backstory do personagem, se houver' }
          }
        }
      });
      descricaoExtraida = [extracao.aparencia_fisica, extracao.tracos_marcantes, extracao.resumo_historico]
        .filter(Boolean)
        .join(' ') || 'Ficha enviada sem campos reconhecíveis de aparência ou traços.';
    }

    const asset = await sdk.entities.CharacterAsset.create({
      universe_id: universeId,
      character_name: characterName,
      tipo,
      nome_arquivo: nomeArquivo || '',
      file_url: fileUrl,
      descricao_extraida: descricaoExtraida
    });

    return Response.json(asset);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
