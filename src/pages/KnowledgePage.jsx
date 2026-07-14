import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, BookMarked, Trash2, FileText, RefreshCw } from "lucide-react";
import GoogleDocsImport from "@/components/knowledge/GoogleDocsImport";
import HuggingFaceImport from "@/components/knowledge/HuggingFaceImport";

export default function KnowledgePage() {
  const queryClient = useQueryClient();
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => base44.entities.KnowledgeSource.list("-created_date", 50),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["knowledge"] });

  const remove = async (id) => {
    await base44.entities.KnowledgeSource.delete(id);
    refresh();
  };

  const [syncing, setSyncing] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const resync = async (id) => {
    setSyncing(id);
    setSyncError(null);
    try {
      await base44.functions.invoke("baseConhecimento", { action: "refreshSource", sourceId: id });
      refresh();
    } catch (e) {
      setSyncError(e.response?.data?.error || "Erro ao atualizar a fonte");
    }
    setSyncing(null);
  };

  return (
    <div className="min-h-screen bg-[#08080f] text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-zinc-500 hover:text-zinc-200 transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="font-display text-2xl">Base de Conhecimento</h1>
            <p className="text-xs text-zinc-600 mt-1">O cânone que os Superagentes consultam ao escrever cada cena.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <GoogleDocsImport onImported={refresh} />
          <HuggingFaceImport onImported={refresh} />
        </div>

        <div className="space-y-3">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-zinc-600">Fontes importadas</h2>
          {isLoading && <p className="text-sm text-zinc-600">Carregando...</p>}
          {!isLoading && sources.length === 0 && <p className="text-sm text-zinc-700 italic">Nenhuma fonte importada ainda.</p>}
          {syncError && <p className="text-xs text-red-400">{syncError}</p>}
          {sources.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-5 py-4">
              <div className="flex items-start gap-3 min-w-0">
                {s.source_type === "googledocs"
                  ? <FileText className="w-4 h-4 text-blue-400/70 mt-0.5 shrink-0" />
                  : <BookMarked className="w-4 h-4 text-amber-400/70 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{s.name}</p>
                  <p className="text-xs text-zinc-600 mt-0.5 line-clamp-2">{(s.content || "").slice(0, 160)}</p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1">
                <button onClick={() => resync(s.id)} disabled={!!syncing} title="Atualizar conteúdo da fonte original" className="text-zinc-600 hover:text-blue-400 transition-colors p-1 disabled:opacity-40">
                  <RefreshCw className={`w-4 h-4 ${syncing === s.id ? "animate-spin" : ""}`} />
                </button>
                <button onClick={() => remove(s.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}