import React, { useState } from "react";
import ReactQuill from "react-quill";
import confetti from "canvas-confetti";
import { X, BookDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { generateBookPdf } from "./bookPdf";

// Converte o Markdown do Compilador de Cânone em HTML inicial para o editor
function markdownParaHtml(md) {
  return (md || "")
    .split(/\n\s*\n/)
    .map((b) => {
      let t = b.replace(/\n/g, " ").trim();
      if (!t) return "";
      if (t.startsWith("## ")) return `<h2>${t.slice(3)}</h2>`;
      if (t.startsWith("# ")) return `<h1>${t.slice(2)}</h1>`;
      t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
      return `<p>${t}</p>`;
    })
    .join("");
}

const MODULES = {
  toolbar: [[{ header: [1, 2, false] }], ["bold", "italic", "underline"], ["blockquote"], ["clean"]],
};

export default function PolishingStudio({ livro, onClose }) {
  const [html, setHtml] = useState(() => markdownParaHtml(livro.texto_compilado_markdown));
  const { toast } = useToast();

  const publicar = () => {
    generateBookPdf(livro, html);
    confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 120, spread: 120, origin: { x: 0.2, y: 0.4 } }), 300);
    setTimeout(() => confetti({ particleCount: 120, spread: 120, origin: { x: 0.8, y: 0.4 } }), 600);
    toast({ title: "Download iniciado!", description: "Seu livro foi lapidado e publicado. Parabéns, autor." });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08080f]/95 backdrop-blur-sm flex flex-col">
      <header className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-zinc-900">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-zinc-100 truncate">Estúdio de Lapidação</h2>
          <p className="text-[11px] text-zinc-500 truncate">{livro.titulo_capitulo} · edite livremente antes de publicar</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={publicar} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium">
            <BookDown className="w-4 h-4 mr-2" /> Publicar Livro
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900" title="Voltar sem exportar">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="mx-auto max-w-2xl bg-[#faf7f0] rounded-sm shadow-2xl shadow-black/60 min-h-full polishing-paper">
          <ReactQuill theme="snow" value={html} onChange={setHtml} modules={MODULES} />
        </div>
      </div>
      <style>{`
        .polishing-paper .ql-toolbar { border: none; border-bottom: 1px solid #e5e0d5; position: sticky; top: 0; background: #faf7f0; z-index: 10; border-radius: 2px 2px 0 0; }
        .polishing-paper .ql-container { border: none; font-family: Spectral, Georgia, serif; font-size: 16px; color: #27241d; }
        .polishing-paper .ql-editor { padding: 48px 56px 64px; min-height: 60vh; line-height: 1.8; }
      `}</style>
    </div>
  );
}