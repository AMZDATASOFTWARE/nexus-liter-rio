// Topologia esférica do Físico de Dados 3D: núcleo denso, camadas orbitais e hemisférios multiversais
const LAYER_RADIUS = { Core: 0.22, Mantle: 0.55, Surface: 1 };

export function corSegura(cor) {
  if (!cor) return "#a1a1aa";
  const rgba = /^rgba?\(([^)]+)\)/.exec(cor);
  if (rgba) {
    const [r, g, b] = rgba[1].split(",").map((v) => parseFloat(v));
    return `rgb(${r || 0}, ${g || 0}, ${b || 0})`;
  }
  return /^#[0-9a-fA-F]{3,8}$/.test(cor) ? cor.slice(0, 7) : "#a1a1aa";
}

export function computeSpherePositions(nos, metadata, R = 260) {
  const metaMap = new Map(metadata.map((m) => [m.id, m]));
  const uniIds = [...new Set(nos.map((n) => n.universe_id))];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const positions = new Map();
  nos.forEach((n, i) => {
    const m = metaMap.get(n.node_id) || {};
    const peso = Math.min(Number(m.gravitational_weight) || 1, 10);
    // força centrípeta: quanto maior o peso gravitacional, mais próximo do centro (0,0,0)
    const r = R * (LAYER_RADIUS[m.orbital_layer] ?? 1) * (1 - (peso / 10) * 0.3);
    let y = 1 - (i / Math.max(nos.length - 1, 1)) * 2;
    const theta = golden * i;
    // repulsão multiversal: universos em hemisférios opostos; Nexus puxado ao equador
    if (n.tipo === "Nexus") y = y * 0.12;
    else if (uniIds.length > 1) {
      const hemisferio = uniIds.indexOf(n.universe_id) % 2 === 0 ? 1 : -1;
      y = hemisferio * (Math.abs(y) * 0.88 + 0.08);
    }
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    positions.set(n.node_id, {
      x: Math.cos(theta) * rad * r,
      y: y * r,
      z: Math.sin(theta) * rad * r,
      peso,
      cor: corSegura(m.color_intensity || n.cor_grafo),
    });
  });
  return positions;
}