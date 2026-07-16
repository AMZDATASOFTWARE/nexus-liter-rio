import React from "react";
import { X } from "lucide-react";
import { TIPO_CORES } from "./graphUtils";

export default function NodeDetails({ node, edges, nodes, onClose }) {
  if (!node) return null;
  const relacionadas = edges.filter((e) => e.origem === node.node_id || e.destino === node.node_id);
  const rotulo = (id) => nodes.find((n) => n.node_id === id)?.rotulo || id;
  const cor = TIPO_CORES[node.tipo] || "#a1a1aa";
  return (
    <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 z-10 max-h-[75vh] flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="flex items-start justify-between gap-2 p-4 pb-2 shrink-0">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: cor }}>{node.tipo}</span>
          <h3 className="text-sm text-zinc-100 font-medium">{node.rotulo}</h3>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="w-4 h-4" /></button>
      </div>
      <div className="overflow-y-auto px-4 pb-4 space-y-2 grow [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        {node.descricao_breve && <p className="text-xs text-zinc-400 leading-relaxed">{node.descricao_breve}</p>}
        {node.pertence_ao_agente_base44 && (
          <p className="text-[11px] text-violet-300/70">Custódia: {node.pertence_ao_agente_base44}</p>
        )}
        {relacionadas.length > 0 && (
          <div className="pt-1 space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Conexões</p>
            {relacionadas.map((e, i) => (
              <p key={i} className="text-[11px] text-zinc-500">
                {rotulo(e.origem)} <span className="text-zinc-600 italic">{e.tipo_de_relacao?.replace(/_/g, " ")}</span> {rotulo(e.destino)}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}