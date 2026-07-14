import React from "react";
import { Loader2, Eye } from "lucide-react";

const NIVEIS = {
  Macro_Galactic: "Visão Deus · Macro Galáctico",
  Meso_Faction: "Exploração · Meso Facção",
  Micro_Personal: "Visão Microscópica · Rede Pessoal",
};

export default function LodHud({ lod, loading, onReset }) {
  if (!lod && !loading) return null;
  return (
    <div className="absolute bottom-4 left-4 max-w-sm rounded-xl border border-zinc-800 bg-[#0c0c16]/90 backdrop-blur px-4 py-3 text-zinc-300">
      {loading ? (
        <p className="flex items-center gap-2 text-[11px] text-zinc-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Controlador de Viewport calculando o LOD...
        </p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-[11px] text-emerald-300">
            <Eye className="w-3.5 h-3.5" /> {NIVEIS[lod.lod_level] || lod.lod_level}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{lod.ui_feedback}</p>
          <button onClick={onReset} className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
            Restaurar visão completa
          </button>
        </>
      )}
    </div>
  );
}