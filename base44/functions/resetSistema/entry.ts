import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const FRASE_CONFIRMACAO = 'APAGAR TUDO';
const LIMITE_CONTAGEM = 5000;
const MAX_ITERACOES_DELETE = 200; // trava de segurança contra loop infinito (200 × 500 = 100k registros/entidade)

// Entidades apagadas por completo no reset, em ordem folha → raiz (higiene, sem FK real no Base44).
// SlashCommand é preservado de propósito: é configuração do app, não conteúdo do multiverso.
const ENTIDADES_NARRATIVAS = [
  'NarrativeBlock',
  'CharacterMemory',
  'GraphEdge',
  'GraphNode',
  'WorldObject',
  'Local',
  'Character',
  'Story',
  'Universe',
  'KnowledgeSource',
  'OntologyType'
];

function ehAdmin(user) {
  return user.role === 'admin' || user.id === '6a55c29fb7d4f6ae965f92fb' || user.email === 'ceo@amzdatasoftware.com';
}

async function contarEntidade(sdk, nome) {
  try {
    const registros = await sdk.entities[nome].filter({}, undefined, LIMITE_CONTAGEM);
    return { contagem: registros.length, aproximado: registros.length >= LIMITE_CONTAGEM };
  } catch (error) {
    return { contagem: 0, aproximado: false, erro: error.message };
  }
}

async function apagarTudoDaEntidade(sdk, nome) {
  let total = 0;
  try {
    let iteracoes = 0;
    while (iteracoes++ < MAX_ITERACOES_DELETE) {
      const r = await sdk.entities[nome].deleteMany({});
      total += r.deleted || 0;
      if (!r.deleted) break;
    }
    return { apagados: total };
  } catch (error) {
    return { apagados: total, erro: error.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ehAdmin(user)) return Response.json({ error: 'Apenas o administrador pode acessar o reset do sistema' }, { status: 403 });
    const sdk = base44.asServiceRole;
    const body = await req.json();

    // Modo preview: só leitura, retorna contagens + a lista de universos/histórias pro frontend montar o Mega Livro.
    if (body.preview) {
      const contagens = {};
      for (const nome of ENTIDADES_NARRATIVAS) {
        contagens[nome] = await contarEntidade(sdk, nome);
      }
      const [universos, historias] = await Promise.all([
        sdk.entities.Universe.filter({}, undefined, LIMITE_CONTAGEM),
        sdk.entities.Story.filter({}, undefined, LIMITE_CONTAGEM)
      ]);
      return Response.json({
        contagens,
        universos: universos.map((u) => ({ id: u.id, name: u.name })),
        historias: historias.map((s) => ({ id: s.id, title: s.title, universe_id: s.universe_id }))
      });
    }

    // Modo destrutivo: exige a frase exata, além do bypass de admin já checado acima. Dupla trava.
    if (body.confirmacao !== FRASE_CONFIRMACAO) {
      return Response.json({ error: `Confirmação inválida. Envie exatamente "${FRASE_CONFIRMACAO}".` }, { status: 400 });
    }

    const apagados = {};
    for (const nome of ENTIDADES_NARRATIVAS) {
      apagados[nome] = await apagarTudoDaEntidade(sdk, nome);
    }

    // Zera os créditos de todo mundo sem apagar as carteiras (orquestrador/checkout esperam uma UserWallet por usuário).
    let creditosZerados = 0;
    try {
      const carteiras = await sdk.entities.UserWallet.filter({}, undefined, LIMITE_CONTAGEM);
      creditosZerados = carteiras.length;
      await sdk.entities.UserWallet.updateMany({}, { nexus_tokens: 0 });
    } catch (_error) {
      // Best-effort: uma falha ao zerar créditos não deve esconder o resumo do resto do reset.
    }

    return Response.json({ apagados, creditosZerados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
