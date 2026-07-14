// Estratificação Temporal: converte camadas de tempo em discos empilhados no eixo vertical
export function computeTemporalLayout(nos, layers, scale = 0.22) {
  const byId = new Map(nos.map((n) => [n.node_id, n]));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const positions = new Map();
  const discs = [];
  const assigned = new Set();

  const colocar = (ids, y, nome) => {
    const R = Math.max(55, 30 * Math.sqrt(ids.length) * 1.6);
    discs.push({ name: nome, y, radius: R + 35 });
    ids.forEach((id, i) => {
      const r = R * Math.sqrt((i + 0.5) / ids.length);
      const t = golden * i;
      positions.set(id, { x: Math.cos(t) * r, y, z: Math.sin(t) * r });
    });
  };

  for (const l of layers) {
    const [a, b] = l.z_coordinate_range || [0, 0];
    const y = ((a + b) / 2) * scale;
    const ids = (l.nodes_in_layer || []).filter((id) => byId.has(id) && !assigned.has(id));
    if (!ids.length) continue;
    ids.forEach((id) => assigned.add(id));
    colocar(ids, y, l.layer_name);
  }
  const resto = nos.filter((n) => !assigned.has(n.node_id)).map((n) => n.node_id);
  if (resto.length) colocar(resto, 0, "Presente");
  return { positions, discs };
}