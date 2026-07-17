import { jsPDF } from "jspdf";

const MARGEM = 20;
const GUTTER_OBJETO = 30;
const ALTURA_ABERTURA_CAPITULO_RATIO = 0.38;

// Carrega uma data URL numa <img> e recorta no estilo "cover" (preenche o retângulo alvo sem
// distorcer, cortando o excesso) para o aspect ratio informado. Devolve uma nova data URL PNG.
function recortarImagemCover(dataUrl, aspectAlvo) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const imgRatio = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgRatio > aspectAlvo) {
        sw = img.height * aspectAlvo;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / aspectAlvo;
        sy = (img.height - sh) / 2;
      }
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = dataUrl;
  });
}

// Desenha uma ilustração ocupando o topo de uma página (capa inteira ou abertura de capítulo),
// recortada "cover" pro aspect da faixa, com gradiente escuro na base pra dar contraste ao texto
// que vier a seguir. Reaproveitado tanto pela capa (faixa = página inteira) quanto pela abertura
// de cada capítulo (faixa = topo da página).
async function desenharIlustracaoNoTopo(doc, imagemBase64, pageW, alturaFaixa) {
  const recorte = await recortarImagemCover(imagemBase64, pageW / alturaFaixa);
  doc.addImage(recorte, "PNG", 0, 0, pageW, alturaFaixa);
  const alturaGradiente = alturaFaixa * 0.4;
  const faixas = 20;
  for (let i = 0; i < faixas; i++) {
    const t = i / (faixas - 1);
    doc.setFillColor(8, 8, 15);
    doc.setGState(new doc.GState({ opacity: t * 0.8 }));
    doc.rect(0, alturaFaixa - alturaGradiente + (alturaGradiente * i) / faixas, pageW, alturaGradiente / faixas + 0.5, "F");
  }
  doc.setGState(new doc.GState({ opacity: 1 }));
}

function desenharCapaSemIlustracao(doc, livro, pageW, pageH, maxW) {
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text((livro.nome_universo || "").toUpperCase(), pageW / 2, pageH / 3 - 14, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  const tituloLinhas = doc.splitTextToSize(livro.titulo_historia, maxW);
  doc.text(tituloLinhas, pageW / 2, pageH / 3, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(livro.titulo_capitulo || "", maxW), pageW / 2, pageH / 3 + 10 + tituloLinhas.length * 9, {
    align: "center",
  });
}

async function desenharCapaComIlustracao(doc, livro, capaBase64, pageW, pageH, maxW) {
  await desenharIlustracaoNoTopo(doc, capaBase64, pageW, pageH);

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(215, 215, 220);
  doc.text((livro.nome_universo || "").toUpperCase(), pageW / 2, pageH - 62, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  const tituloLinhas = doc.splitTextToSize(livro.titulo_historia, maxW);
  doc.text(tituloLinhas, pageW / 2, pageH - 48, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(225, 225, 230);
  doc.text(doc.splitTextToSize(livro.titulo_capitulo || "", maxW), pageW / 2, pageH - 48 + 10 + tituloLinhas.length * 9, {
    align: "center",
  });
  doc.setTextColor(0, 0, 0);
}

// Agrupa os elementos do corpo em capítulos: um grupo por <h1> encontrado (o próprio <h1> fica
// no início do grupo que ele abre), ou um único grupo com tudo quando não há nenhum <h1> (livro
// de capítulo único — texto compilado numa única leva, sem cabeçalho de capítulo).
function agruparPorCapitulo(elementos) {
  const grupos = [];
  let atual = [];
  for (const el of elementos) {
    if (el.tagName.toLowerCase() === "h1" && atual.length) {
      grupos.push(atual);
      atual = [];
    }
    atual.push(el);
  }
  if (atual.length) grupos.push(atual);
  return grupos;
}

// Decide, para cada ilustração secundária do capítulo, em qual parágrafo ela deve ser ancorada —
// o primeiro parágrafo cujo texto contém a âncora, ou o primeiro parágrafo do capítulo como
// fallback (nunca descarta uma ilustração silenciosamente, ex.: se o autor editou o texto depois
// do planejamento e a âncora não existe mais literalmente).
function resolverAncoragens(elementos, secundarias) {
  const paragrafos = elementos.filter((el) => el.tagName.toLowerCase() === "p" && (el.textContent || "").trim());
  const porParagrafo = new Map();
  if (!paragrafos.length) return { paragrafos, porParagrafo };
  for (const sec of secundarias || []) {
    let alvo = paragrafos.findIndex((p) => sec.ancora && p.textContent.includes(sec.ancora));
    if (alvo === -1) alvo = 0;
    if (!porParagrafo.has(alvo)) porParagrafo.set(alvo, []);
    porParagrafo.get(alvo).push(sec);
  }
  return { paragrafos, porParagrafo };
}

// Gera o PDF diagramado do livro a partir do HTML editado no Estúdio de Lapidação.
// `capaBase64` (opcional): data URL PNG da capa. `ilustracoesPorCapitulo` (opcional): array
// alinhado por índice de capítulo, cada item `{ abertura: {imagemBase64}, secundarias: [{tipo, ancora, imagemBase64}] }`.
export async function generateBookPdf(livro, html, capaBase64, ilustracoesPorCapitulo = []) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - MARGEM * 2;

  // ----- Página de título -----
  if (capaBase64) {
    await desenharCapaComIlustracao(doc, livro, capaBase64, pageW, pageH, maxW);
    doc.setTextColor(200, 200, 205); // legivel sobre o gradiente escuro que cobre a base da capa
  } else {
    desenharCapaSemIlustracao(doc, livro, pageW, pageH, maxW);
  }
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text("Nexus Literário · Motor Narrativo Multiversal", pageW / 2, pageH - MARGEM, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // ----- Corpo: percorre os blocos HTML do editor, agrupados por capítulo -----
  doc.addPage();
  const container = document.createElement("div");
  container.innerHTML = html;
  const capitulos = agruparPorCapitulo([...container.children]);

  let y = MARGEM;
  const ensureSpace = (h) => {
    if (y + h > pageH - MARGEM) {
      doc.addPage();
      y = MARGEM;
    }
  };

  for (let ci = 0; ci < capitulos.length; ci++) {
    const elementos = capitulos[ci];
    const ilustracoes = ilustracoesPorCapitulo[ci];
    const secundarias = ilustracoes?.secundarias || [];
    const temObjeto = secundarias.some((s) => s.tipo === "objeto");
    const larguraAtual = temObjeto ? maxW - GUTTER_OBJETO : maxW;

    // Abertura do capítulo: força nova página e desenha a ilustração no topo dela.
    if (ilustracoes?.abertura?.imagemBase64) {
      doc.addPage();
      y = MARGEM;
      await desenharIlustracaoNoTopo(doc, ilustracoes.abertura.imagemBase64, pageW, pageH * ALTURA_ABERTURA_CAPITULO_RATIO);
      y = pageH * ALTURA_ABERTURA_CAPITULO_RATIO + 14;
    }

    const { porParagrafo } = resolverAncoragens(elementos, secundarias);
    let indiceParagrafo = -1;

    for (const el of elementos) {
      const text = (el.textContent || "").trim();
      if (!text) continue;
      const tag = el.tagName.toLowerCase();
      const ehParagrafo = tag === "p";
      if (ehParagrafo) indiceParagrafo++;

      let size = 11, style = "normal", lineH = 5.5;
      if (tag === "h1") { size = 16; style = "bold"; lineH = 8; }
      else if (tag === "h2" || tag === "h3") { size = 13; style = "bold"; lineH = 7; }
      else if (tag === "blockquote") { style = "italic"; }
      doc.setFont("times", style);
      doc.setFontSize(size);

      const secDoParagrafo = ehParagrafo ? porParagrafo.get(indiceParagrafo) : null;
      const memoriaOuOffscreen = secDoParagrafo?.find((s) => s.tipo === "memoria" || s.tipo === "offscreen");
      const objetos = secDoParagrafo?.filter((s) => s.tipo === "objeto") || [];

      // Objetos ancorados neste parágrafo: ilustração pequena na margem lateral reservada.
      for (const obj of objetos) {
        try {
          const props = doc.getImageProperties(obj.imagemBase64);
          const wObj = GUTTER_OBJETO - 6;
          const hObj = (props.height / props.width) * wObj;
          ensureSpace(hObj);
          doc.addImage(obj.imagemBase64, "PNG", pageW - MARGEM - GUTTER_OBJETO + 4, y, wObj, hObj);
        } catch (_e) {
          // Ilustração de objeto malformada não deve interromper a diagramação do texto.
        }
      }

      if (memoriaOuOffscreen) {
        // Modo flutuante: a ilustração entra à esquerda do parágrafo, com o texto dele inteiro
        // fluindo ao lado dela em largura reduzida (wrap por caixa retangular, não por contorno).
        try {
          const props = doc.getImageProperties(memoriaOuOffscreen.imagemBase64);
          const wImg = larguraAtual * 0.55;
          const hImg = (props.height / props.width) * wImg;
          ensureSpace(hImg);
          const yTopoImagem = y;
          doc.addImage(memoriaOuOffscreen.imagemBase64, "PNG", MARGEM, y, wImg, hImg);
          const xFlutuante = MARGEM + wImg + 5;
          const larguraFlutuante = larguraAtual - wImg - 5;
          for (const linha of doc.splitTextToSize(text, larguraFlutuante)) {
            ensureSpace(lineH);
            doc.text(linha, xFlutuante, y);
            y += lineH;
          }
          y = Math.max(y, yTopoImagem + hImg) + lineH * 0.8;
          continue;
        } catch (_e) {
          // Se a ilustração falhar ao processar, cai pro fluxo normal de texto abaixo.
        }
      }

      for (const linha of doc.splitTextToSize(text, larguraAtual)) {
        ensureSpace(lineH);
        doc.text(linha, MARGEM, y);
        y += lineH;
      }
      y += lineH * 0.8;
    }
  }

  doc.save(`${(livro.titulo_historia || "livro").replace(/[^\w\sÀ-ÿ-]/g, "").trim() || "livro"}.pdf`);
}
