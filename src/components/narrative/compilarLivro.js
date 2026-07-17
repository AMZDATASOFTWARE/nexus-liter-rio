import { base44 } from "@/api/base44Client";

// Quantos blocos narrativos entram em cada capítulo compilado (1 chamada de LLM por capítulo)
const BLOCOS_POR_CAPITULO = 24;

async function invocarComRetry(payload) {
  try {
    return await base44.functions.invoke("exportarLivro", payload);
  } catch {
    return await base44.functions.invoke("exportarLivro", payload);
  }
}

/**
 * Compila uma história inteira em capítulos, sem limite de tamanho: 1 chamada de LLM por lote de
 * blocos, com resumo de continuidade entre lotes. Retorna os capítulos crus (não formatados),
 * para o chamador decidir como uni-los (livro isolado vs. seção de um Mega Livro).
 * @param {string} storyId
 * @param {string} modoCompilacao - 'integrado' | 'sem_bastidores' | 'interludios'
 * @param {(progresso: {atual: number, total: number}) => void} [onProgresso]
 * @param {() => boolean} [foiCancelado] - checado entre capítulos; retorna null se true
 */
export async function compilarCapitulosDaHistoria(storyId, modoCompilacao, onProgresso, foiCancelado) {
  onProgresso?.({ atual: 0, total: 0 });
  const man = await base44.functions.invoke("exportarLivro", { storyId, manifesto: true, modoCompilacao });
  const total = man.data.total_de_blocos_uteis;
  const totalPartes = Math.max(1, Math.ceil(total / BLOCOS_POR_CAPITULO));

  const capitulos = [];
  let contextoAnterior = null;
  for (let i = 0; i < totalPartes; i++) {
    if (foiCancelado?.()) return null;
    onProgresso?.({ atual: i + 1, total: totalPartes });
    const res = await invocarComRetry({
      storyId,
      modoCompilacao,
      blocoInicio: i * BLOCOS_POR_CAPITULO,
      blocoFim: Math.min((i + 1) * BLOCOS_POR_CAPITULO, total),
      contextoAnterior,
      parte: i + 1,
      totalPartes,
    });
    capitulos.push(res.data);
    contextoAnterior = res.data.resumo_para_continuidade || null;
  }
  return foiCancelado?.() ? null : capitulos;
}

// Junta os capítulos crus no formato usado pelo Estúdio de Lapidação de uma única história.
export function juntarCapitulosEmLivro(capitulos) {
  const primeiro = capitulos[0];
  const totalPartes = capitulos.length;
  const markdown =
    totalPartes === 1
      ? primeiro.texto_compilado_markdown
      : capitulos
          .map((c, i) => `# Capítulo ${i + 1} — ${c.titulo_capitulo || ""}\n\n${c.texto_compilado_markdown}`)
          .join("\n\n");

  return {
    titulo_historia: primeiro.titulo_historia,
    nome_universo: primeiro.nome_universo,
    titulo_capitulo: totalPartes === 1 ? primeiro.titulo_capitulo : `Livro completo · ${totalPartes} capítulos`,
    texto_compilado_markdown: markdown,
  };
}
