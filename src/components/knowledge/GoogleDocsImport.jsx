import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Loader2, Download } from "lucide-react";

export default function GoogleDocsImport({ onImported }) {
  const [files, setFiles] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(null);
  const [error, setError] = useState(null);

  const listDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("baseConhecimento", { action: "listDocs" });
      setFiles(res.data.files);
    } catch (e) {
      setError(e.response?.data?.error || "Erro ao listar documentos");
    }
    setLoading(false);
  };

  const importDoc = async (docId) => {
    setImporting(docId);
    try {
      await base44.functions.invoke("baseConhecimento", { action: "importDoc", docId });
      onImported();
    } catch (e) {
      setError(e.response?.data?.error || "Erro ao importar documento");
    }
    setImporting(null);
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-zinc-200 text-sm font-medium">
          <FileText className="w-4 h-4 text-blue-400/70" /> Google Docs
        </div>
        <button onClick={listDocs} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-blue-400/40 transition-colors disabled:opacity-40">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Listar documentos"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {files && files.length === 0 && <p className="text-xs text-zinc-600 italic">Nenhum documento encontrado.</p>}
      {files?.map((f) => (
        <div key={f.id} className="flex items-center justify-between gap-3 border border-zinc-800/70 rounded-xl px-4 py-2.5">
          <p className="text-sm text-zinc-300 truncate">{f.name}</p>
          <button onClick={() => importDoc(f.id)} disabled={!!importing} className="shrink-0 text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-400/20 text-blue-300 hover:bg-blue-500/20 transition-colors disabled:opacity-40">
            {importing === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Importar
          </button>
        </div>
      ))}
    </div>
  );
}