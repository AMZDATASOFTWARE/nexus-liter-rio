import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { computeTemporalLayout } from "./temporalLayout";
import { corSegura } from "./sphereLayout";

// Alcance da câmera: MAX_DIST alto para enquadrar estruturas com milhares de nós,
// sempre abaixo do far plane (50000) para evitar clipping
const MIN_DIST = 140;
const MAX_DIST = 10000;

function makeLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "28px Inter, sans-serif";
  ctx.fillStyle = "rgba(212, 212, 216, 0.85)";
  ctx.textAlign = "center";
  ctx.fillText(text.slice(0, 40), 256, 42);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
  sprite.scale.set(160, 20, 1);
  return sprite;
}

export default function TemporalGraph3D({ nos, arestas, layers, wormholes, onSelect, zoomControlRef }) {
  const mountRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !nos.length) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#08080f");
    const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 50000);
    camera.position.set(0, 220, 620);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxDistance = 40000;

    // Barrinha de zoom discreta: t (0..1) → distância exponencial MAX_DIST..MIN_DIST
    if (zoomControlRef) {
      zoomControlRef.current = (t) => {
        camera.position.setLength(MAX_DIST * Math.pow(MIN_DIST / MAX_DIST, t));
      };
    }

    const group = new THREE.Group();
    scene.add(group);
    const { positions, discs } = computeTemporalLayout(nos, layers);

    // Discos temporais translúcidos com rótulo da era
    for (const d of discs) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(d.radius, 48),
        new THREE.MeshBasicMaterial({ color: 0x27272a, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = d.y;
      group.add(disc);
      const label = makeLabel(d.name);
      label.position.set(0, d.y + 10, -d.radius);
      group.add(label);
    }

    // Nós flutuando em seus discos temporais
    for (const n of nos) {
      const p = positions.get(n.node_id);
      if (!p) continue;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(5, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(corSegura(n.cor_grafo)) })
      );
      mesh.position.set(p.x, p.y, p.z);
      mesh.userData.node = n;
      group.add(mesh);
    }

    // Arestas comuns dentro/entre camadas
    const chavesWormhole = new Set((wormholes || []).map((w) => `${w.source_id}|${w.target_id}`));
    for (const a of arestas) {
      if (chavesWormhole.has(`${a.origem}|${a.destino}`) || chavesWormhole.has(`${a.destino}|${a.origem}`)) continue;
      const s = positions.get(a.origem), t = positions.get(a.destino);
      if (!s || !t) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s.x, s.y, s.z), new THREE.Vector3(t.x, t.y, t.z)]);
      group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x3f3f46, transparent: true, opacity: 0.3 })));
    }

    // Buracos de Minhoca: túneis verticais brilhantes furando as camadas
    const wormholeMats = [];
    for (const w of wormholes || []) {
      const s = positions.get(w.source_id), t = positions.get(w.target_id);
      if (!s || !t) continue;
      const from = new THREE.Vector3(s.x, s.y, s.z);
      const to = new THREE.Vector3(t.x, t.y, t.z);
      const dir = new THREE.Vector3().subVectors(to, from);
      const mat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55 });
      wormholeMats.push(mat);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, dir.length(), 10, 1, true), mat);
      tube.position.copy(from.clone().add(to).multiplyScalar(0.5));
      tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      group.add(tube);
    }

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(group.children.filter((o) => o.userData.node))[0];
      if (hit) onSelectRef.current?.(hit.object.userData.node);
    };
    renderer.domElement.addEventListener("click", onClick);

    let raf, tick = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      tick += 0.04;
      for (const m of wormholeMats) m.opacity = 0.4 + Math.sin(tick) * 0.25;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [nos, arestas, layers, wormholes]);

  return <div ref={mountRef} className="w-full h-full" />;
}