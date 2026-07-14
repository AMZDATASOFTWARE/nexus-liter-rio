import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { computeSpherePositions } from "./sphereLayout";

export default function SphereGraph3D({ nos, arestas, metadata, lod, onViewportEvent, onSelect, zoomControlRef }) {
  const mountRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onViewportRef = useRef(onViewportEvent);
  onViewportRef.current = onViewportEvent;
  const objectsRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !nos.length) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#08080f");
    const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 5000);
    camera.position.set(0, 120, 560);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Barrinha de zoom discreta: t (0..1) → distância da câmera 1000..120
    if (zoomControlRef) {
      zoomControlRef.current = (t) => {
        camera.position.setLength(Math.max(120, 1000 - t * 880));
      };
    }

    const group = new THREE.Group();
    scene.add(group);
    const positions = computeSpherePositions(nos, metadata);

    const nodeObjs = new Map();
    const edgeObjs = [];
    const vizinhos = new Map();
    for (const n of nos) {
      const p = positions.get(n.node_id);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.5 + p.peso * 0.9, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(p.cor) })
      );
      mesh.position.set(p.x, p.y, p.z);
      mesh.userData.node = n;
      group.add(mesh);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry((2.5 + p.peso * 0.9) * 1.6, 12, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(p.cor), transparent: true, opacity: 0.12 })
      );
      halo.position.set(p.x, p.y, p.z);
      group.add(halo);
      nodeObjs.set(n.node_id, { mesh, halo, tipo: n.tipo });
    }
    for (const a of arestas) {
      const s = positions.get(a.origem), t = positions.get(a.destino);
      if (!s || !t) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(s.x, s.y, s.z),
        new THREE.Vector3(t.x, t.y, t.z),
      ]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x3f3f46, transparent: true, opacity: 0.35 }));
      group.add(line);
      edgeObjs.push({ line, origem: a.origem, destino: a.destino });
      if (!vizinhos.has(a.origem)) vizinhos.set(a.origem, new Set());
      if (!vizinhos.has(a.destino)) vizinhos.set(a.destino, new Set());
      vizinhos.get(a.origem).add(a.destino);
      vizinhos.get(a.destino).add(a.origem);
    }
    objectsRef.current = { nodeObjs, edgeObjs, vizinhos };

    // Controlador de Viewport: detecta a intenção de câmera ao fim de cada interação
    let prevDist = camera.position.length();
    let debounce;
    const onControlsEnd = () => {
      const dist = camera.position.length();
      let acaoViewport = "Drag_Pan";
      if (dist < prevDist - 25) acaoViewport = "Zoom_In";
      else if (dist > prevDist + 25) acaoViewport = "Zoom_Out";
      prevDist = dist;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const visiveis = [];
        nodeObjs.forEach((o, id) => { if (o.mesh.visible) visiveis.push(id); });
        onViewportRef.current?.({
          evento: acaoViewport,
          camera: {
            x: Math.round(camera.position.x),
            y: Math.round(camera.position.y),
            z: Math.round(camera.position.z),
            distancia: Math.round(dist),
          },
          visiveis,
        });
      }, 600);
    };
    controls.addEventListener("end", onControlsEnd);

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(group.children.filter((o) => o.userData.node && o.visible))[0];
      if (hit) onSelectRef.current?.(hit.object.userData.node);
    };
    renderer.domElement.addEventListener("click", onClick);

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      group.rotation.y += 0.0012;
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
      clearTimeout(debounce);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      controls.removeEventListener("end", onControlsEnd);
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      objectsRef.current = null;
    };
  }, [nos, arestas, metadata]);

  // Aplica as instruções de culling do Controlador de LOD sem reconstruir a cena
  useEffect(() => {
    const objs = objectsRef.current;
    if (!objs) return;
    const { nodeObjs, edgeObjs, vizinhos } = objs;
    const hide = new Set(lod?.culling_instructions?.node_types_to_hide || []);
    const show = lod?.culling_instructions?.node_types_to_show || [];
    const focusId = lod?.culling_instructions?.focus_center_id || null;
    const micro = lod?.lod_level === "Micro_Personal" && focusId && nodeObjs.has(focusId);
    const visiveis = new Set();
    nodeObjs.forEach((o, id) => {
      let vis = true;
      if (micro) {
        vis = id === focusId || (vizinhos.get(focusId)?.has(id) ?? false);
      } else {
        if (hide.has(o.tipo)) vis = false;
        if (show.length && !show.includes(o.tipo)) vis = false;
        if (id === focusId) vis = true;
      }
      o.mesh.visible = vis;
      o.halo.visible = vis;
      if (vis) visiveis.add(id);
    });
    for (const e of edgeObjs) e.line.visible = visiveis.has(e.origem) && visiveis.has(e.destino);
  }, [lod, nos, arestas]);

  return <div ref={mountRef} className="w-full h-full" />;
}