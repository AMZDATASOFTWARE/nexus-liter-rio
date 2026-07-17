import { jsPDF } from "jspdf";

// Carrega uma data URL numa <img> e recorta no estilo "cover" (preenche o retângulo alvo
// sem distorcer, cortando o excesso) para o aspect ratio da página. Devolve uma nova data URL PNG.
function recortarImagemParaCapa(dataUrl, aspectAlvo) {
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
    img.onerror = () => reject(new Error("Falha ao carregar a imagem da capa"));
    img.src = dataUrl;
  });
}

// Desenha a capa em full bleed (a ilustração cobre a página inteira) com um gradiente escuro
// na base pra garantir contraste, e o título/universo/capítulo sobrepostos à imagem.
async function desenharCapaComIlustracao(doc, livro, capaBase64, pageW, pageH, maxW) {
  const capaRecortada = await recortarImagemParaCapa(capaBase64, pageW / pageH);
  doc.addImage(capaRecortada, "PNG", 0, 0, pageW, pageH);

  const alturaGradiente = pageH * 0.52;
  const faixas = 28;
  for (let i = 0; i < faixas; i++) {
    const t = i / (faixas - 1);
    doc.setFillColor(8, 8, 15);
    doc.setGState(new doc.GState({ opacity: t * 0.85 }));
    doc.rect(0, pageH - alturaGradiente + (alturaGradiente * i) / faixas, pageW, alturaGradiente / faixas + 0.5, "F");
  }
  doc.setGState(new doc.GState({ opacity: 1 }));

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

// Gera o PDF diagramado do livro a partir do HTML editado no Estúdio de Lapidação.
// `capaBase64` (opcional) é uma data URL PNG gerada pela ilustração de capa por IA.
export async function generateBookPdf(livro, html, capaBase64) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxW = pageW - margin * 2;

  // ----- Página de título -----
  if (capaBase64) {
    await desenharCapaComIlustracao(doc, livro, capaBase64, pageW, pageH, maxW);
    doc.setTextColor(200, 200, 205); // ré sobre o gradiente escuro que cobre a base da capa
  } else {
    desenharCapaSemIlustracao(doc, livro, pageW, pageH, maxW);
  }
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text("Nexus Literário · Motor Narrativo Multiversal", pageW / 2, pageH - margin, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // ----- Corpo: percorre os blocos HTML do editor -----
  doc.addPage();
  const container = document.createElement("div");
  container.innerHTML = html;
  let y = margin;
  const ensureSpace = (h) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  for (const el of container.children) {
    const text = (el.textContent || "").trim();
    if (!text) continue;
    const tag = el.tagName.toLowerCase();
    let size = 11, style = "normal", lineH = 5.5;
    if (tag === "h1") { size = 16; style = "bold"; lineH = 8; }
    else if (tag === "h2" || tag === "h3") { size = 13; style = "bold"; lineH = 7; }
    else if (tag === "blockquote") { style = "italic"; }
    doc.setFont("times", style);
    doc.setFontSize(size);
    for (const linha of doc.splitTextToSize(text, maxW)) {
      ensureSpace(lineH);
      doc.text(linha, margin, y);
      y += lineH;
    }
    y += lineH * 0.8;
  }

  doc.save(`${(livro.titulo_historia || "livro").replace(/[^\w\sÀ-ÿ-]/g, "").trim() || "livro"}.pdf`);
}
