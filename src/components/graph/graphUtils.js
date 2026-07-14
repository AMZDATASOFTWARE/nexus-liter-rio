export const TIPO_CORES = {
  Personagem: "#f59e0b",
  Cenario: "#34d399",
  Clima: "#38bdf8",
  LinhaTemporal: "#a78bfa",
  Memoria: "#f472b6",
  Objeto: "#facc15",
};

// Layout força-dirigido simples (estático): repulsão + molas nas arestas
export function computeLayout(nodes, edges, width, height) {
  const pos = nodes.map((_, i) => ({
    x: width / 2 + Math.cos((i / Math.max(nodes.length, 1)) * Math.PI * 2) * Math.min(width, height) * 0.3,
    y: height / 2 + Math.sin((i / Math.max(nodes.length, 1)) * Math.PI * 2) * Math.min(width, height) * 0.3,
    vx: 0,
    vy: 0,
  }));
  const idx = new Map(nodes.map((n, i) => [n.node_id, i]));
  const links = edges
    .map((e) => ({ s: idx.get(e.origem), t: idx.get(e.destino) }))
    .filter((l) => l.s !== undefined && l.t !== undefined);

  for (let iter = 0; iter < 250; iter++) {
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        let dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
        const d2 = Math.max(dx * dx + dy * dy, 100);
        const f = 9000 / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        pos[i].vx += dx * f; pos[i].vy += dy * f;
        pos[j].vx -= dx * f; pos[j].vy -= dy * f;
      }
    }
    for (const l of links) {
      const dx = pos[l.t].x - pos[l.s].x, dy = pos[l.t].y - pos[l.s].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 130) * 0.02;
      pos[l.s].vx += (dx / d) * f; pos[l.s].vy += (dy / d) * f;
      pos[l.t].vx -= (dx / d) * f; pos[l.t].vy -= (dy / d) * f;
    }
    for (const p of pos) {
      p.vx += (width / 2 - p.x) * 0.002;
      p.vy += (height / 2 - p.y) * 0.002;
      p.x += p.vx * 0.5; p.y += p.vy * 0.5;
      p.vx *= 0.6; p.vy *= 0.6;
      p.x = Math.max(40, Math.min(width - 40, p.x));
      p.y = Math.max(40, Math.min(height - 40, p.y));
    }
  }
  return { positions: pos, index: idx };
}