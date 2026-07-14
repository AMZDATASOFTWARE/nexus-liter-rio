import React, { useMemo } from "react";
import { computeLayout, TIPO_CORES } from "./graphUtils";

export default function ForceGraph({ nodes, edges, selectedId, onSelect, width = 1200, height = 800 }) {
  const { positions, index } = useMemo(
    () => computeLayout(nodes, edges, width, height),
    [nodes, edges, width, height]
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {edges.map((e, i) => {
        const s = positions[index.get(e.origem)];
        const t = positions[index.get(e.destino)];
        if (!s || !t) return null;
        return (
          <g key={i}>
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#3f3f46" strokeWidth="1" opacity="0.6" />
            <text x={(s.x + t.x) / 2} y={(s.y + t.y) / 2 - 3} textAnchor="middle" fill="#52525b" fontSize="8" className="pointer-events-none select-none">
              {e.tipo_de_relacao?.replace(/_/g, " ")}
            </text>
          </g>
        );
      })}
      {nodes.map((n, i) => {
        const p = positions[i];
        const cor = n.cor_grafo || TIPO_CORES[n.tipo] || "#a1a1aa";
        const sel = n.node_id === selectedId;
        return (
          <g key={n.node_id} onClick={() => onSelect?.(n)} className="cursor-pointer">
            <circle cx={p.x} cy={p.y} r={sel ? 16 : 11} fill={cor} fillOpacity={sel ? 0.35 : 0.18} stroke={cor} strokeWidth={sel ? 2 : 1.2} />
            <circle cx={p.x} cy={p.y} r="4" fill={cor} />
            <text x={p.x} y={p.y + (sel ? 30 : 24)} textAnchor="middle" fill={sel ? "#fafafa" : "#a1a1aa"} fontSize="11" className="pointer-events-none select-none">
              {n.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}