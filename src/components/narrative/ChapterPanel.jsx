import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { X, Copy, Check, BookOpen } from "lucide-react";

export default function ChapterPanel({ capitulo, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(capitulo.texto_compilado_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#0b0b14] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-900">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-base text-zinc-100 truncate">{capitulo.titulo_sugerido_para_o_capitulo}</h2>
              <p className="text-[10px] text-zinc-600">Compilador de Cânone · ~{capitulo.total_de_palavras} palavras</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={copy} className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado" : "Copiar Markdown"}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-8 py-8">
          <ReactMarkdown className="prose prose-invert prose-sm max-w-none font-heading prose-p:leading-relaxed prose-p:text-zinc-300">
            {capitulo.texto_compilado_markdown}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}