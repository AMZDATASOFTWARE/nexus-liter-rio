import React, { useState } from "react";
import { createPortal } from "react-dom";
import ReactQuill from "react-quill";
import confetti from "canvas-confetti";
import { X, BookDown, ImagePlus, Loader2, RefreshCw, BookImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { generateBookPdf } from "./bookPdf";
import { aplicarVinhetaOrganica } from "./ilustracaoRecorte";

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

const NOMES_ESTILO = {
  cyberpunk: "Cyberpunk",
  infantil: "Infantil",
  anime: "Anime",
  fantasia_epica: "Fantasia Épica",
  noir_sombrio: "Noir Sombrio",
  aquarela_poetico: "Aquarela Poético",
  faroeste_empoeirado: "Faroeste Empoeirado",
  cosmico_etereo: "Cósmico Etéreo",
};

export default function PolishingStudio({ livro, storyId, universeId, capitulosBrutos, onClose }) {
  const [html, setHtml] = useState(() => markdownParaHtml(livro.texto_compilado_markdown));
  const [gerandoCapa, setGerandoCapa] = useState(false);
  const [capa, setCapa] = useState(null); // { imagemBase64, estilo }
  const [progressoIlustracao, setProgressoIlustracao] = useState(null); // { atual, total }
  const [ilustracoesPorCapitulo, setIlustracoesPorCapitulo] = useState([]);
  const [publicando, setPublicando] = useState(false);
  const { toast } = useToast();
  const ilustrandoCapitulos = progressoIlustracao !== null;
  const podeIlustrarCapitulos = !!(storyId && universeId && capitulosBrutos?.length);

  const gerarCapa = async () => {
    setGerandoCapa(true);
    try {
      const textoPlano = html.replace(/<[^>]+>/g, " ").trim();
      const res = await base44.functions.invoke("ilustrarCapa", { storyId, resumoParaCapa: textoPlano.slice(0, 1500) });
      setCapa({ imagemBase64: res.data.imagemBase64, estilo: res.data.estilo });
    } catch (e) {
      toast({ title: "Falha ao gerar a ilustração", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setGerandoCapa(false);
    }
  };

  const ilustrarCapitulos = async () => {
    setProgressoIlustracao({ atual: 0, total: capitulosBrutos.length });
    const resultado = [];
    try {
      for (let i = 0; i < capitulosBrutos.length; i++) {
        setProgressoIlustracao({ atual: i + 1, total: capitulosBrutos.length });
        const cap = capitulosBrutos[i];
        try {
          const res = await base44.functions.invoke("ilustrarCapitulo", {
            universeId,
            storyId,
            segmentos: cap.segmentos || [],
            tituloCapitulo: cap.titulo_capitulo,
          });
          const abertura = res.data.abertura?.imagemBase64
            ? { imagemBase64: await aplicarVinhetaOrganica(res.data.abertura.imagemBase64, "retangular_suave") }
            : null;
          const secundarias = await Promise.all(
            (res.data.secundarias || []).map(async (s) => ({
              ...s,
              imagemBase64: await aplicarVinhetaOrganica(s.imagemBase64, "organico"),
            }))
          );
          resultado.push({ abertura, secundarias });
        } catch {
          resultado.push(null); // esse capítulo fica sem ilustração, mas não trava os demais
        }
      }
      setIlustracoesPorCapitulo(resultado);
      const comIlustracao = resultado.filter(Boolean).length;
      toast({
        title: "Capítulos ilustrados",
        description: `${comIlustracao} de ${capitulosBrutos.length} capítulo(s) ganharam ilustrações.`,
      });
    } finally {
      setProgressoIlustracao(null);
    }
  };

  const publicar = async () => {
    setPublicando(true);
    try {
      await generateBookPdf(livro, html, capa?.imagemBase64, ilustracoesPorCapitulo);
      confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 120, spread: 120, origin: { x: 0.2, y: 0.4 } }), 300);
      setTimeout(() => confetti({ particleCount: 120, spread: 120, origin: { x: 0.8, y: 0.4 } }), 600);
      toast({ title: "Download iniciado!", description: "Seu livro foi lapidado e publicado. Parabéns, autor." });
    } catch (e) {
      toast({ title: "Falha ao gerar o PDF", description: e.message, variant: "destructive" });
    } finally {
      setPublicando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-[#08080f]/95 backdrop-blur-sm flex flex-col">
      <header className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-zinc-900">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-zinc-100 truncate">Estúdio de Lapidação</h2>
          <p className="text-[11px] text-zinc-500 truncate">{livro.titulo_capitulo} · edite livremente antes de publicar</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={publicar} disabled={publicando} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium">
            {publicando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookDown className="w-4 h-4 mr-2" />}
            {publicando ? "Gerando PDF..." : "Publicar Livro"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900" title="Voltar sem exportar">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {storyId && (
        <div className="shrink-0 px-6 py-3 border-b border-zinc-900 flex flex-wrap items-center gap-3">
          {capa ? (
            <>
              <img src={capa.imagemBase64} alt="Capa gerada" className="h-14 w-14 object-cover rounded-md border border-zinc-800" />
              <div className="min-w-0">
                <p className="text-xs text-zinc-400">
                  Capa gerada · estilo <span className="text-amber-300">{NOMES_ESTILO[capa.estilo] || capa.estilo}</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={gerarCapa}
                disabled={gerandoCapa}
                className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
              >
                {gerandoCapa ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                Gerar outra versão
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={gerarCapa}
              disabled={gerandoCapa}
              className="border-zinc-800 text-zinc-400 hover:text-amber-300 hover:border-amber-500/40"
            >
              {gerandoCapa ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5 mr-2" />}
              {gerandoCapa ? "Gerando ilustração..." : "Gerar ilustração de capa"}
            </Button>
          )}

          {podeIlustrarCapitulos && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-800">|</span>
              <Button
                variant="outline"
                size="sm"
                onClick={ilustrarCapitulos}
                disabled={ilustrandoCapitulos}
                className="border-zinc-800 text-zinc-400 hover:text-amber-300 hover:border-amber-500/40"
              >
                {ilustrandoCapitulos ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <BookImage className="w-3.5 h-3.5 mr-2" />}
                {ilustrandoCapitulos
                  ? `Ilustrando capítulo ${progressoIlustracao.atual} de ${progressoIlustracao.total}...`
                  : ilustracoesPorCapitulo.length
                  ? "Reilustrar capítulos"
                  : "Ilustrar capítulos"}
              </Button>
              {!ilustrandoCapitulos && ilustracoesPorCapitulo.length > 0 && (
                <p className="text-xs text-zinc-500">
                  {ilustracoesPorCapitulo.filter(Boolean).length} de {ilustracoesPorCapitulo.length} capítulo(s) ilustrados
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
    </div>,
    document.body
  );
}
