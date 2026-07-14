import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Lightbulb, Loader2, X, Compass, Flame, Eye } from "lucide-react";

const ESTILOS = {
  "Lógica": { icon: Compass, cls: "border-sky-500/40 text-sky-300 hover:bg-sky-500/10" },
  "Risco": { icon: Flame, cls: "border-rose-500/40 text-rose-300 hover:bg-rose-500/10" },
  "Investigação": { icon: Eye, cls: "border-violet-500/40 text-violet-300 hover:bg-violet-500/10" },
};

export default function OracleSuggestions({ storyId, onPick }) {
  const [loading, setLoading] = useState(false);
  const [sugestoes, setSugestoes] = useState(null);

  const consultar = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("oraculo", { storyId });
      setSugestoes(res.data?.sugestoes || []);
    } finally {
      setLoading(false);
    }
  };

  if (!sugestoes && !loading) {
    return (
      <button
        onClick={consultar}
        className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-amber-300 transition-colors mb-2 px-1"
        title="Consultar o Oráculo de Possibilidades"
      >
        <Lightbulb className="w-3.5 h-3.5" /> Sem ideias? Consulte o Oráculo
      </button>
    );
  }

  return (
    <div className="mb-2 px-1">
      {loading ? (
        <p className="flex items-center gap-2 text-[11px] text-amber-300/70">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> O Oráculo sonda as linhas do destino...
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {sugestoes.map((s, i) => {
            const est = ESTILOS[s.tipo] || ESTILOS["Lógica"];
            const Icon = est.icon;
            return (
              <button
                key={i}
                onClick={() => { onPick(s.texto_input); setSugestoes(null); }}
                className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border bg-zinc-900/70 transition-colors ${est.cls}`}
                title={s.tipo}
              >
                <Icon className="w-3 h-3 shrink-0" /> {s.texto_input}
              </button>
            );
          })}
          <button onClick={() => setSugestoes(null)} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors" title="Fechar sugestões">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}