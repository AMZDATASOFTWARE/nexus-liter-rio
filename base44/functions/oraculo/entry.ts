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
    const [universe, blocks, povChars] = await Promise.all([
      sdk.entities.Universe.get(story.universe_id),
      sdk.entities.NarrativeBlock.filter({ story_id: storyId, type: 'AI' }, '-created_date', 2),
      story.current_pov_name
        ? sdk.entities.Character.filter({ universe_id: story.universe_id, name: story.current_pov_name })
        : Promise.resolve([])
    ]);
    blocks.reverse();
    const pov = povChars[0] || null;
    const cena = blocks.map((b) => b.content).join('\n\n') || 'A história ainda está no início.';

    const res = await sdk.integrations.Core.InvokeLLM({
      prompt: `Você é o Oráculo de Possibilidades do Base 44. O usuário (co-autor) está sofrendo de bloqueio criativo e solicitou sugestões de como continuar a cena atual.

SUA TAREFA:
Leia o contexto da cena atual e o estado psicológico do personagem POV, e gere 3 (três) sugestões de ações curtas que o usuário poderia tomar.

DIRETRIZES PARA AS SUGESTÕES:
- Sugestão 1 (Ação Lógica): O que o personagem faria naturalmente baseado em seus traços e memórias atuais para resolver o conflito imediato.
- Sugestão 2 (Ação Caótica/Risco): Uma ação impulsiva, perigosa ou emocional que pode piorar a situação, mas gerar muito drama (ex: quebrar uma regra do universo, trair um aliado).
- Sugestão 3 (Ação Investigativa/Passiva): Uma observação, recuo, ou diálogo interno que revela mais sobre o cenário ou usa um objeto do inventário que foi esquecido.

As sugestões devem ser escritas na primeira ou terceira pessoa (concordando com o POV), de forma concisa (máximo 15 palavras cada), prontas para serem inseridas no campo de input do usuário. Escreva em português.

[CENA ATUAL]: "${cena.slice(0, 4000)}"
[PERSONAGEM POV]: "${story.current_pov_name || 'narrador onisciente'} (Estado: ${pov?.psychological_state || 'desconhecido'}${pov?.tracos_iniciais?.length ? `; Traços: ${pov.tracos_iniciais.join(', ')}` : ''}${pov?.memoria_core?.length ? `; Memória core: ${pov.memoria_core.join('; ')}` : ''})"
[REGRAS DO UNIVERSO]: "${universe.rules || 'não definidas'}"`,
      response_json_schema: {
        type: 'object',
        properties: {
          sugestoes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string', enum: ['Lógica', 'Risco', 'Investigação'] },
                texto_input: { type: 'string', description: 'Texto pronto para a textarea do usuário (máx 15 palavras)' }
              },
              required: ['tipo', 'texto_input']
            }
          }
        },
        required: ['sugestoes']
      }
    });

    return Response.json(res);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});