import React, { useState, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2, Globe, Share2, Layers } from "lucide-react";
import ForceGraph from "@/components/graph/ForceGraph";
import SphereGraph3D from "@/components/graph/SphereGraph3D";
import TemporalGraph3D from "@/components/graph/TemporalGraph3D";
import NodeDetails from "@/components/graph/NodeDetails";
import LodHud from "@/components/graph/LodHud";
import ZoomBar from "@/components/graph/ZoomBar";
import { TIPO_CORES } from "@/components/graph/graphUtils";

export default function GraphPage({ universeIdProp }) {
  const params = useParams();
  const universeId = universeIdProp || params.universeId;
  const [selected, setSelected] = useState(null);
  const [modo, setModo] = useState("2d");
  const [lod, setLod] = useState(null);
  const [lodLoading, setLodLoading] = useState(false);
  const lodBusy = useRef(false);
  const zoomRef = useRef(null);

  const handleViewportEvent = async (evt) => {
    if (lodBusy.current) return;
    lodBusy.current = true;
    setLodLoading(true);
    try {
      const r = (await base44.functions.invoke("grafoOmniversal", { acao: "viewport", ...evt })).data;
      setLod(r);
    } finally {
      lodBusy.current = false;
      setLodLoading(false);
    }
  };

  const { data: fisica, isLoading: loadingFisica } = useQuery({
    queryKey: ["fisica3d"],
    queryFn: async () => (await base44.functions.invoke("grafoOmniversal", { acao: "fisica3d" })).data,
    enabled: modo === "esfera",
    staleTime: 5 * 60 * 1000,
  });
  const { data: temporal, isLoading: loadingTemporal } = useQuery({
    queryKey: ["temporal3d"],
    queryFn: async () => (await base44.functions.invoke("grafoOmniversal", { acao: "temporal" })).data,
    enabled: modo === "tempo",
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
    <div className={`${universeIdProp ? "h-full" : "h-screen"} bg-[#08080f] text-zinc-100 flex flex-col overflow-hidden`}>
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
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              onClick={() => setModo("2d")}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition-colors ${modo === "2d" ? "border-emerald-500/50 text-emerald-300 bg-emerald-500/10" : "border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
            >
              <Share2 className="w-3.5 h-3.5" /> 2D
            </button>
            <button
              onClick={() => setModo("esfera")}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition-colors ${modo === "esfera" ? "border-emerald-500/50 text-emerald-300 bg-emerald-500/10" : "border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
            >
              <Globe className="w-3.5 h-3.5" /> Esfera 3D
            </button>
            <button
              onClick={() => setModo("tempo")}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition-colors ${modo === "tempo" ? "border-cyan-500/50 text-cyan-300 bg-cyan-500/10" : "border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
            >
              <Layers className="w-3.5 h-3.5" /> Camadas Temporais
            </button>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {legenda.map(([tipo, cor]) => (
              <span key={tipo} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="w-2 h-2 rounded-full" style={{ background: cor }} /> {tipo}
              </span>
            ))}
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0 relative">
        {modo === "esfera" ? (
          loadingFisica || !fisica ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-xs">O Físico de Dados 3D está calculando as forças centrípetas do Omniverso...</p>
            </div>
          ) : (
            <SphereGraph3D nos={fisica.nos || []} arestas={fisica.arestas || []} metadata={fisica.nodes_physics_metadata || []} lod={lod} onViewportEvent={handleViewportEvent} onSelect={setSelected} zoomControlRef={zoomRef} />
          )
        ) : modo === "tempo" ? (
          loadingTemporal || !temporal ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-xs">O Arquiteto de Estratificação Temporal está fatiando o Omniverso pelo eixo do tempo...</p>
            </div>
          ) : (
            <TemporalGraph3D nos={temporal.nos || []} arestas={temporal.arestas || []} layers={temporal.temporal_layers || []} wormholes={temporal.wormhole_edges || []} onSelect={setSelected} zoomControlRef={zoomRef} />
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
          <ForceGraph nodes={nodes} edges={edges} selectedId={selected?.node_id} onSelect={setSelected} render={render} zoomControlRef={zoomRef} />
        )}
        {/* initial calibrado para a posição de partida de cada câmera (2D: k=1 | esfera: ~573 | tempo: ~658) */}
        <ZoomBar key={modo} initial={modo === "esfera" ? 0.65 : modo === "tempo" ? 0.64 : 0.71} onZoom={(t) => zoomRef.current?.(t)} />
        {modo === "esfera" && <LodHud lod={lod} loading={lodLoading} onReset={() => setLod(null)} />}
        <NodeDetails node={selected} edges={modo === "esfera" && fisica ? fisica.arestas : modo === "tempo" && temporal ? temporal.arestas : edges} nodes={modo === "esfera" && fisica ? fisica.nos : modo === "tempo" && temporal ? temporal.nos : nodes} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}