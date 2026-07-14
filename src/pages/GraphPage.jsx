import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2, Globe, Share2 } from "lucide-react";
import ForceGraph from "@/components/graph/ForceGraph";
import SphereGraph3D from "@/components/graph/SphereGraph3D";
import NodeDetails from "@/components/graph/NodeDetails";
import { TIPO_CORES } from "@/components/graph/graphUtils";

export default function GraphPage() {
  const { universeId } = useParams();
  const [selected, setSelected] = useState(null);
  const [modo3d, setModo3d] = useState(false);

  const { data: fisica, isLoading: loadingFisica } = useQuery({
    queryKey: ["fisica3d"],
    queryFn: async () => (await base44.functions.invoke("grafoOmniversal", { acao: "fisica3d" })).data,
    enabled: modo3d,
    staleTime: 5 * 60 * 1000,
  });

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
  const { data: stories = [] } = useQuery({
    queryKey: ["renderGrafo", universeId],
    queryFn: () => base44.entities.Story.filter({ universe_id: universeId }, "-updated_date", 1),
  });
  const render = useMemo(() => {
    try { return stories[0]?.render_grafo ? JSON.parse(stories[0].render_grafo) : null; } catch { return null; }
  }, [stories]);
  const legenda = useMemo(() => {
    const m = new Map(Object.entries(TIPO_CORES));
    nodes.forEach((n) => { if (n.tipo && !m.has(n.tipo)) m.set(n.tipo, n.cor_grafo || "#a1a1aa"); });
    return [...m.entries()];
  }, [nodes]);

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
              <p className="text-[11px] text-zinc-500">
                {nodes.length} nós · {edges.length} conexões
                {render?.nivel_de_zoom_recomendado && <span className="text-emerald-400/80"> · zoom {render.nivel_de_zoom_recomendado}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => setModo3d((v) => !v)}
            className={`shrink-0 flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition-colors ${modo3d ? "border-emerald-500/50 text-emerald-300 bg-emerald-500/10" : "border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
          >
            {modo3d ? <Share2 className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            {modo3d ? "Grafo 2D" : "Esfera 3D"}
          </button>
          <div className="hidden md:flex items-center gap-3">
            {legenda.map(([tipo, cor]) => (
              <span key={tipo} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="w-2 h-2 rounded-full" style={{ background: cor }} /> {tipo}
              </span>
            ))}
          </div>
        </div>
      </header>
      <div className="flex-1 relative">
        {modo3d ? (
          loadingFisica || !fisica ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-xs">O Físico de Dados 3D está calculando as forças centrípetas do Omniverso...</p>
            </div>
          ) : (
            <SphereGraph3D nos={fisica.nos || []} arestas={fisica.arestas || []} metadata={fisica.nodes_physics_metadata || []} onSelect={setSelected} />
          )
        ) : isLoading ? (
          <div className="h-full flex items-center justify-center text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-zinc-600">O Arquiteto de Dados ainda não mapeou este universo. Continue a narrativa para gerar o grafo.</p>
          </div>
        ) : (
          <ForceGraph nodes={nodes} edges={edges} selectedId={selected?.node_id} onSelect={setSelected} render={render} />
        )}
        <NodeDetails node={selected} edges={modo3d && fisica ? fisica.arestas : edges} nodes={modo3d && fisica ? fisica.nos : nodes} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}