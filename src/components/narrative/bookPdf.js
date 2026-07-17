import { jsPDF } from "jspdf";

// Gera o PDF diagramado do livro a partir do HTML editado no Estúdio de Lapidação.
// `capaBase64` (opcional) é uma data URL PNG gerada pela ilustração de capa por IA.
export function generateBookPdf(livro, html, capaBase64) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxW = pageW - margin * 2;

  // ----- Página de título -----
  let yTitulo = pageH / 3;
  if (capaBase64) {
    const props = doc.getImageProperties(capaBase64);
    const larguraMax = pageW - margin * 2;
    const alturaMax = pageH * 0.42;
    let w = larguraMax;
    let h = (props.height / props.width) * w;
    if (h > alturaMax) {
      h = alturaMax;
      w = (props.width / props.height) * h;
    }
    doc.addImage(capaBase64, "PNG", (pageW - w) / 2, 14, w, h);
    yTitulo = 14 + h + 18;
  }

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text((livro.nome_universo || "").toUpperCase(), pageW / 2, yTitulo - 14, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  const tituloLinhas = doc.splitTextToSize(livro.titulo_historia, maxW);
  doc.text(tituloLinhas, pageW / 2, yTitulo, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(livro.titulo_capitulo || "", maxW), pageW / 2, yTitulo + 10 + tituloLinhas.length * 9, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text("Nexus Literário · Motor Narrativo Multiversal", pageW / 2, pageH - margin, { align: "center" });

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