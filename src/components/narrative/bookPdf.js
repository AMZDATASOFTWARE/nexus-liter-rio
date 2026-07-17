import { jsPDF } from "jspdf";

// Gera o PDF diagramado do livro a partir do HTML editado no Estúdio de Lapidação
export function generateBookPdf(livro, html) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxW = pageW - margin * 2;

  // ----- Página de título -----
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text((livro.nome_universo || "").toUpperCase(), pageW / 2, pageH / 3 - 14, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  const tituloLinhas = doc.splitTextToSize(livro.titulo_historia, maxW);
  doc.text(tituloLinhas, pageW / 2, pageH / 3, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(livro.titulo_capitulo || "", maxW), pageW / 2, pageH / 3 + 10 + tituloLinhas.length * 9, { align: "center" });
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