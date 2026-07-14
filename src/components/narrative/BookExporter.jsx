import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { BookDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

// Converte o Markdown polido em parágrafos de texto simples para o PDF
function markdownParaParagrafos(md) {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

export default function BookExporter({ storyId }) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const exportar = async () => {
    setExporting(true);
    toast({ title: "Compilando o cânone do multiverso...", description: "O Compilador de Cânone está polindo sua história." });
    try {
      const res = await base44.functions.invoke("exportarLivro", { storyId });
      const livro = res.data;

      const doc = new jsPDF({ unit: "mm", format: "a5" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxW = pageW - margin * 2;

      // ----- Página de título -----
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      doc.text(livro.nome_universo.toUpperCase(), pageW / 2, pageH / 3 - 14, { align: "center" });
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      const tituloLinhas = doc.splitTextToSize(livro.titulo_historia, maxW);
      doc.text(tituloLinhas, pageW / 2, pageH / 3, { align: "center" });
      doc.setFont("times", "italic");
      doc.setFontSize(12);
      const capLinhas = doc.splitTextToSize(livro.titulo_capitulo, maxW);
      doc.text(capLinhas, pageW / 2, pageH / 3 + 10 + tituloLinhas.length * 9, { align: "center" });
      doc.setFont("times", "normal");
      doc.setFontSize(9);
      doc.text("Base 44 · Motor Narrativo Multiversal", pageW / 2, pageH - margin, { align: "center" });

      // ----- Corpo do livro com quebra de página automática -----
      doc.addPage();
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      const lineH = 5.5;
      let y = margin;
      for (const paragrafo of markdownParaParagrafos(livro.texto_compilado_markdown)) {
        const linhas = doc.splitTextToSize(paragrafo, maxW);
        for (const linha of linhas) {
          if (y > pageH - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(linha, margin, y);
          y += lineH;
        }
        y += lineH * 0.8; // respiro entre parágrafos
      }

      doc.save(`${livro.titulo_historia.replace(/[^\w\sÀ-ÿ-]/g, "").trim() || "livro"}.pdf`);
      toast({ title: "Download iniciado", description: `"${livro.titulo_capitulo}" — ~${livro.total_de_palavras} palavras.` });
    } catch (e) {
      toast({ title: "Falha ao exportar o livro", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={exportar}
      disabled={exporting}
      title="Exportar como livro (PDF)"
      className="shrink-0 h-9 w-9 rounded-lg bg-transparent border-zinc-800 text-zinc-500 hover:text-amber-300 hover:border-amber-500/40 hover:bg-transparent transition-colors"
    >
      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookDown className="w-4 h-4" />}
    </Button>
  );
}