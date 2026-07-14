import React, { useMemo, useRef, useEffect } from "react";
import { computeLayout, TIPO_CORES } from "./graphUtils";

export default function ForceGraph({ nodes, edges, selectedId, onSelect, render, zoomControlRef, width = 1200, height = 800 }) {
  const { positions, index } = useMemo(
    () => computeLayout(nodes, edges, width, height),
    [nodes, edges, width, height]
  );
  const colapsados = new Set(render?.clusters_para_colapsar || []);
  const expandidos = new Set([...(render?.nos_para_expandir || []), render?.camera_foco_id].filter(Boolean));
  const destaques = new Set((render?.arestas_em_destaque || []).map((a) => `${a.origem}|${a.destino}`));

  const svgRef = useRef(null);
  const gRef = useRef(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const drag = useRef(null);
  const clicked = useRef(true);

  // Aplica a transformação diretamente no SVG (sem re-renderizar o React a cada movimento)
  const applyView = () => {
    const v = view.current;
    if (![v.x, v.y, v.k].every(Number.isFinite)) view.current = { x: 0, y: 0, k: 1 };
    const { x, y, k } = view.current;
    gRef.current?.setAttribute("transform", `translate(${x} ${y}) scale(${k})`);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    applyView();

    // Barrinha de zoom discreta: t (0..1) → escala 0.3..5, ancorada no centro
    if (zoomControlRef) {
      zoomControlRef.current = (t) => {
        const k = 0.3 * Math.pow(5 / 0.3, t);
        const v = view.current;
        const cx = width / 2, cy = height / 2;
        view.current = { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
        applyView();
      };
    }

    // Converte coordenadas do mouse (tela) em coordenadas do viewBox do SVG
    const toSvgPoint = (clientX, clientY) => {
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      return pt.matrixTransform(ctm.inverse());
    };

    const onWheel = (e) => {
      e.preventDefault();
      const p = toSvgPoint(e.clientX, e.clientY);
      if (!p) return;
      const v = view.current;
      const k = Math.min(5, Math.max(0.3, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      view.current = { k, x: p.x - ((p.x - v.x) / v.k) * k, y: p.y - ((p.y - v.y) / v.k) * k };
      applyView();
    };
    const onPointerDown = (e) => {
      const p = toSvgPoint(e.clientX, e.clientY);
      if (!p) return;
      clicked.current = true;
      drag.current = { px: p.x, py: p.y, vx: view.current.x, vy: view.current.y };
      svg.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!drag.current) return;
      const p = toSvgPoint(e.clientX, e.clientY);
      if (!p) return;
      const dx = p.x - drag.current.px;
      const dy = p.y - drag.current.py;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) clicked.current = false;
      view.current = { k: view.current.k, x: drag.current.vx + dx, y: drag.current.vy + dy };
      applyView();
    };
    const onPointerUp = () => {
      drag.current = null;
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointerleave", onPointerUp);
    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointerleave", onPointerUp);
    };
  }, []);

  const clickNode = (n) => {
    if (!clicked.current) return;
    onSelect?.(n);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none"
    >
      <g ref={gRef}>
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