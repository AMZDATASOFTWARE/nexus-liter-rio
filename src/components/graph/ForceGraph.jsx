import React, { useMemo, useState, useRef } from "react";
import { computeLayout, TIPO_CORES } from "./graphUtils";

export default function ForceGraph({ nodes, edges, selectedId, onSelect, render, width = 1200, height = 800 }) {
  const { positions, index } = useMemo(
    () => computeLayout(nodes, edges, width, height),
    [nodes, edges, width, height]
  );
  const colapsados = new Set(render?.clusters_para_colapsar || []);
  const expandidos = new Set([...(render?.nos_para_expandir || []), render?.camera_foco_id].filter(Boolean));
  const destaques = new Set((render?.arestas_em_destaque || []).map((a) => `${a.origem}|${a.destino}`));

  const svgRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef(null);

  const onWheel = (e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const py = ((e.clientY - rect.top) / rect.height) * height;
    setView((v) => {
      const k = Math.min(8, Math.max(0.2, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
    });
  };
  const onPointerDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.sx) / rect.width) * width;
    const dy = ((e.clientY - drag.current.sy) / rect.height) * height;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.current.moved = true;
    setView((v) => ({ ...v, x: drag.current.vx + dx, y: drag.current.vy + dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const clickNode = (n) => {
    if (drag.current?.moved) return;
    onSelect?.(n);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
      {edges.map((e, i) => {
        const s = positions[index.get(e.origem)];
        const t = positions[index.get(e.destino)];
        if (!s || !t) return null;
        const hot = destaques.has(`${e.origem}|${e.destino}`) || destaques.has(`${e.destino}|${e.origem}`);
        const dim = colapsados.has(e.origem) || colapsados.has(e.destino);
        return (
          <g key={i} className={hot ? "animate-pulse" : undefined}>
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={hot ? "#f43f5e" : "#3f3f46"} strokeWidth={hot ? 2.5 : 1} opacity={hot ? 0.95 : dim ? 0.12 : 0.6} />
            <text x={(s.x + t.x) / 2} y={(s.y + t.y) / 2 - 3} textAnchor="middle" fill={hot ? "#fda4af" : "#52525b"} fontSize="8" opacity={dim && !hot ? 0.2 : 1} className="pointer-events-none select-none">
              {e.tipo_de_relacao?.replace(/_/g, " ")}
            </text>
          </g>
        );
      })}
      {nodes.map((n, i) => {
        const p = positions[i];
        const cor = n.cor_grafo || TIPO_CORES[n.tipo] || "#a1a1aa";
        const sel = n.node_id === selectedId;
        const dim = colapsados.has(n.node_id) && !sel;
        const brilho = expandidos.has(n.node_id);
        const foco = n.node_id === render?.camera_foco_id;
        return (
          <g key={n.node_id} onClick={() => clickNode(n)} className="cursor-pointer" opacity={dim ? 0.18 : 1}>
            {brilho && <circle cx={p.x} cy={p.y} r={foco ? 26 : 20} fill="none" stroke={cor} strokeWidth="1" opacity="0.5" className="animate-pulse" />}
            <circle cx={p.x} cy={p.y} r={sel ? 16 : brilho ? 13 : 11} fill={cor} fillOpacity={sel ? 0.35 : brilho ? 0.28 : 0.18} stroke={cor} strokeWidth={sel || brilho ? 2 : 1.2} />
            <circle cx={p.x} cy={p.y} r="4" fill={cor} />
            {!dim && (
              <text x={p.x} y={p.y + (sel ? 30 : 24)} textAnchor="middle" fill={sel ? "#fafafa" : brilho ? "#e4e4e7" : "#a1a1aa"} fontSize="11" className="pointer-events-none select-none">
                {n.rotulo}
              </text>
            )}
          </g>
        );
      })}
      </g>
    </svg>
  );
}