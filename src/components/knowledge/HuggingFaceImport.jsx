import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Download } from "lucide-react";

export default function HuggingFaceImport({ onImported }) {
  const [repo, setRepo] = useState("");
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const importHF = async () => {
    if (!repo.trim() || !filePath.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await base44.functions.invoke("baseConhecimento", { action: "importHF", repo: repo.trim(), filePath: filePath.trim() });
      setRepo(""); setFilePath("");
      onImported();
    } catch (e) {
      setError(e.response?.data?.error || "Erro ao importar arquivo");
    }
    setLoading(false);
  };

  const inputCls = "w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-400/40 transition-colors";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
      <div className="flex items-center gap-2 text-zinc-200 text-sm font-medium">
        <span className="text-base">🤗</span> Hugging Face
      </div>
      <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Repositório (ex: usuario/meu-repo ou datasets/usuario/meu-dataset)" className={inputCls} />
      <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="Caminho do arquivo (ex: README.md ou lore/universo.txt)" className={inputCls} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={importHF} disabled={loading || !repo.trim() || !filePath.trim()} className="w-full inline-flex items-center justify-center gap-2 text-xs px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-400/20 text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-40">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Importar arquivo
      </button>
    </div>
  );
}