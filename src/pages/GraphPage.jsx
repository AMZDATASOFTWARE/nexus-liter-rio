import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2 } from "lucide-react";
import ForceGraph from "@/components/graph/ForceGraph";
import NodeDetails from "@/components/graph/NodeDetails";
import { TIPO_CORES } from "@/components/graph/graphUtils";

export default function GraphPage() {
  const { universeId } = useParams();
  const [selected, setSelected] = useState(null);

  const { data: universe } = useQuery({
    queryKey: ["universe", universeId],
    queryFn: () => base44.entities.Universe.get(universeId),
  });
  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ["graphNodes", universeId],
    queryFn: () => base44.entities.GraphNode.filter({ universe_id: universeId }, "created_date", 500),
  });
  const { data: edges = [] } = useQuery({
    queryKey: ["graphEdges", universeId],
    queryFn: () => base44.entities.GraphEdge.filter({ universe_id: universeId }, "created_date", 1000),
  });

  return (
    <div className="h-screen bg-[#08080f] text-zinc-100 flex flex-col overflow-hidden">
      <header className="shrink-0 backdrop-blur-xl bg-[#08080f]/80 border-b border-zinc-900">
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-display text-lg truncate">Megagrafo · {universe?.name || "..."}</h1>
              <p className="text-[11px] text-zinc-500">{nodes.length} nós · {edges.length} conexões</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {Object.entries(TIPO_CORES).map(([tipo, cor]) => (
              <span key={tipo} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="w-2 h-2 rounded-full" style={{ background: cor }} /> {tipo}
              </span>
            ))}
          </div>
        </div>
      </header>
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-zinc-600">O Arquiteto de Dados ainda não mapeou este universo. Continue a narrativa para gerar o grafo.</p>
          </div>
        ) : (
          <ForceGraph nodes={nodes} edges={edges} selectedId={selected?.node_id} onSelect={setSelected} />
        )}
        <NodeDetails node={selected} edges={edges} nodes={nodes} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}